package com.example.material.task;

import static com.example.material.task.TaskModels.*;

import com.example.material.common.ApiException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
public class SimulationSettings {
    private final Simulation defaults;
    private final boolean override;
    private final String key;

    public SimulationSettings(
            @Value("${sim.validate-delay-ms:1000}") int validate,
            @Value("${sim.generate-delay-ms:5000}") int generate,
            @Value("${sim.finalize-delay-ms:1000}") int finalizeMs,
            @Value("${sim.fail-at-step:NONE}") String fail,
            @Value("${demo.simulation-override-enabled:false}") boolean override,
            @Value("${demo.control-key:}") String key) {
        if (validate < 0
                || validate > 30000
                || generate < 0
                || generate > 30000
                || finalizeMs < 0
                || finalizeMs > 30000
                || !(fail.equals("NONE") || STEPS.contains(fail)))
            throw new IllegalArgumentException("Invalid simulation configuration");
        if (override && key.isBlank())
            throw new IllegalArgumentException("DEMO_CONTROL_KEY required when overrides enabled");
        this.defaults =
                new Simulation(
                        fail.equals("NONE") ? null : fail,
                        new Delays(validate, generate, finalizeMs));
        this.override = override;
        this.key = key;
    }

    public Simulation resolve(Simulation requested, String suppliedKey) {
        if (requested == null) return defaults;
        if (!override)
            throw new ApiException(HttpStatus.BAD_REQUEST, "SIMULATION_DISABLED", "当前环境未开启单任务模拟覆盖");
        if (suppliedKey == null
                || !MessageDigest.isEqual(
                        key.getBytes(StandardCharsets.UTF_8),
                        suppliedKey.getBytes(StandardCharsets.UTF_8)))
            throw new ApiException(HttpStatus.FORBIDDEN, "DEMO_CONTROL_FORBIDDEN", "没有模拟配置权限");
        return requested;
    }
}
