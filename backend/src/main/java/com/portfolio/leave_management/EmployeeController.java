package com.portfolio.leave_management;

import static com.portfolio.leave_management.EmployeeModels.*;
import java.net.URI;
import java.util.*;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EmployeeController {
    private final EmployeeService employees;
    private final JdbcTemplate db;
    public EmployeeController(EmployeeService employees,JdbcTemplate db) { this.employees=employees; this.db=db; }
    @GetMapping("/employees") public List<Employee> list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) { return employees.list(page,size); }
    @GetMapping("/employees/{id}") public Employee get(@PathVariable long id) { return employees.get(id); }
    @PostMapping("/employees") public ResponseEntity<Employee> create(@Valid @RequestBody CreateEmployee r) {
        var employee=employees.create(r); return ResponseEntity.created(URI.create("/api/employees/"+employee.id())).body(employee);
    }
    @PutMapping("/employees/{id}") public Employee update(@PathVariable long id,@Valid @RequestBody UpdateEmployee r) { return employees.update(id,r); }
    @DeleteMapping("/employees/{id}") public ResponseEntity<Void> delete(@PathVariable long id) { employees.deactivate(id); return ResponseEntity.noContent().build(); }
    @GetMapping("/departments") public List<Map<String,Object>> departments() { return db.queryForList("SELECT department_id AS id,department_name AS name FROM departments ORDER BY department_name"); }
}
