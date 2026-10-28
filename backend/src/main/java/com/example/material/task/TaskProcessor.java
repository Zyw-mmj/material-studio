package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.common.ApiException;
import com.example.material.storage.FileStorage;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.util.List;

@Component
public class TaskProcessor {
    private final FileStorage files;
    private final TaskSleeper sleeper;

    public TaskProcessor(FileStorage files, TaskSleeper sleeper) {
        this.files = files;
        this.sleeper = sleeper;
    }

    public void stage(String id, String step, Simulation simulation) throws InterruptedException {
        sleeper.pause(id, step, simulation.delaysMs().forStep(step));
        if (step.equals(simulation.failAtStep()))
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "SIMULATED_FAILURE",
                    switch (step) {
                        case "VALIDATE" -> "素材检查阶段按测试配置触发失败";
                        case "GENERATE" -> "模拟生成阶段按测试配置触发失败";
                        default -> "结果整理阶段按测试配置触发失败";
                    });
    }

    public void validate(List<TaskInput> inputs) throws IOException {
        for (var input : inputs)
            if (!files.readable(input.storageKey())
                    || Files.size(files.path(input.storageKey())) != input.sizeBytes()
                    || !files.sha256(files.path(input.storageKey())).equals(input.sha256()))
                throw new ApiException(HttpStatus.BAD_REQUEST, "ASSET_UNAVAILABLE", "素材文件已丢失或发生变化");
    }

    public Path generate(TaskInput input) throws IOException {
        Path temp = files.temporary();
        try {
            Files.copy(files.path(input.storageKey()), temp, StandardCopyOption.REPLACE_EXISTING);
            return temp;
        } catch (IOException error) {
            files.clean(temp);
            throw error;
        }
    }
}
