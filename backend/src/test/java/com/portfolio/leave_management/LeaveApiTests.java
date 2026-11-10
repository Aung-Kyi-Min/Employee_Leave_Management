package com.portfolio.leave_management;

import static org.junit.jupiter.api.Assertions.*;
import java.time.*;
import java.util.*;
import java.net.URI;
import java.net.http.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties="spring.datasource.url=jdbc:h2:mem:leave_api;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1")
class LeaveApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate db;
    @Autowired EmployeeService employees;
    final ObjectMapper json=new ObjectMapper();
    final HttpClient client=HttpClient.newHttpClient();
    static final String PASSWORD="SecurePassword123!";
    long department;
    String admin;
    HttpResponse<String> request(String method,String path,String token,Object body) throws Exception {
        var builder=HttpRequest.newBuilder(URI.create("http://localhost:"+port+path)).header("Content-Type","application/json");
        if(token!=null) builder.header("Authorization","Bearer "+token);
        builder.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        return client.send(builder.build(),HttpResponse.BodyHandlers.ofString());
    }
    String login(String email,String password) throws Exception {
        var response=request("POST","/api/auth/login",null,Map.of("email",email,"password",password));
        assertEquals(200,response.statusCode(),response.body());
        return json.readTree(response.body()).get("accessToken").asString();
    }
    Map<String,Object> payload(String email) {
        var data=new HashMap<String,Object>();
        data.put("employeeNumber","EMP-001"); data.put("fullName","Employee One"); data.put("email",email);
        data.put("password",PASSWORD); data.put("departmentId",department); data.put("hireDate","2026-01-01"); data.put("roles",List.of("EMPLOYEE"));
        return data;
    }

    String worker,manager;
    long type;
    LocalDate day;
    @BeforeEach void setup() throws Exception {
        for(String table:List.of("audit_logs","approvals","leave_requests","leave_balances")) db.update("DELETE FROM "+table);
        db.update("UPDATE employees SET manager_id=NULL");
        db.update("DELETE FROM leave_types");
        for(String table:List.of("auth_tokens","employee_roles","employees","departments")) db.update("DELETE FROM "+table);
        db.update("INSERT INTO departments(department_name) VALUES ('Engineering')");
        department=db.queryForObject("SELECT department_id FROM departments",Long.class);
        employees.create(new EmployeeModels.CreateEmployee("ADMIN","Admin","admin@example.com",PASSWORD,department,null,"Admin",LocalDate.now(),Set.of(EmployeeModels.Role.ADMIN)));
        admin=login("admin@example.com",PASSWORD);
        var managerData=payload("manager@example.com");
        managerData.put("employeeNumber","MANAGER");managerData.put("roles",List.of("MANAGER"));
        var result=request("POST","/api/employees",admin,managerData);
        assertEquals(201,result.statusCode(),result.body());
        long managerId=json.readTree(result.body()).get("id").asLong();
        var workerData=payload("worker@example.com");workerData.put("managerId",managerId);
        result=request("POST","/api/employees",admin,workerData);
        assertEquals(201,result.statusCode(),result.body());
        long employee=json.readTree(result.body()).get("id").asLong();
        db.update("INSERT INTO leave_types(leave_name) VALUES ('Annual')");
        type=db.queryForObject("SELECT leave_type_id FROM leave_types",Long.class);
        day=LocalDate.now(ZoneId.of("Asia/Kuala_Lumpur")).plusYears(1).withMonth(6).withDayOfMonth(1);
        while(day.getDayOfWeek()!=DayOfWeek.MONDAY) day=day.plusDays(1);
        db.update("INSERT INTO leave_balances(employee_id,leave_type_id,leave_year,entitled_days) VALUES (?,?,?,5)",employee,type,day.getYear());
        worker=login("worker@example.com",PASSWORD);manager=login("manager@example.com",PASSWORD);
    }
    java.net.http.HttpResponse<String> submit(LocalDate start,LocalDate end) throws Exception {
        return request("POST","/api/leave-requests",worker,Map.of("leaveTypeId",type,"startDate",start.toString(),"endDate",end.toString(),"reason","Vacation"));
    }
    long createLeave() throws Exception {
        var result=submit(day,day.plusDays(1));assertEquals(201,result.statusCode(),result.body());
        return json.readTree(result.body()).get("id").asLong();
    }
    void balance(int used,int pending,int available) throws Exception {
        var result=request("GET","/api/leave-balances?year="+day.getYear(),worker,null);
        assertEquals(200,result.statusCode(),result.body());
        var row=json.readTree(result.body()).get(0);
        assertEquals(used,row.get("usedDays").asInt());assertEquals(pending,row.get("pendingDays").asInt());assertEquals(available,row.get("availableDays").asInt());
    }
    @Test void approvalWorkflow() throws Exception {
        assertEquals(401,request("GET","/api/leave-types",null,null).statusCode());
        long id=createLeave();balance(0,2,3);
        assertEquals(403,request("GET","/api/leave-requests/assigned",worker,null).statusCode());
        assertEquals(1,json.readTree(request("GET","/api/leave-requests/assigned",manager,null).body()).size());
        assertEquals(0,json.readTree(request("GET","/api/leave-requests",manager,null).body()).size());
        String path="/api/leave-requests/"+id+"/decision";
        var decision=Map.of("decision","APPROVED","comments","Enjoy");
        assertEquals(403,request("POST",path,worker,decision).statusCode());
        var result=request("POST",path,manager,decision);assertEquals(200,result.statusCode(),result.body());
        assertEquals("APPROVED",json.readTree(result.body()).get("status").asString());balance(2,0,3);
        assertEquals(409,request("POST",path,manager,decision).statusCode());
        assertEquals(409,request("POST","/api/leave-requests/"+id+"/cancel",worker,null).statusCode());
    }
    @Test void cancellationAndRejection() throws Exception {
        long id=createLeave();
        assertEquals(404,request("POST","/api/leave-requests/"+id+"/cancel",manager,null).statusCode());
        assertEquals(204,request("POST","/api/leave-requests/"+id+"/cancel",worker,null).statusCode());balance(0,0,5);
        assertEquals(409,request("POST","/api/leave-requests/"+id+"/decision",manager,Map.of("decision","APPROVED")).statusCode());
        id=createLeave();
        assertEquals(200,request("POST","/api/leave-requests/"+id+"/decision",manager,Map.of("decision","REJECTED")).statusCode());balance(0,0,5);
    }
    @Test void validationAndReservations() throws Exception {
        assertEquals(400,submit(day.plusDays(5),day.plusDays(6)).statusCode());
        assertEquals(400,submit(day,day.minusDays(1)).statusCode());
        assertEquals(400,submit(day,day.plusYears(1)).statusCode());
        createLeave();
        assertEquals(409,submit(day,day).statusCode());
        assertEquals(409,submit(day.plusWeeks(1),day.plusWeeks(1).plusDays(3)).statusCode());
    }
    @Test void automaticApproval() throws Exception {
        db.update("UPDATE leave_types SET requires_approval=FALSE");
        var result=submit(day,day);assertEquals(201,result.statusCode(),result.body());
        assertEquals("APPROVED",json.readTree(result.body()).get("status").asString());balance(1,0,4);
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM approvals",Integer.class));
        assertEquals(400,submit(day.plusYears(1),day.plusYears(1)).statusCode());
    }
}
