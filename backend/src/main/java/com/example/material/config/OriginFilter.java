package com.example.material.config;

import com.example.material.common.ApiError;

import jakarta.servlet.*;
import jakarta.servlet.http.*;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class OriginFilter extends OncePerRequestFilter {
    private final String origin;
    private final JsonMapper json;

    public OriginFilter(
            @Value("${app.origin:http://localhost:3001}") String origin, JsonMapper json) {
        this.origin = origin;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String supplied = request.getHeader("Origin");
        if (Set.of("POST", "PUT", "PATCH", "DELETE").contains(request.getMethod())
                && supplied != null
                && !origin.equals(supplied)) {
            response.setStatus(403);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Cache-Control", "no-store");
            json.writeValue(
                    response.getOutputStream(),
                    new ApiError("CSRF_INVALID", "请求来源不被允许", null, MDC.get("requestId")));
            return;
        }
        chain.doFilter(request, response);
    }
}
