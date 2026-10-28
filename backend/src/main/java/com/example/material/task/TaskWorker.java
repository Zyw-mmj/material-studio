package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.common.ApiException;
import com.example.material.storage.FileStorage;

import org.slf4j.*;
import org.springframework.stereotype.Component;

import tools.jackson.databind.json.JsonMapper;

import java.nio.file.*;

@Component
public class TaskWorker {
    private static final Logger LOG = LoggerFactory.getLogger(TaskWorker.class);
    private final TaskMapper mapper;
    private final TaskStateService states;
    private final TaskProcessor processor;
    private final FileStorage files;
    private final JsonMapper json;

    public TaskWorker(
            TaskMapper mapper,
            TaskStateService states,
            TaskProcessor processor,
            FileStorage files,
            JsonMapper json) {
        this.mapper = mapper;
        this.states = states;
        this.processor = processor;
        this.files = files;
        this.json = json;
    }

    public void run(String id) {
        Path temp = null;
        try {
            if (!states.claim(id)) return;
            TaskRow row = mapper.find(id);
            var inputs = mapper.inputs(id);
            var simulation = json.readValue(row.simulationJson(), Simulation.class);
            for (int i = 0; i < STEPS.size(); i++) {
                String step = STEPS.get(i);
                long started = System.nanoTime();
                LOG.info("taskId={} userId={} step={} event=started", id, row.userId(), step);
                processor.stage(id, step, simulation);
                switch (step) {
                    case "VALIDATE" -> {
                        if (inputs.isEmpty())
                            throw new IllegalStateException("Missing task inputs");
                        processor.validate(inputs);
                    }
                    case "GENERATE" -> temp = processor.generate(inputs.getFirst());
                    case "FINALIZE" -> {
                        String mime = inputs.getFirst().mimeType();
                        String key =
                                "results/"
                                        + row.userId()
                                        + "/"
                                        + id
                                        + (mime.equals("image/png") ? ".png" : ".jpg");
                        files.publish(temp, key);
                        temp = null;
                        if (!files.readable(key))
                            throw new java.io.IOException("Result not readable");
                        states.complete(id, key, mime, Files.size(files.path(key)));
                    }
                    default -> throw new IllegalStateException("Unknown step");
                }
                LOG.info(
                        "taskId={} step={} event=succeeded durationMs={}",
                        id,
                        step,
                        (System.nanoTime() - started) / 1000000);
                if (i < 2 && !states.advance(id, step, STEPS.get(i + 1))) return;
            }
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            failure(id, "EXECUTION_INTERRUPTED", "服务停止，制作任务已中断", error);
        } catch (ApiException error) {
            failure(id, error.code(), error.getMessage(), error);
        } catch (Exception error) {
            failure(id, "STEP_EXECUTION_FAILED", "制作过程中发生异常，请稍后再试", error);
        } finally {
            files.clean(temp);
        }
    }

    private void failure(String id, String code, String message, Exception cause) {
        LOG.warn("taskId={} event=failed errorCode={}", id, code);
        if (!(cause instanceof ApiException))
            LOG.error("Task processing error, taskId=" + id, cause);
        try {
            states.fail(id, code, message);
        } catch (Exception dbError) {
            LOG.error("Could not persist failure, taskId=" + id, dbError);
        }
    }
}
