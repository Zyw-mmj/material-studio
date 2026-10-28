package com.example.material.task;

import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

import java.util.concurrent.RejectedExecutionException;

@Component
public class TaskDispatcher {
    private final ThreadPoolTaskExecutor executor;
    private final TaskWorker worker;
    private final TaskStateService states;

    public TaskDispatcher(
            ThreadPoolTaskExecutor executor, TaskWorker worker, TaskStateService states) {
        this.executor = executor;
        this.worker = worker;
        this.states = states;
    }

    public void submit(String id) {
        try {
            executor.execute(() -> worker.run(id));
        } catch (RejectedExecutionException error) {
            states.fail(id, "EXECUTOR_REJECTED", "当前任务过多，请稍后创建新任务");
        }
    }
}
