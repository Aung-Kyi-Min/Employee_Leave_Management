package com.portfolio.leave_management;

import static com.portfolio.leave_management.LeaveModels.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LeaveService {
    private static final ZoneId BUSINESS_ZONE=ZoneId.of("Asia/Kuala_Lumpur");
    private final JdbcTemplate db;
    public LeaveService(JdbcTemplate db) { this.db=db; }

    public List<LeaveType> types() {
        return db.query("SELECT leave_type_id,leave_name,description,requires_approval,is_paid FROM leave_types WHERE is_active=TRUE ORDER BY leave_name",
            (rs,n)->new LeaveType(rs.getLong(1),rs.getString(2),rs.getString(3),rs.getBoolean(4),rs.getBoolean(5)));
    }
    public List<Balance> balances(long employee, Integer year) {
        int y=year==null?Year.now(BUSINESS_ZONE).getValue():year;
        if(y<1900 || y>9999) throw bad("Invalid leave year");
        return db.query("SELECT b.leave_type_id,t.leave_name,b.leave_year,b.entitled_days,b.carried_forward_days,b.used_days,COALESCE((SELECT SUM(lr.total_days) FROM leave_requests lr WHERE lr.employee_id=b.employee_id AND lr.leave_type_id=b.leave_type_id AND EXTRACT(YEAR FROM lr.start_date)=b.leave_year AND lr.status='PENDING'),0) FROM leave_balances b JOIN leave_types t ON t.leave_type_id=b.leave_type_id WHERE b.employee_id=? AND b.leave_year=? ORDER BY t.leave_name",
            (rs,n)->new Balance(rs.getLong(1),rs.getString(2),rs.getInt(3),rs.getBigDecimal(4),rs.getBigDecimal(5),rs.getBigDecimal(6),rs.getBigDecimal(7),rs.getBigDecimal(4).add(rs.getBigDecimal(5)).subtract(rs.getBigDecimal(6)).subtract(rs.getBigDecimal(7))),employee,y);
    }
    public List<Request> mine(long employee) { return requests("WHERE lr.employee_id=?",employee); }
    public List<Request> assigned(long manager) { return requests("WHERE a.approver_id=? AND a.decision='PENDING' AND lr.status='PENDING'",manager); }
    private List<Request> requests(String filter,long id) {
        return db.query("SELECT lr.request_id,lr.employee_id,e.full_name,lr.leave_type_id,t.leave_name,lr.start_date,lr.end_date,lr.total_days,lr.reason,lr.status,lr.submitted_at,a.approver_id,ap.full_name,a.decision,a.comments FROM leave_requests lr JOIN employees e ON e.employee_id=lr.employee_id JOIN leave_types t ON t.leave_type_id=lr.leave_type_id LEFT JOIN approvals a ON a.request_id=lr.request_id AND a.approval_level=1 LEFT JOIN employees ap ON ap.employee_id=a.approver_id "+filter+" ORDER BY lr.submitted_at DESC,lr.request_id DESC",
            (rs,n)->new Request(rs.getLong(1),rs.getLong(2),rs.getString(3),rs.getLong(4),rs.getString(5),rs.getDate(6).toLocalDate(),rs.getDate(7).toLocalDate(),rs.getBigDecimal(8),rs.getString(9),rs.getString(10),rs.getTimestamp(11).toLocalDateTime(),rs.getObject(12,Long.class),rs.getString(13),rs.getString(14),rs.getString(15)),id);
    }
    @Transactional
    public Request create(long employee, CreateRequest r) {
        // Serialize submissions for this employee to prevent concurrent overlap/balance races.
        var employeeRows=db.queryForList("SELECT employee_id FROM employees WHERE employee_id=? AND is_active=TRUE FOR UPDATE",Long.class,employee);
        if(employeeRows.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Active employee account required");
        if(r.startDate().isBefore(LocalDate.now(BUSINESS_ZONE))) throw bad("Leave cannot start in the past");
        if(r.endDate().isBefore(r.startDate())) throw bad("End date must be on or after start date");
        BigDecimal days=weekdayCount(r.startDate(),r.endDate());
        if(days.signum()<=0) throw bad("Request must include at least one weekday");
        Integer active=db.queryForObject("SELECT COUNT(*) FROM leave_types WHERE leave_type_id=? AND is_active=TRUE",Integer.class,r.leaveTypeId());
        if(active==null || active==0) throw bad("Active leave type not found");
        Integer overlaps=db.queryForObject("SELECT COUNT(*) FROM leave_requests WHERE employee_id=? AND status IN ('PENDING','APPROVED') AND start_date<=? AND end_date>=?",Integer.class,employee,r.endDate(),r.startDate());
        if(overlaps!=null && overlaps>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Request overlaps an existing pending or approved request");
        int year=r.startDate().getYear();
        // Requests spanning calendar years use the start-year balance; reject to keep balances unambiguous.
        if(r.endDate().getYear()!=year) throw bad("Leave request must be within one calendar year");
        List<Map<String,Object>> balances=db.queryForList("SELECT entitled_days,carried_forward_days,used_days FROM leave_balances WHERE employee_id=? AND leave_type_id=? AND leave_year=? FOR UPDATE",employee,r.leaveTypeId(),year);
        if(balances.isEmpty()) throw bad("No leave balance exists for this leave type and year");
        var balance=balances.getFirst();
        BigDecimal available=((BigDecimal)balance.get("entitled_days")).add((BigDecimal)balance.get("carried_forward_days")).subtract((BigDecimal)balance.get("used_days"));
        boolean approval=db.queryForObject("SELECT requires_approval FROM leave_types WHERE leave_type_id=?",Boolean.class,r.leaveTypeId());
        Long manager=db.queryForObject("SELECT manager_id FROM employees WHERE employee_id=?",Long.class,employee);
        if(approval && manager==null) throw bad("Your account has no manager assigned to approve leave");
        if(approval) {
            Integer validManager=db.queryForObject("SELECT COUNT(*) FROM employees e JOIN employee_roles er ON er.employee_id=e.employee_id JOIN roles ro ON ro.role_id=er.role_id WHERE e.employee_id=? AND e.is_active=TRUE AND ro.role_name='MANAGER'",Integer.class,manager);
            if(validManager==null || validManager==0) throw bad("Assigned manager is not active or cannot approve leave");
            BigDecimal reserved=db.queryForObject("SELECT COALESCE(SUM(total_days),0) FROM leave_requests WHERE employee_id=? AND leave_type_id=? AND EXTRACT(YEAR FROM start_date)=? AND status='PENDING'",BigDecimal.class,employee,r.leaveTypeId(),year);
            available=available.subtract(reserved);
        }
        if(days.compareTo(available)>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Insufficient available leave balance");
        boolean autoApproved=!approval;
        var key=new org.springframework.jdbc.support.GeneratedKeyHolder();
        db.update(c->{var ps=c.prepareStatement("INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,total_days,reason,status) VALUES (?,?,?,?,?,?,?)",new String[]{"request_id"});
            ps.setLong(1,employee);ps.setLong(2,r.leaveTypeId());ps.setObject(3,r.startDate());ps.setObject(4,r.endDate());ps.setBigDecimal(5,days);ps.setString(6,r.reason()==null?null:r.reason().trim());ps.setString(7,autoApproved?"APPROVED":"PENDING");return ps;},key);
        long request=Objects.requireNonNull(key.getKey()).longValue();
        if(autoApproved) db.update("UPDATE leave_balances SET used_days=used_days+? WHERE employee_id=? AND leave_type_id=? AND leave_year=?",days,employee,r.leaveTypeId(),year);
        else db.update("INSERT INTO approvals(request_id,approver_id,approval_level,decision) VALUES (?,?,1,'PENDING')",request,manager);
        db.update("INSERT INTO audit_logs(employee_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)",employee,"LEAVE_REQUEST_SUBMITTED","LEAVE_REQUEST",request,"status="+(autoApproved?"APPROVED":"PENDING")+", days="+days);
        return requests("WHERE lr.request_id=?",request).getFirst();
    }
    @Transactional
    public Request decide(long manager,long request,Decision r) {
        var rows=db.queryForList("SELECT lr.employee_id,lr.leave_type_id,lr.start_date,lr.total_days,a.decision,lr.status FROM leave_requests lr JOIN approvals a ON a.request_id=lr.request_id AND a.approval_level=1 WHERE lr.request_id=? AND a.approver_id=? FOR UPDATE",request,manager);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Assigned leave request not found");
        var row=rows.getFirst();
        if(!"PENDING".equals(row.get("decision")) || !"PENDING".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Leave request has already been decided");
        String decision=r.decision().name();
        db.update("UPDATE approvals SET decision=?,comments=?,decided_at=CURRENT_TIMESTAMP WHERE request_id=? AND approval_level=1",decision,r.comments()==null?null:r.comments().trim(),request);
        db.update("UPDATE leave_requests SET status=?,updated_at=CURRENT_TIMESTAMP WHERE request_id=?",decision,request);
        if("APPROVED".equals(decision)) {
            long employee=((Number)row.get("employee_id")).longValue(), type=((Number)row.get("leave_type_id")).longValue();
            int year=((java.sql.Date)row.get("start_date")).toLocalDate().getYear(); BigDecimal days=(BigDecimal)row.get("total_days");
            db.update("UPDATE leave_balances SET used_days=used_days+? WHERE employee_id=? AND leave_type_id=? AND leave_year=?",days,employee,type,year);
        }
        db.update("INSERT INTO audit_logs(employee_id,action,entity_type,entity_id,details) VALUES (?,?,?,?,?)",manager,"LEAVE_REQUEST_"+decision,"LEAVE_REQUEST",request,r.comments());
        return requests("WHERE lr.request_id=?",request).getFirst();
    }
    @Transactional
    public void cancel(long employee,long request) {
        var rows=db.queryForList("SELECT status,leave_type_id,start_date,total_days FROM leave_requests WHERE request_id=? AND employee_id=? FOR UPDATE",request,employee);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Leave request not found");
        var row=rows.getFirst(); if(!"PENDING".equals(row.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Only pending requests can be cancelled");
        db.update("UPDATE leave_requests SET status='CANCELLED',updated_at=CURRENT_TIMESTAMP WHERE request_id=?",request);
        db.update("UPDATE approvals SET decision='REJECTED',comments='Cancelled by requester',decided_at=CURRENT_TIMESTAMP WHERE request_id=? AND approval_level=1",request);
        db.update("INSERT INTO audit_logs(employee_id,action,entity_type,entity_id) VALUES (?,?,?,?)",employee,"LEAVE_REQUEST_CANCELLED","LEAVE_REQUEST",request);
    }
    private static BigDecimal weekdayCount(LocalDate start,LocalDate end) {
        long count=0; for(LocalDate d=start;!d.isAfter(end);d=d.plusDays(1)) if(d.getDayOfWeek()!=DayOfWeek.SATURDAY && d.getDayOfWeek()!=DayOfWeek.SUNDAY) count++;
        return BigDecimal.valueOf(count);
    }
    private static ResponseStatusException bad(String msg) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,msg); }
}
