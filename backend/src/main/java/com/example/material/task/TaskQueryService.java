package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.common.ApiException;
import com.example.material.storage.FileStorage;

import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Service
public class TaskQueryService {
    private final TaskMapper mapper;
    private final FileStorage files;
    private final JsonMapper json;

    public TaskQueryService(TaskMapper mapper, FileStorage files, JsonMapper json) {
        this.mapper = mapper;
        this.files = files;
        this.json = json;
    }

    public TaskRow owned(String id, String userId) {
        TaskRow row = mapper.owned(id, userId);
        if (row == null)
            throw new ApiException(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "任务不存在或不可访问");
        return row;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Detail detail(String id, String userId) {
        TaskRow row = owned(id, userId);
        var inputs =
                mapper.inputs(id).stream()
                        .map(
                                a ->
                                        new Input(
                                                a.assetId(),
                                                a.position(),
                                                "/api/assets/" + a.assetId() + "/content"))
                        .toList();
        var steps =
                mapper.steps(id).stream()
                        .map(
                                s ->
                                        new Step(
                                                s.stepName(),
                                                s.stepOrder(),
                                                s.status(),
                                                instant(s.startedAt()),
                                                instant(s.finishedAt()),
                                                s.errorCode(),
                                                s.errorMessage()))
                        .toList();
        return new Detail(
                row.id(),
                row.templateId(),
                row.templateTitle(),
                row.status(),
                row.currentStep(),
                resultUrl(row),
                row.errorCode(),
                row.errorMessage(),
                row.version(),
                instant(row.createdAt()),
                instant(row.updatedAt()),
                instant(row.startedAt()),
                instant(row.finishedAt()),
                inputs,
                steps);
    }

    @Transactional(readOnly = true)
    public Page page(String userId, String status, String templateId, int limit, String encoded) {
        Cursor cursor = null;
        if (encoded != null) {
            try {
                if (encoded.length() > 1024) throw new IllegalArgumentException();
                cursor =
                        json.readValue(
                                new String(
                                        Base64.getUrlDecoder().decode(encoded),
                                        StandardCharsets.UTF_8),
                                Cursor.class);
                if (cursor.createdAt() == null || cursor.id() == null || cursor.id().length() != 36)
                    throw new IllegalArgumentException();
                UUID.fromString(cursor.id());
            } catch (RuntimeException error) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CURSOR", "分页游标无效，请重新加载历史");
            }
        }
        var rows =
                mapper.list(
                        userId,
                        status,
                        templateId,
                        cursor == null
                                ? null
                                : LocalDateTime.ofInstant(cursor.createdAt(), ZoneOffset.UTC),
                        cursor == null ? null : cursor.id(),
                        limit + 1);
        boolean more = rows.size() > limit;
        var shown = more ? rows.subList(0, limit) : rows;
        String next = null;
        if (more) {
            TaskRow last = shown.getLast();
            next =
                    Base64.getUrlEncoder()
                            .withoutPadding()
                            .encodeToString(
                                    json.writeValueAsBytes(
                                            new Cursor(instant(last.createdAt()), last.id())));
        }
        return new Page(shown.stream().map(this::summary).toList(), next);
    }

    public ResponseEntity<Resource> result(String id, String userId) {
        TaskRow row = owned(id, userId);
        if (!row.status().equals("SUCCEEDED"))
            throw new ApiException(HttpStatus.CONFLICT, "RESULT_NOT_READY", "任务尚未成功完成");
        return files.content(row.resultKey(), row.resultMimeType(), "RESULT_UNAVAILABLE");
    }

    private String resultUrl(TaskRow row) {
        return row.status().equals("SUCCEEDED") ? "/api/tasks/" + row.id() + "/result" : null;
    }

    private Summary summary(TaskRow row) {
        return new Summary(
                row.id(),
                row.templateId(),
                row.templateTitle(),
                row.status(),
                row.currentStep(),
                resultUrl(row),
                row.errorCode(),
                row.errorMessage(),
                row.version(),
                instant(row.createdAt()),
                instant(row.updatedAt()),
                instant(row.startedAt()),
                instant(row.finishedAt()));
    }
}
