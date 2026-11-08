package com.portfolio.leave_management;

import java.time.LocalDate;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Opt-in first administrator provisioning; never creates a default password. */
@Component
public class AdminBootstrap implements ApplicationRunner {
    private final JdbcTemplate db;
    private final EmployeeService employees;
    private final String email,password;
    public AdminBootstrap(JdbcTemplate db,EmployeeService employees,
        @Value("${app.bootstrap.email:}") String email,@Value("${app.bootstrap.password:}") String password) {
        this.db=db; this.employees=employees; this.email=email; this.password=password;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        if(email.isBlank() && password.isBlank()) return;
        // Serialize first-account creation across application instances on PostgreSQL.
        db.queryForList("SELECT role_id FROM roles WHERE role_name='ADMIN' FOR UPDATE");
        if(db.queryForObject("SELECT COUNT(*) FROM employees",Integer.class)>0) return;
        if(email.isBlank() || !email.contains("@") || email.length()>320 || password.length()<12)
            throw new IllegalStateException("Bootstrap requires a valid email and a password of at least 12 characters");
        if(db.queryForObject("SELECT COUNT(*) FROM departments WHERE department_name='Administration'",Integer.class)==0)
            db.update("INSERT INTO departments(department_name) VALUES ('Administration')");
        Long department=db.queryForObject("SELECT department_id FROM departments WHERE department_name='Administration'",Long.class);
        employees.create(new EmployeeModels.CreateEmployee("ADMIN-001","Administrator",email,password,department,null,"Administrator",LocalDate.now(),Set.of(EmployeeModels.Role.ADMIN)));
    }
}
