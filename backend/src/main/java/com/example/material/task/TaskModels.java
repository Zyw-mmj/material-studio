package com.example.material.task;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.*;
import java.util.List;

public final class TaskModels {
    private TaskModels() {}

    public static final List<String> STEPS = List.of("VALIDATE", "GENERATE", "FINALIZE");

    public static boolean terminal(String status) {
        return status.equals("SUCCEEDED") || status.equals("FAILED");
    }

    public record Delays(
            @NotNull @Min(0) @Max(30000) Integer validate,
            @NotNull @Min(0) @Max(30000) Integer generate,
            @JsonProperty("finalize") @NotNull @Min(0) @Max(30000) Integer finalizeMs) {
        public int forStep(String step) {
            return switch (step) {
                case "VALIDATE" -> validate;
                case "GENERATE" -> generate;
                default -> finalizeMs;
            };
        }
    }

    public record Simulation(
            @JsonProperty(required = true) @Pattern(regexp = "VALIDATE|GENERATE|FINALIZE")
                    String failAtStep,
            @NotNull @Valid Delays delaysMs) {}

    public record CreateRequest(
            @NotBlank @Pattern(regexp = "[a-z0-9][a-z0-9-]{0,63}") String templateId,
            @NotNull @Size(min = 1, max = 2)
                    List<
                                    @NotNull
                                    @Pattern(
                                            regexp =
                                                    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
                                    String>
                            assetIds,
            @Valid Simulation simulation) {}

    public record Created(String taskId, String status, Instant createdAt, boolean replayed) {}

    public record Step(
            String name,
            int order,
            String status,
            Instant startedAt,
            Instant finishedAt,
            String errorCode,
            String errorMessage) {}

    public record Input(String assetId, int position, String previewUrl) {}

    public record Summary(
            String taskId,
            String templateId,
            String templateTitle,
            String status,
            String currentStep,
            String resultUrl,
            String errorCode,
            String errorMessage,
            long version,
            Instant createdAt,
            Instant updatedAt,
            Instant startedAt,
            Instant finishedAt) {}

    public record Detail(
            String taskId,
            String templateId,
            String templateTitle,
            String status,
            String currentStep,
            String resultUrl,
            String errorCode,
            String errorMessage,
            long version,
            Instant createdAt,
            Instant updatedAt,
            Instant startedAt,
            Instant finishedAt,
            List<Input> assets,
            List<Step> steps) {}

    public record Page(List<Summary> items, String nextCursor) {}

    public record Cursor(Instant createdAt, String id) {}

    public static Instant instant(LocalDateTime value) {
        return value == null ? null : value.toInstant(ZoneOffset.UTC);
    }
}
