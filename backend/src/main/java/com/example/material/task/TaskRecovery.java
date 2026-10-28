package com.example.material.task;

import com.example.material.common.ApiError;

import jakarta.servlet.*;
import jakarta.servlet.http.*;

import org.slf4j.MDC;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class TaskRecovery extends OncePerRequestFilter implements ApplicationRunner {
    private final AtomicBoolean ready = new AtomicBoolean();
    private final TaskMapper mapper;
    private final TaskStateService states;
    private final JsonMapper json;

    public TaskRecovery(TaskMapper mapper, TaskStateService states, JsonMapper json) {
        this.mapper = mapper;
        this.states = states;
        this.json = json;
    }

    @Override
    public void run(ApplicationArguments arguments) {
        while (true) {
            var ids = mapper.unfinished();
            if (ids.isEmpty()) break;
            for (String id : ids) states.fail(id, "SERVER_RESTARTED", "服务已重启，未完成任务已结束，请创建新任务");
        }
        ready.set(true);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!ready.get()
                && request.getRequestURI().startsWith("/api/")
                && !request.getRequestURI().equals("/api/health")) {
            response.setStatus(503);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Cache-Control", "no-store");
            json.writeValue(
                    response.getOutputStream(),
                    new ApiError(
                            "SERVICE_UNAVAILABLE", "服务正在准备，请稍后重试", null, MDC.get("requestId")));
            return;
        }
        chain.doFilter(request, response);
    }
}
