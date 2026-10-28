package com.example.material.template.persistence;

public record TemplateRow(String id, String title, String category, String description, String coverKey,
                          int requiredImageCount, String acceptedMimeTypesJson, long maxFileSizeBytes) {
}
