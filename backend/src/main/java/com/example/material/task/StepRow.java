package com.example.material.task;

import java.time.LocalDateTime;

public record StepRow(
        String taskId,
        String stepName,
        int stepOrder,
        String status,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        String errorCode,
        String errorMessage) {}
