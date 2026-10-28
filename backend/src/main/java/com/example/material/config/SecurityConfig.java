package com.example.material.config;

import com.example.material.common.ApiError;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JsonMapper json) throws Exception {
        // Only implemented read APIs are open. Private APIs will add session ownership checks.
        http.csrf(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/templates", "/api/templates/**",
                                "/actuator/health", "/actuator/health/**").permitAll()
                        .anyRequest().denyAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                writeError(response, json, 401, "UNAUTHENTICATED", "请先选择演示身份"))
                        .accessDeniedHandler((request, response, exception) ->
                                writeError(response, json, 403, "ACCESS_DENIED", "当前接口尚未开放")));
        return http.build();
    }

    @Bean
    UserDetailsService userDetailsService() {
        // Avoid a generated default password. Session login is a later implementation step.
        return new InMemoryUserDetailsManager();
    }

    private static void writeError(HttpServletResponse response, JsonMapper json, int status,
                                   String code, String message) throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        json.writeValue(response.getOutputStream(), new ApiError(code, message, null, MDC.get("requestId")));
    }
}
