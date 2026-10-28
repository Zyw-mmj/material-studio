package com.example.material.template.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TemplateMapper {
    List<String> selectCategories();

    List<TemplateRow> selectActive(@Param("category") String category);

    TemplateRow selectActiveById(@Param("id") String id);
}
