package com.example.material.task;

import java.time.LocalDateTime;

public record TaskRow(
        String id,
        String userId,
        String templateId,
        String templateTitle,
        String templateSnapshot,
        String clientRequestId,
        String requestHash,
        String simulationJson,
        String status,
        String currentStep,
        String resultKey,
        String resultMimeType,
        Long resultSizeBytes,
        String errorCode,
        String errorMessage,
        long version,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt) {}
