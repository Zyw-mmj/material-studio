package com.example.material.identity;

import com.example.material.common.ApiException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserMapper users;
    private final SecurityContextRepository contexts;
    private final SessionAuthenticationStrategy sessions;

    public AuthController(
            UserMapper users,
            SecurityContextRepository contexts,
            SessionAuthenticationStrategy sessions) {
        this.users = users;
        this.contexts = contexts;
        this.sessions = sessions;
    }

    public record LoginRequest(
            @Pattern(regexp = "demo-[ab]") @jakarta.validation.constraints.NotNull
                    String demoUserId) {}

    public record Identity(String userId, String displayName, String mode) {}

    public record CsrfResponse(String token, String headerName) {}

    @GetMapping("/csrf")
    ResponseEntity<CsrfResponse> csrf(CsrfToken token) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(new CsrfResponse(token.getToken(), token.getHeaderName()));
    }

    @PostMapping("/login")
    ResponseEntity<Identity> login(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        UserPrincipal user = users.find(body.demoUserId());
        if (user == null)
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "演示身份不存在");
        var authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        user, null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        sessions.onAuthentication(authentication, request, response);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(identity(user));
    }

    @GetMapping("/me")
    ResponseEntity<Identity> me(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(identity(user));
    }

    private Identity identity(UserPrincipal user) {
        return new Identity(user.userId(), user.displayName(), "DEMO");
    }
}
