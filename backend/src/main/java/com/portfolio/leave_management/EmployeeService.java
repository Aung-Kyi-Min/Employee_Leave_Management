package com.portfolio.leave_management;

import static com.portfolio.leave_management.EmployeeModels.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmployeeService {
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    public EmployeeService(JdbcTemplate db, PasswordEncoder passwords) { this.db=db; this.passwords=passwords; }
    public Set<String> roles(long id) {
        return new LinkedHashSet<>(db.queryForList("SELECT r.role_name FROM roles r JOIN employee_roles er ON er.role_id=r.role_id WHERE er.employee_id=? ORDER BY r.role_name", String.class,id));
    }
    public Employee get(long id) {
        var rows=db.query("SELECT * FROM employees WHERE employee_id=?", (rs,n)->new Employee(
            rs.getLong("employee_id"),rs.getString("employee_number"),rs.getString("full_name"),rs.getString("email"),
            rs.getLong("department_id"),rs.getObject("manager_id",Long.class),rs.getString("job_title"),
            rs.getDate("hire_date").toLocalDate(),rs.getBoolean("is_active"),roles(id)),id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Employee not found");
        return rows.getFirst();
    }
    public List<Employee> list(int page,int size) {
        if(page<0 || size<1 || size>100 || page>1000000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid pagination");
        return db.queryForList("SELECT employee_id FROM employees ORDER BY employee_id LIMIT ? OFFSET ?",Long.class,size,(long)page*size).stream().map(this::get).toList();
    }
    private void references(Long department,Long manager,Long self) {
        if(db.queryForObject("SELECT COUNT(*) FROM departments WHERE department_id=?",Integer.class,department)==0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Department not found");
        if(manager!=null) {
            var boss=get(manager);
            if(!boss.active() || !boss.roles().contains("MANAGER")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Manager must be an active MANAGER");
            Set<Long> visited=new HashSet<>();
            Long cursor=manager;
            while(cursor!=null) {
                if(cursor.equals(self) || !visited.add(cursor)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Manager hierarchy cannot contain a cycle");
                cursor=get(cursor).managerId();
            }
        }
    }
    public String encode(String password) {
        if(password.getBytes(StandardCharsets.UTF_8).length>72) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Password must be at most 72 UTF-8 bytes");
        return passwords.encode(password);
    }
    private void assign(long id,Set<Role> roles) {
        db.update("DELETE FROM employee_roles WHERE employee_id=?",id);
        for(Role role:roles) db.update("INSERT INTO employee_roles(employee_id,role_id) SELECT ?,role_id FROM roles WHERE role_name=?",id,role.name());
    }
    @Transactional
    public Employee create(CreateEmployee r) {
        references(r.departmentId(),r.managerId(),null);
        var keys=new org.springframework.jdbc.support.GeneratedKeyHolder();
        db.update(connection->{
            var ps=connection.prepareStatement("INSERT INTO employees(employee_number,full_name,email,password_hash,department_id,manager_id,job_title,hire_date) VALUES (?,?,?,?,?,?,?,?)",new String[]{"employee_id"});
            ps.setString(1,r.employeeNumber().trim()); ps.setString(2,r.fullName().trim());
            ps.setString(3,r.email().trim().toLowerCase(Locale.ROOT)); ps.setString(4,encode(r.password()));
            ps.setLong(5,r.departmentId()); ps.setObject(6,r.managerId()); ps.setString(7,r.jobTitle()); ps.setObject(8,r.hireDate());
            return ps;
        },keys);
        long id=Objects.requireNonNull(keys.getKey()).longValue();
        assign(id,r.roles()); return get(id);
    }
    @Transactional
    public Employee update(long id, UpdateEmployee r) {
        get(id); protectLastAdmin(id,r.active(),r.roles().contains(Role.ADMIN));
        references(r.departmentId(),r.managerId(),id);
        db.update("UPDATE employees SET employee_number=?,full_name=?,email=?,department_id=?,manager_id=?,job_title=?,hire_date=?,is_active=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?",
            r.employeeNumber().trim(),r.fullName().trim(),r.email().trim().toLowerCase(Locale.ROOT),r.departmentId(),r.managerId(),r.jobTitle(),r.hireDate(),r.active(),id);
        assign(id,r.roles()); revoke(id); return get(id);
    }
    @Transactional
    public void deactivate(long id) {
        get(id); protectLastAdmin(id,false,false);
        db.update("UPDATE employees SET is_active=FALSE,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?",id); revoke(id);
    }
    private void protectLastAdmin(long id, boolean active, boolean admin) {
        db.queryForList("SELECT role_id FROM roles WHERE role_name='ADMIN' FOR UPDATE");
        var employee=get(id);
        if(employee.active() && employee.roles().contains("ADMIN") && (!active || !admin)) {
            Integer count=db.queryForObject("SELECT COUNT(*) FROM employees e JOIN employee_roles er ON er.employee_id=e.employee_id JOIN roles r ON r.role_id=er.role_id WHERE e.is_active=TRUE AND r.role_name='ADMIN'",Integer.class);
            if(count==1) throw new ResponseStatusException(HttpStatus.CONFLICT,"The last active administrator cannot be removed");
        }
    }
    public void revoke(long id) { db.update("DELETE FROM auth_tokens WHERE employee_id=?",id); }
    @Transactional
    public void changePassword(long id, PasswordChange r) {
        String hash=db.queryForObject("SELECT password_hash FROM employees WHERE employee_id=?",String.class,id);
        if(!passwords.matches(r.currentPassword(),hash)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Current password is incorrect");
        db.update("UPDATE employees SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?",encode(r.newPassword()),id); revoke(id);
    }
}
