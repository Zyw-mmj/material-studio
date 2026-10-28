package com.example.material.template;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {
    private final TemplateService service;

    public TemplateController(TemplateService service) { this.service = service; }

    @GetMapping
    ResponseEntity<TemplateListDto> list(@RequestParam(required = false) @Size(max = 64) String category) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(category));
    }

    @GetMapping("/{id}")
    ResponseEntity<TemplateDto> get(@PathVariable @Pattern(regexp = "[a-z0-9][a-z0-9-]{0,63}") String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.get(id));
    }

    @GetMapping(value = "/{id}/cover", produces = MediaType.IMAGE_PNG_VALUE)
    ResponseEntity<Resource> cover(@PathVariable @Pattern(regexp = "[a-z0-9][a-z0-9-]{0,63}") String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .contentType(MediaType.IMAGE_PNG).body(service.cover(id));
    }
}
