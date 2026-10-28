package com.example.material.task;

public record TaskInput(
        String assetId,
        int position,
        String storageKey,
        String mimeType,
        long sizeBytes,
        String sha256) {}
