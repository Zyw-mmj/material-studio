package com.example.material.config;

import com.example.material.common.ApiError;

import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.session.*;
import org.springframework.security.web.context.*;
import org.springframework.security.web.csrf.*;

import tools.jackson.databind.json.JsonMapper;

import java.util.List;

@Configuration
public class SecurityConfig {
    @Bean
    HttpSessionCsrfTokenRepository csrfTokens() {
        return new HttpSessionCsrfTokenRepository();
    }

    @Bean
    SecurityContextRepository contexts() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SessionAuthenticationStrategy sessions(HttpSessionCsrfTokenRepository csrf) {
        return new CompositeSessionAuthenticationStrategy(
                List.of(
                        new ChangeSessionIdAuthenticationStrategy(),
                        new CsrfAuthenticationStrategy(csrf)));
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JsonMapper json,
            HttpSessionCsrfTokenRepository csrf,
            SecurityContextRepository contexts)
            throws Exception {
        http.csrf(c -> c.csrfTokenRepository(csrf))
                .securityContext(c -> c.securityContextRepository(contexts))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(
                                                HttpMethod.GET,
                                                "/api/health",
                                                "/api/auth/csrf",
                                                "/api/templates",
                                                "/api/templates/**",
                                                "/actuator/health",
                                                "/actuator/health/**")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.POST, "/api/auth/login")
                                        .permitAll()
                                        .requestMatchers("/api/**")
                                        .authenticated()
                                        .anyRequest()
                                        .denyAll())
                .logout(
                        l ->
                                l.logoutUrl("/api/auth/logout")
                                        .deleteCookies("MP_SESSION")
                                        .logoutSuccessHandler(
                                                (request, response, authentication) -> {
                                                    response.setHeader("Cache-Control", "no-store");
                                                    response.setStatus(204);
                                                }))
                .exceptionHandling(
                        errors ->
                                errors.authenticationEntryPoint(
                                                (request, response, error) ->
                                                        writeError(
                                                                response,
                                                                json,
                                                                401,
                                                                "UNAUTHENTICATED",
                                                                "请先选择演示身份"))
                                        .accessDeniedHandler(
                                                (request, response, error) ->
                                                        writeError(
                                                                response,
                                                                json,
                                                                403,
                                                                error instanceof CsrfException
                                                                        ? "CSRF_INVALID"
                                                                        : "ACCESS_DENIED",
                                                                error instanceof CsrfException
                                                                        ? "安全令牌已失效，请重新确认身份后重试"
                                                                        : "没有访问权限")));
        return http.build();
    }

    @Bean
    UserDetailsService userDetailsService() {
        return new InMemoryUserDetailsManager();
    }

    private static void writeError(
            HttpServletResponse response, JsonMapper json, int status, String code, String message)
            throws java.io.IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        json.writeValue(
                response.getOutputStream(),
                new ApiError(code, message, null, MDC.get("requestId")));
    }
}
