package com.example.material.identity;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserMapper {
    @Select("SELECT id AS user_id, display_name FROM users WHERE id = #{id}")
    UserPrincipal find(String id);
}
