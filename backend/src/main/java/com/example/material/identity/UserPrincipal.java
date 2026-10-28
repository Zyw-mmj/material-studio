package com.example.material.identity;

import java.io.Serializable;
import java.security.Principal;

public record UserPrincipal(String userId, String displayName) implements Principal, Serializable {
    @Override
    public String getName() {
        return userId;
    }
}
