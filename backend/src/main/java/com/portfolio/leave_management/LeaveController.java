package com.portfolio.leave_management;

import static com.portfolio.leave_management.LeaveModels.*;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class LeaveController {
    private final LeaveService leaves;
    public LeaveController(LeaveService leaves) { this.leaves=leaves; }

    @GetMapping("/leave-types") public List<LeaveType> types() { return leaves.types(); }
    @GetMapping("/leave-balances") public List<Balance> balances(Authentication user,@RequestParam(required=false) Integer year) {
        return leaves.balances((Long)user.getPrincipal(),year);
    }
    @PostMapping("/leave-requests") public ResponseEntity<Request> create(Authentication user,@Valid @RequestBody CreateRequest request) {
        Request created=leaves.create((Long)user.getPrincipal(),request);
        return ResponseEntity.created(java.net.URI.create("/api/leave-requests/"+created.id())).body(created);
    }
    @GetMapping("/leave-requests") public List<Request> mine(Authentication user) { return leaves.mine((Long)user.getPrincipal()); }
    @GetMapping("/leave-requests/assigned") public List<Request> assigned(Authentication user) { return leaves.assigned((Long)user.getPrincipal()); }
    @PostMapping("/leave-requests/{id}/decision") public Request decide(Authentication user,@PathVariable long id,@Valid @RequestBody Decision decision) {
        return leaves.decide((Long)user.getPrincipal(),id,decision);
    }
    @PostMapping("/leave-requests/{id}/cancel") public ResponseEntity<Void> cancel(Authentication user,@PathVariable long id) {
        leaves.cancel((Long)user.getPrincipal(),id); return ResponseEntity.noContent().build();
    }
}
