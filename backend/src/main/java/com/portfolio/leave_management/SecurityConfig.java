package com.portfolio.leave_management;

import java.io.IOException;
import java.util.List;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean SecurityFilterChain security(HttpSecurity http,AuthService auth,EmployeeService employees,
        @Value("${app.cors.allowed-origins:http://localhost:5173}") List<String> origins) throws Exception {
        var cors=new CorsConfiguration(); cors.setAllowedOrigins(origins);
        cors.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization","Content-Type"));
        var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/api/**",cors);
        return http.csrf(c->c.disable()).cors(c->c.configurationSource(source))
            .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .requestCache(c->c.disable()).formLogin(c->c.disable()).httpBasic(c->c.disable()).logout(c->c.disable())
            .exceptionHandling(e->e.authenticationEntryPoint((req,res,ex)->error(res,401,"Authentication required"))
                .accessDeniedHandler((req,res,ex)->error(res,403,"Access denied")))
            .authorizeHttpRequests(a->a.requestMatchers("/api/health","/api/auth/login").permitAll()
                .requestMatchers("/api/employees/**","/api/departments").hasRole("ADMIN")
                .requestMatchers("/api/leave-requests/assigned","/api/leave-requests/*/decision").hasRole("MANAGER")
                .anyRequest().authenticated())
            .addFilterBefore(new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
                    String header=req.getHeader("Authorization");
                    if(header!=null && header.startsWith("Bearer ")) {
                        Long id=auth.authenticate(header.substring(7));
                        if(id!=null) SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                            id,null,employees.roles(id).stream().map(r->new SimpleGrantedAuthority("ROLE_"+r)).toList()));
                    }
                    chain.doFilter(req,res);
                }
            },UsernamePasswordAuthenticationFilter.class).build();
    }
    private static void error(HttpServletResponse res,int status,String message) throws IOException {
        res.setStatus(status); res.setContentType("application/json");
        res.getWriter().write("{\"status\":"+status+",\"message\":\""+message+"\"}");
    }
}
