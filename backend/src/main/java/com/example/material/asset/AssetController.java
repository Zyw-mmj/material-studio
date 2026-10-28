package com.example.material.asset;

import com.example.material.common.ApiException;
import com.example.material.identity.UserPrincipal;
import com.example.material.storage.FileStorage;

import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartHttpServletRequest;

@RestController
@RequestMapping("/api/assets")
public class AssetController {
    private final AssetService assets;
    private final FileStorage files;

    public AssetController(AssetService assets, FileStorage files) {
        this.assets = assets;
        this.files = files;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<AssetService.AssetDto> upload(
            MultipartHttpServletRequest request, @AuthenticationPrincipal UserPrincipal user) {
        var parts = request.getMultiFileMap();
        if (parts.size() != 1
                || !parts.containsKey("file")
                || parts.get("file").size() != 1
                || !request.getParameterMap().isEmpty())
            throw new ApiException(
                    HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "每次仅允许上传一个 file 图片字段");
        return ResponseEntity.status(201)
                .cacheControl(CacheControl.noStore())
                .body(assets.upload(parts.getFirst("file"), user.userId()));
    }

    @GetMapping("/{id}/content")
    ResponseEntity<Resource> content(
            @PathVariable String id, @AuthenticationPrincipal UserPrincipal user) {
        var asset = assets.requireOwned(id, user.userId());
        return files.content(asset.storageKey(), asset.mimeType(), "ASSET_UNAVAILABLE");
    }
}
