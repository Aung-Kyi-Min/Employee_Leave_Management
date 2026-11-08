package com.portfolio.leave_management;

import static org.junit.jupiter.api.Assertions.*;
import java.net.URI;
import java.net.http.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT)
class EmployeeApiTests {
    @LocalServerPort int port;
    @Autowired JdbcTemplate db;
    @Autowired EmployeeService employees;
    final ObjectMapper json=new ObjectMapper();
    final HttpClient client=HttpClient.newHttpClient();
    static final String PASSWORD="SecurePassword123!";
    long department;
    String admin;
    @BeforeEach void setup() throws Exception {
        db.update("DELETE FROM auth_tokens"); db.update("DELETE FROM employee_roles"); db.update("DELETE FROM employees"); db.update("DELETE FROM departments");
        db.update("INSERT INTO departments(department_name) VALUES ('Engineering')");
        department=db.queryForObject("SELECT department_id FROM departments",Long.class);
        employees.create(new EmployeeModels.CreateEmployee("ADMIN","Admin","admin@example.com",PASSWORD,department,null,"Admin",LocalDate.now(),Set.of(EmployeeModels.Role.ADMIN)));
        admin=login("admin@example.com",PASSWORD);
    }
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
    long create() throws Exception {
        var response=request("POST","/api/employees",admin,payload("employee@example.com"));
        assertEquals(201,response.statusCode(),response.body()); assertFalse(response.body().contains("password"));
        return json.readTree(response.body()).get("id").asLong();
    }
    @Test void crudAndPermissions() throws Exception {
        assertEquals(200,request("GET","/api/health",null,null).statusCode());
        assertEquals(401,request("GET","/api/employees",null,null).statusCode());
        long id=create(); String token=login("EMPLOYEE@example.com",PASSWORD);
        assertEquals(403,request("GET","/api/employees",token,null).statusCode());
        assertEquals(403,request("POST","/api/employees",token,payload("other@example.com")).statusCode());
        assertEquals(403,request("DELETE","/api/employees/"+id,token,null).statusCode());
        assertEquals(200,request("GET","/api/auth/me",token,null).statusCode());
        assertEquals(200,request("GET","/api/employees/"+id,admin,null).statusCode());
        assertEquals(200,request("GET","/api/employees?page=0&size=1",admin,null).statusCode());
        var update=payload("changed@example.com"); update.remove("password"); update.put("active",true); update.put("fullName","Updated Name");
        var result=request("PUT","/api/employees/"+id,admin,update);
        assertEquals(200,result.statusCode(),result.body()); assertTrue(result.body().contains("Updated Name"));
        assertEquals(401,request("GET","/api/auth/me",token,null).statusCode());
        token=login("changed@example.com",PASSWORD);
        assertEquals(204,request("DELETE","/api/employees/"+id,admin,null).statusCode());
        assertEquals(401,request("GET","/api/auth/me",token,null).statusCode());
        assertEquals(401,request("POST","/api/auth/login",null,Map.of("email","changed@example.com","password",PASSWORD)).statusCode());
        assertNotNull(employees.get(id)); assertFalse(employees.get(id).active());
    }
    @Test void validationAndConflicts() throws Exception {
        create();
        assertEquals(409,request("POST","/api/employees",admin,payload("employee@example.com")).statusCode());
        var data=payload("bad-email"); assertEquals(400,request("POST","/api/employees",admin,data).statusCode());
        data=payload("second@example.com"); data.put("departmentId",999999);
        assertEquals(400,request("POST","/api/employees",admin,data).statusCode());
        assertEquals(404,request("GET","/api/employees/999999",admin,null).statusCode());
        assertEquals(400,request("GET","/api/employees?size=101",admin,null).statusCode());
        assertEquals(401,request("POST","/api/auth/login",null,Map.of("email","employee@example.com","password","incorrect")).statusCode());
        assertEquals(401,request("POST","/api/auth/login",null,Map.of("email","unknown@example.com","password","incorrect")).statusCode());
        assertEquals(401,request("GET","/api/auth/me","fake-token",null).statusCode());
    }
    @Test void protectsLastAdministratorAndRejectsCycles() throws Exception {
        long adminId=db.queryForObject("SELECT employee_id FROM employees WHERE email='admin@example.com'",Long.class);
        assertEquals(409,request("DELETE","/api/employees/"+adminId,admin,null).statusCode());
        var manager=payload("manager@example.com"); manager.put("roles",List.of("MANAGER"));
        var created=request("POST","/api/employees",admin,manager);
        assertEquals(201,created.statusCode(),created.body());
        long id=json.readTree(created.body()).get("id").asLong();
        manager.remove("password"); manager.put("active",true); manager.put("managerId",id);
        assertEquals(400,request("PUT","/api/employees/"+id,admin,manager).statusCode());
    }
    @Test void logoutExpiryAndPasswordChange() throws Exception {
        create(); String first=login("employee@example.com",PASSWORD); String second=login("employee@example.com",PASSWORD);
        assertEquals(204,request("POST","/api/auth/logout",first,null).statusCode());
        assertEquals(401,request("GET","/api/auth/me",first,null).statusCode());
        assertEquals(200,request("GET","/api/auth/me",second,null).statusCode());
        db.update("UPDATE auth_tokens SET expires_at=TIMESTAMP '2000-01-01 00:00:00' WHERE token_hash=?",AuthService.hash(second));
        assertEquals(401,request("GET","/api/auth/me",second,null).statusCode());
        first=login("employee@example.com",PASSWORD); second=login("employee@example.com",PASSWORD);
        assertEquals(401,request("PUT","/api/auth/password",first,Map.of("currentPassword","wrong","newPassword","NewSecurePassword123!")).statusCode());
        assertEquals(204,request("PUT","/api/auth/password",first,Map.of("currentPassword",PASSWORD,"newPassword","NewSecurePassword123!")).statusCode());
        assertEquals(401,request("GET","/api/auth/me",second,null).statusCode());
        assertNotNull(login("employee@example.com","NewSecurePassword123!"));
        String stored=db.queryForObject("SELECT password_hash FROM employees WHERE email='employee@example.com'",String.class);
        assertTrue(stored.startsWith("$2")); assertNotEquals(PASSWORD,stored);
    }
}
