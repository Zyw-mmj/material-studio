package com.example.material.template;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.material.common.ApiException;
import com.example.material.template.persistence.TemplateMapper;
import com.example.material.template.persistence.TemplateRow;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import tools.jackson.databind.json.JsonMapper;

import java.util.List;

class TemplateServiceTest {
    private final TemplateMapper mapper = mock(TemplateMapper.class);
    private final TemplateService service =
            new TemplateService(mapper, JsonMapper.builder().build(), new DefaultResourceLoader());

    @Test
    void emptyCategoryIsNotAnErrorAndStillReturnsAllCategories() {
        when(mapper.selectCategories()).thenReturn(List.of("创意图片", "生活记录"));
        when(mapper.selectActive("不存在")).thenReturn(List.of());
        TemplateListDto result = service.list(" 不存在 ");
        assertThat(result.items()).isEmpty();
        assertThat(result.categories()).containsExactly("创意图片", "生活记录");
    }

    @Test
    void missingTemplateUsesBusinessError() {
        assertThatThrownBy(() -> service.get("missing"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        error -> assertThat(error.code()).isEqualTo("TEMPLATE_NOT_FOUND"));
    }

    @Test
    void mapsDatabaseConstraintsAndKeepsStorageKeysPrivate() {
        when(mapper.selectActiveById("demo-avatar"))
                .thenReturn(
                        new TemplateRow(
                                "demo-avatar",
                                "头像相框",
                                "创意图片",
                                "演示模板",
                                "demo-covers/avatar.png",
                                1,
                                "[\"image/jpeg\",\"image/png\"]",
                                5242880));
        TemplateDto result = service.get("demo-avatar");
        assertThat(result.acceptedMimeTypes()).containsExactly("image/jpeg", "image/png");
        assertThat(result.coverUrl()).isEqualTo("/api/templates/demo-avatar/cover");
        assertThat(result.requiredImageCount()).isEqualTo(1);
    }
}
