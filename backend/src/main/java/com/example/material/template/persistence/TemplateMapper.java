package com.example.material.template.persistence;

import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TemplateMapper {
    List<String> selectCategories();
    List<TemplateRow> selectActive(@Param("category") String category);
    TemplateRow selectActiveById(@Param("id") String id);
}
