package com.example.material.task;

@FunctionalInterface
public interface TaskSleeper {
    void pause(String taskId, String step, long milliseconds) throws InterruptedException;
}
