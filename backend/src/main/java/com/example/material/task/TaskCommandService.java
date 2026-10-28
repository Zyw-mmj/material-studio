package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.asset.*;
import com.example.material.common.ApiException;
import com.example.material.storage.FileStorage;
import com.example.material.template.*;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;

@Service
public class TaskCommandService {
    private final TaskMapper mapper;
    private final AssetService assets;
    private final FileStorage files;
    private final TemplateService templates;
    private final JsonMapper json;
    private final TransactionTemplate transactions;
    private final SimulationSettings settings;
    private final Clock clock;

    public TaskCommandService(
            TaskMapper mapper,
            AssetService assets,
            FileStorage files,
            TemplateService templates,
            JsonMapper json,
            TransactionTemplate transactions,
            SimulationSettings settings,
            Clock clock) {
        this.mapper = mapper;
        this.assets = assets;
        this.files = files;
        this.templates = templates;
        this.json = json;
        this.transactions = transactions;
        this.settings = settings;
        this.clock = clock;
    }

    public record Accepted(String id, boolean replayed) {}

    public Accepted create(String userId, String key, CreateRequest request, String controlKey) {
        String canonical;
        try {
            if (key.length() != 36) throw new IllegalArgumentException();
            canonical = UUID.fromString(key).toString();
        } catch (IllegalArgumentException error) {
            throw bad("INVALID_REQUEST", "Idempotency-Key 必须是 UUID");
        }
        Simulation simulation = settings.resolve(request.simulation(), controlKey);
        String hash = hash(json.writeValueAsString(request));
        try {
            return transactions.execute(
                    tx -> {
                        TaskRow existing = mapper.byRequest(userId, canonical);
                        if (existing != null) return replay(existing, hash);
                        TemplateDto template = templates.get(request.templateId());
                        if (request.assetIds().size() != template.requiredImageCount())
                            throw bad(
                                    "INVALID_ASSET_COUNT",
                                    "当前模板需要 " + template.requiredImageCount() + " 张图片");
                        if (new HashSet<>(request.assetIds()).size() != request.assetIds().size())
                            throw bad("DUPLICATE_ASSET", "同一任务不能重复使用同一个素材");
                        for (String id : request.assetIds()) {
                            AssetRow asset = assets.requireOwned(id, userId);
                            if (!template.acceptedMimeTypes().contains(asset.mimeType())
                                    || asset.sizeBytes() > template.maxFileSizeBytes())
                                throw bad("ASSET_CONSTRAINT_VIOLATION", "素材不符合当前模板的格式或大小要求");
                            if (!files.readable(asset.storageKey()))
                                throw new ApiException(
                                        HttpStatus.SERVICE_UNAVAILABLE,
                                        "ASSET_UNAVAILABLE",
                                        "素材暂不可用，请重新上传");
                        }
                        String id = UUID.randomUUID().toString();
                        LocalDateTime now = LocalDateTime.now(clock);
                        mapper.insert(
                                new TaskRow(
                                        id,
                                        userId,
                                        template.id(),
                                        template.title(),
                                        json.writeValueAsString(template),
                                        canonical,
                                        hash,
                                        json.writeValueAsString(simulation),
                                        "QUEUED",
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        null,
                                        0,
                                        now,
                                        now,
                                        null,
                                        null));
                        for (int i = 0; i < STEPS.size(); i++) mapper.step(id, STEPS.get(i), i + 1);
                        for (int i = 0; i < request.assetIds().size(); i++)
                            mapper.input(id, userId, request.assetIds().get(i), i + 1);
                        return new Accepted(id, false);
                    });
        } catch (DuplicateKeyException error) {
            TaskRow existing = mapper.byRequest(userId, canonical);
            if (existing == null) throw error;
            return replay(existing, hash);
        }
    }

    private Accepted replay(TaskRow row, String hash) {
        if (!hash.equals(row.requestHash()))
            throw new ApiException(HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "此提交标识已用于另一份制作参数");
        return new Accepted(row.id(), true);
    }

    private String hash(String value) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
