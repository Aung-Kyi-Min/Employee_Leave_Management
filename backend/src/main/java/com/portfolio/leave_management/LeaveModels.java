package com.portfolio.leave_management;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class LeaveModels {
    private LeaveModels() {}

    public record CreateRequest(@NotNull @Positive Long leaveTypeId,
        @NotNull LocalDate startDate, @NotNull LocalDate endDate,
        @Size(max=2000) String reason) {}
    public record Decision(@NotNull DecisionValue decision, @Size(max=2000) String comments) {}
    public enum DecisionValue { APPROVED, REJECTED }
    public record LeaveType(long id, String name, String description, boolean requiresApproval, boolean paid) {}
    public record Balance(long leaveTypeId, String leaveType, int year, BigDecimal entitledDays,
        BigDecimal carriedForwardDays, BigDecimal usedDays, BigDecimal pendingDays, BigDecimal availableDays) {}
    public record Request(long id, long employeeId, String employeeName, long leaveTypeId, String leaveType,
        LocalDate startDate, LocalDate endDate, BigDecimal totalDays, String reason, String status,
        java.time.LocalDateTime submittedAt, Long approverId, String approverName, String approvalDecision,
        String approvalComments) {}
}
