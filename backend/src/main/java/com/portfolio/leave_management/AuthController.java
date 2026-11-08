package com.portfolio.leave_management;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final EmployeeService employees;
    public AuthController(AuthService auth,EmployeeService employees) { this.auth=auth; this.employees=employees; }
    @PostMapping("/login") public AuthService.Token login(@Valid @RequestBody EmployeeModels.Login r) { return auth.login(r); }
    @GetMapping("/me") public EmployeeModels.Employee me(Authentication user) { return employees.get((Long)user.getPrincipal()); }
    @PostMapping("/logout") public ResponseEntity<Void> logout(@RequestHeader("Authorization") String header) { auth.logout(header.substring(7)); return ResponseEntity.noContent().build(); }
    @PutMapping("/password") public ResponseEntity<Void> password(Authentication user,@Valid @RequestBody EmployeeModels.PasswordChange r) {
        employees.changePassword((Long)user.getPrincipal(),r); return ResponseEntity.noContent().build();
    }
}
