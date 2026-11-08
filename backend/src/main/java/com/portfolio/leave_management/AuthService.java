package com.portfolio.leave_management;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AuthService {
    private final JdbcTemplate db;
    private final PasswordEncoder passwords;
    private final EmployeeService employees;
    private final String dummy;
    public AuthService(JdbcTemplate db,PasswordEncoder passwords,EmployeeService employees) {
        this.db=db; this.passwords=passwords; this.employees=employees; this.dummy=passwords.encode(UUID.randomUUID().toString());
    }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    public record Token(String accessToken,String tokenType,Instant expiresAt,EmployeeModels.Employee employee) {
        @Override public String toString() { return "Token[redacted]"; }
    }
    @Transactional
    public Token login(EmployeeModels.Login r) {
        var rows=db.queryForList("SELECT employee_id,password_hash,is_active FROM employees WHERE LOWER(email)=?",r.email().trim().toLowerCase(Locale.ROOT));
        String encoded=rows.isEmpty()?dummy:(String)rows.getFirst().get("password_hash");
        boolean matches=passwords.matches(r.password(),encoded);
        if(rows.isEmpty() || !matches || !Boolean.TRUE.equals(rows.getFirst().get("is_active")))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid email or password");
        long id=((Number)rows.getFirst().get("employee_id")).longValue();
        byte[] bytes=new byte[32]; new SecureRandom().nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expiry=Instant.now().plus(Duration.ofHours(8));
        db.update("DELETE FROM auth_tokens WHERE expires_at<=CURRENT_TIMESTAMP");
        db.update("INSERT INTO auth_tokens(token_hash,employee_id,expires_at) VALUES (?,?,?)",hash(token),id,java.sql.Timestamp.from(expiry));
        return new Token(token,"Bearer",expiry,employees.get(id));
    }
    public Long authenticate(String token) {
        if(token.length()>256) return null;
        var ids=db.queryForList("SELECT t.employee_id FROM auth_tokens t JOIN employees e ON e.employee_id=t.employee_id WHERE t.token_hash=? AND t.expires_at>CURRENT_TIMESTAMP AND e.is_active=TRUE",Long.class,hash(token));
        return ids.isEmpty()?null:ids.getFirst();
    }
    public void logout(String token) { db.update("DELETE FROM auth_tokens WHERE token_hash=?",hash(token)); }
}
