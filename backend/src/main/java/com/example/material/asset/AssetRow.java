package com.example.material.asset;

import java.time.LocalDateTime;

public record AssetRow(
        String id,
        String userId,
        String storageKey,
        String mimeType,
        long sizeBytes,
        int width,
        int height,
        String sha256,
        LocalDateTime createdAt) {}
