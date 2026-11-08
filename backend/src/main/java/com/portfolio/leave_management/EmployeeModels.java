package com.portfolio.leave_management;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.Set;

public final class EmployeeModels {
    private EmployeeModels() {}
    public enum Role { ADMIN, MANAGER, EMPLOYEE }
    public record CreateEmployee(
        @NotBlank @Size(max=50) String employeeNumber,
        @NotBlank @Size(max=200) String fullName,
        @NotBlank @Email @Size(max=320) String email,
        @NotBlank @Size(min=12, max=72) String password,
        @NotNull @Positive Long departmentId, @Positive Long managerId,
        @Size(max=150) String jobTitle, @NotNull LocalDate hireDate,
        @NotEmpty Set<@NotNull Role> roles) {
        @Override public String toString() { return "CreateEmployee[redacted]"; }
    }
    public record UpdateEmployee(
        @NotBlank @Size(max=50) String employeeNumber,
        @NotBlank @Size(max=200) String fullName,
        @NotBlank @Email @Size(max=320) String email,
        @NotNull @Positive Long departmentId, @Positive Long managerId,
        @Size(max=150) String jobTitle, @NotNull LocalDate hireDate,
        @NotNull Boolean active, @NotEmpty Set<@NotNull Role> roles) {}
    public record Employee(long id, String employeeNumber, String fullName, String email,
        long departmentId, Long managerId, String jobTitle, LocalDate hireDate,
        boolean active, Set<String> roles) {}
    public record Login(@NotBlank @Email String email, @NotBlank String password) {
        @Override public String toString() { return "Login[redacted]"; }
    }
    public record PasswordChange(@NotBlank String currentPassword,
        @NotBlank @Size(min=12,max=72) String newPassword) {
        @Override public String toString() { return "PasswordChange[redacted]"; }
    }
}
