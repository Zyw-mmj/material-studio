package com.example.material.task;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

@Configuration
public class TaskRuntime {
    @Bean
    TaskSleeper taskSleeper() {
        return (id, step, ms) -> Thread.sleep(ms);
    }

    @Bean
    ThreadPoolTaskExecutor generationExecutor(
            @Value("${task.executor-threads:2}") int threads,
            @Value("${task.executor-queue-capacity:20}") int capacity) {
        if (threads < 1 || threads > 16 || capacity < 0 || capacity > 1000)
            throw new IllegalArgumentException("Invalid executor configuration");
        var pool =
                new ThreadPoolTaskExecutor() {
                    @Override
                    public void shutdown() {
                        super.shutdown();
                        getThreadPoolExecutor().shutdownNow();
                    }
                };
        pool.setCorePoolSize(threads);
        pool.setMaxPoolSize(threads);
        pool.setQueueCapacity(capacity);
        pool.setThreadNamePrefix("material-task-");
        pool.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        pool.setWaitForTasksToCompleteOnShutdown(true);
        pool.setAwaitTerminationSeconds(30);
        return pool;
    }
}
