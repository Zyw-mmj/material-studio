package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.common.ApiException;
import com.example.material.identity.UserPrincipal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskCommandService commands;
    private final TaskQueryService queries;
    private final TaskDispatcher dispatcher;

    public TaskController(
            TaskCommandService commands, TaskQueryService queries, TaskDispatcher dispatcher) {
        this.commands = commands;
        this.queries = queries;
        this.dispatcher = dispatcher;
    }

    @PostMapping
    ResponseEntity<Created> create(
            @Valid @RequestBody CreateRequest request,
            @RequestHeader("Idempotency-Key") String key,
            @RequestHeader(value = "X-Demo-Control-Key", required = false) String controlKey,
            @AuthenticationPrincipal UserPrincipal user) {
        var accepted = commands.create(user.userId(), key, request, controlKey);
        try {
            if (!accepted.replayed()) dispatcher.submit(accepted.id());
            var row = queries.owned(accepted.id(), user.userId());
            return ResponseEntity.accepted()
                    .location(URI.create("/api/tasks/" + row.id()))
                    .cacheControl(CacheControl.noStore())
                    .body(
                            new Created(
                                    row.id(),
                                    row.status(),
                                    instant(row.createdAt()),
                                    accepted.replayed()));
        } catch (org.springframework.dao.DataAccessException error) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE, "SUBMISSION_UNCERTAIN", "提交结果待确认，请使用原提交标识重试");
        }
    }

    @GetMapping
    ResponseEntity<Page> list(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "ALL") @Pattern(regexp = "ALL|ACTIVE|SUCCEEDED|FAILED")
                    String status,
            @RequestParam(required = false) @Pattern(regexp = "[a-z0-9][a-z0-9-]{0,63}")
                    String templateId,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int limit,
            @RequestParam(required = false) String cursor) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(queries.page(user.userId(), status, templateId, limit, cursor));
    }

    @GetMapping("/{id}")
    ResponseEntity<Detail> detail(
            @PathVariable String id, @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(queries.detail(id, user.userId()));
    }

    @GetMapping("/{id}/result")
    ResponseEntity<Resource> result(
            @PathVariable String id, @AuthenticationPrincipal UserPrincipal user) {
        return queries.result(id, user.userId());
    }
}
