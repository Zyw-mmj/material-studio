package com.example.material.template;

import com.example.material.common.ApiException;
import com.example.material.template.persistence.TemplateMapper;
import com.example.material.template.persistence.TemplateRow;

import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

@Service
public class TemplateService {
    private final TemplateMapper mapper;
    private final JsonMapper json;
    private final ResourceLoader resources;

    public TemplateService(TemplateMapper mapper, JsonMapper json, ResourceLoader resources) {
        this.mapper = mapper;
        this.json = json;
        this.resources = resources;
    }

    @Transactional(readOnly = true)
    public TemplateListDto list(String category) {
        String filter = category == null ? null : category.strip();
        return new TemplateListDto(
                mapper.selectCategories(),
                mapper.selectActive(filter).stream().map(this::toDto).toList());
    }

    @Transactional(readOnly = true)
    public TemplateDto get(String id) {
        return toDto(requireTemplate(id));
    }

    @Transactional(readOnly = true)
    public Resource cover(String id) {
        TemplateRow row = requireTemplate(id);
        if (!row.coverKey().matches("demo-covers/[a-z-]+\\.png")) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "COVER_UNAVAILABLE", "模板封面暂不可用");
        }
        Resource resource = resources.getResource("classpath:" + row.coverKey());
        if (!resource.exists() || !resource.isReadable()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "COVER_UNAVAILABLE", "模板封面暂不可用");
        }
        return resource;
    }

    private TemplateRow requireTemplate(String id) {
        TemplateRow row = mapper.selectActiveById(id);
        if (row == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "TEMPLATE_NOT_FOUND", "模板不存在或已下架");
        }
        return row;
    }

    private TemplateDto toDto(TemplateRow row) {
        List<String> types = json.readValue(row.acceptedMimeTypesJson(), new TypeReference<>() {});
        return new TemplateDto(
                row.id(),
                row.title(),
                row.category(),
                "/api/templates/" + row.id() + "/cover",
                row.description(),
                row.requiredImageCount(),
                types,
                row.maxFileSizeBytes());
    }
}
