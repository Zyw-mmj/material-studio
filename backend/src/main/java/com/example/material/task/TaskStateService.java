package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;

@Service
public class TaskStateService {
    private final TaskMapper mapper;
    private final TransactionTemplate tx;
    private final Clock clock;

    public TaskStateService(TaskMapper mapper, TransactionTemplate tx, Clock clock) {
        this.mapper = mapper;
        this.tx = tx;
        this.clock = clock;
    }

    public boolean claim(String id) {
        return Boolean.TRUE.equals(
                tx.execute(
                        status -> {
                            TaskRow row = mapper.lock(id);
                            if (row == null || !row.status().equals("QUEUED")) return false;
                            LocalDateTime now = LocalDateTime.now(clock);
                            requireOne(mapper.claim(id, now));
                            requireOne(mapper.startStep(id, "VALIDATE", now));
                            return true;
                        }));
    }

    public boolean advance(String id, String current, String next) {
        return Boolean.TRUE.equals(
                tx.execute(
                        status -> {
                            TaskRow row = mapper.lock(id);
                            if (row == null || terminal(row.status())) return false;
                            if (!row.status().equals("RUNNING")
                                    || !current.equals(row.currentStep()))
                                throw new IllegalStateException("Invalid stage boundary");
                            LocalDateTime now = LocalDateTime.now(clock);
                            requireOne(mapper.finishStep(id, current, now));
                            requireOne(mapper.startStep(id, next, now));
                            mapper.progress(id, next, now);
                            return true;
                        }));
    }

    public boolean complete(String id, String key, String mime, long size) {
        return Boolean.TRUE.equals(
                tx.execute(
                        status -> {
                            TaskRow row = mapper.lock(id);
                            if (row == null || terminal(row.status())) return false;
                            if (!"FINALIZE".equals(row.currentStep()))
                                throw new IllegalStateException("Invalid completion boundary");
                            LocalDateTime now = LocalDateTime.now(clock);
                            requireOne(mapper.finishStep(id, "FINALIZE", now));
                            mapper.complete(id, key, mime, size, now);
                            return true;
                        }));
    }

    public void fail(String id, String code, String message) {
        tx.executeWithoutResult(
                status -> {
                    TaskRow row = mapper.lock(id);
                    if (row == null || terminal(row.status())) return;
                    LocalDateTime now = LocalDateTime.now(clock);
                    mapper.failStep(id, code, message, now);
                    mapper.skipSteps(id);
                    mapper.fail(id, code, message, now);
                });
    }

    private void requireOne(int rows) {
        if (rows != 1) throw new IllegalStateException("Concurrent stage transition rejected");
    }
}
