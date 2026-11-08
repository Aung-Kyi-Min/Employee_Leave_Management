# API & Service Communication Contracts

The application currently exposes one synchronous REST endpoint from a single Spring Boot service. The health contract is suitable for availability checks, but business APIs should be agreed through an explicit contract-first workflow before controllers and clients are implemented.

## Service Catalog

| Service | Port | Category | Purpose |
|---|---:|---|---|
| leave-management | 8080 | API Layer and Business | Employee leave-management REST API and database-backed business logic |

## API Endpoints Inventory

| Service | Method | Path | Request Type | Response Type |
|---|---|---|---|---|
| leave-management | GET | `/api/health` | None | JSON object with `status`, `message`, and `version`; HTTP 200 |

### Current health response

```json
{
  "status": "UP",
  "message": "Employee Leave Management API is running",
  "version": "1.0.0"
}
```

The implementation is in [HealthController.java](../../../../backend/src/main/java/com/portfolio/leave_management/HealthController.java). Because it returns `Map<String, String>`, the response shape is implicit. For business endpoints, prefer named immutable response records so accidental field changes are caught by compilation and contract tests.

## Management & Observability Endpoints

| Service | Endpoint | Custom Metrics |
|---|---|---|
| leave-management | `/api/health` | None detected |

No Spring Boot Actuator endpoints, OpenAPI/Swagger specification, or custom metrics were detected.

## DTOs & Contracts

No request or response DTO classes, OpenAPI files, protobuf schemas, or GraphQL schemas were detected. The health response is an inline map rather than a named DTO.

Recommended contract types for the next endpoints:

- `CreateLeaveRequest`: request body owned by the leave API.
- `LeaveResponse`: immutable response DTO returned to clients.
- `LeaveStatus` and `LeaveType`: enums whose serialized values must be explicitly agreed.
- `ProblemDetail` or a project-specific error envelope: consistent error response for validation, authorization, conflict, and server errors.

## Communication Patterns

- **Synchronous:** HTTP REST within one deployable service.
- **Asynchronous:** No message broker or event publication detected.
- **Resilience:** No retry, timeout, circuit-breaker, fallback, or service-discovery configuration detected.
- **Gateway:** No API gateway or aggregation layer detected.
- **Security posture:** No authentication, authorization, or TLS configuration was detected at the API contract level. Decide whether these are enforced by the application, an ingress, or both before exposing business endpoints.
- **Persistence boundary:** PostgreSQL is configured behind the service. Database details should remain behind the API contract and should not leak into request/response models.

## How to Agree on the API Contract

Use one short contract review for each endpoint or cohesive resource:

1. **User story and workflow:** agree who calls the endpoint, the business action, valid states, and what happens on rejection or duplicate submission.
2. **Resource and naming:** agree the URL, HTTP method, path/query parameters, identifier format, pagination, and whether the endpoint is idempotent.
3. **Request/response schema:** agree required fields, enum values, nullability, date/time format, field naming, and immutable response DTOs.
4. **Status and errors:** agree success status, validation errors, authentication/authorization failures, not-found behavior, conflicts, and a stable error envelope.
5. **Security and privacy:** agree required roles/scopes, ownership checks, sensitive fields, audit requirements, and transport security.
6. **Operational behavior:** agree timeout, retry ownership, rate limits, correlation/request IDs, health/readiness behavior, and observability fields.
7. **Compatibility:** agree versioning rules, additive-change policy, deprecation period, and consumer-impact testing.
8. **Examples and acceptance tests:** add happy-path, invalid-input, unauthorized, not-found, conflict, and retry/idempotency examples.

The contract is approved only when product/business owner, API owner, client/consumer owner, security reviewer, and operations owner agree. Record unresolved decisions as explicit assumptions rather than silently encoding them in a controller.

## Recommended Contract Review Workflow

```text
User story
  -> workflow/state review
  -> OpenAPI contract draft + examples
  -> consumer and security review
  -> contract tests agreed
  -> implementation
  -> provider/consumer CI verification
  -> versioned release and change log
```

Keep the source of truth in a versioned `openapi.yaml` (or generated equivalent), then verify the implementation against it with provider tests. Consumer teams should run consumer-driven tests against the same contract. A pull request changing the contract should include the reason, compatibility impact, migration notes, and updated examples.

## Service Communication Sequence

<!-- mermaid-checked: every participant uses `participant Id as "Label"`, no \n in aliases/messages/notes, every alt/opt/loop closed by end, no `:` inside any alias -->
~~~mermaid
sequenceDiagram
    participant Client as "Monitoring Client"
    participant Api as "Leave Management API"
    participant App as "Spring Application"
    Client->>Api: GET /api/health
    Api->>App: Invoke health()
    App-->>Api: Health response map
    Api-->>Client: 200 HealthResponse
~~~

## Contract Decisions to Make Next

| Decision | Recommended default |
|---|---|
| Business API specification | Versioned OpenAPI 3 document |
| Response models | Java records or immutable DTOs |
| Errors | RFC 9457 Problem Details with stable application error codes |
| Dates and times | ISO-8601; UTC for instants |
| Versioning | Backward-compatible additive changes first; explicit `/v1` only when breaking changes are unavoidable |
| Idempotency | Idempotency key for leave creation if clients may retry submissions |
| Workflow state | Explicit state machine, for example `DRAFT -> SUBMITTED -> APPROVED/REJECTED/CANCELLED` |
| Testing | Provider contract tests plus consumer examples in CI |

## Error Handling

No error envelope or exception mapping was detected. Before adding business endpoints, define a single error shape and map at least `400`, `401`, `403`, `404`, `409`, `422`, and `500` consistently. Keep internal database and stack-trace details out of responses while logging a correlation ID for supportability.
