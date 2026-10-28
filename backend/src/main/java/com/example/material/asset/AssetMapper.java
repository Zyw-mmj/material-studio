package com.example.material.asset;

import org.apache.ibatis.annotations.*;

@Mapper
public interface AssetMapper {
    @Select("SELECT * FROM assets WHERE id=#{id} AND user_id=#{userId}")
    AssetRow find(@Param("id") String id, @Param("userId") String userId);

    @Insert(
            "INSERT INTO"
                + " assets(id,user_id,storage_key,mime_type,size_bytes,width,height,sha256,created_at)"
                + " VALUES(#{id},#{userId},#{storageKey},#{mimeType},#{sizeBytes},#{width},#{height},#{sha256},#{createdAt})")
    void insert(AssetRow asset);
}
