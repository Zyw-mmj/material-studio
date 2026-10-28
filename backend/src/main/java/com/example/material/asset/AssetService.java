package com.example.material.asset;

import com.example.material.common.ApiException;
import com.example.material.storage.FileStorage;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;

import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;

@Service
public class AssetService {
    public static final long MAX_BYTES = 5242880;
    private final AssetMapper mapper;
    private final FileStorage storage;
    private final Clock clock;
    private final TransactionTemplate transactions;

    public AssetService(
            AssetMapper mapper,
            FileStorage storage,
            Clock clock,
            TransactionTemplate transactions) {
        this.mapper = mapper;
        this.storage = storage;
        this.clock = clock;
        this.transactions = transactions;
    }

    public record AssetDto(
            String assetId,
            String previewUrl,
            String mimeType,
            long sizeBytes,
            int width,
            int height) {}

    public AssetDto upload(MultipartFile file, String userId) {
        if (file.isEmpty()) throw bad("INVALID_IMAGE", "请选择非空图片");
        if (file.getSize() > MAX_BYTES)
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "单张图片不能超过 5 MiB");
        Path temp = null;
        try {
            temp = storage.temporary();
            try (InputStream in = file.getInputStream();
                    OutputStream out = Files.newOutputStream(temp)) {
                byte[] bytes = new byte[8192];
                long total = 0;
                int n;
                while ((n = in.read(bytes)) != -1) {
                    total += n;
                    if (total > MAX_BYTES)
                        throw new ApiException(
                                HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "单张图片不能超过 5 MiB");
                    out.write(bytes, 0, n);
                }
            }
            byte[] signature;
            try (InputStream in = Files.newInputStream(temp)) {
                signature = in.readNBytes(8);
            }
            String mime =
                    signature.length >= 8
                                    && Arrays.equals(
                                            signature,
                                            new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10})
                            ? "image/png"
                            : signature.length >= 3
                                            && (signature[0] & 255) == 255
                                            && (signature[1] & 255) == 216
                                            && (signature[2] & 255) == 255
                                    ? "image/jpeg"
                                    : null;
            String declared = file.getContentType();
            if (mime == null || !mime.equals(declared))
                throw new ApiException(
                        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "UNSUPPORTED_IMAGE_TYPE",
                        "仅支持内容与类型一致的 JPEG 或 PNG 图片");
            int width, height;
            try (ImageInputStream input = ImageIO.createImageInputStream(temp.toFile())) {
                Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw bad("INVALID_IMAGE", "图片无法解码");
                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    width = reader.getWidth(0);
                    height = reader.getHeight(0);
                    if (width < 1
                            || height < 1
                            || width > 8192
                            || height > 8192
                            || (long) width * height > 25000000)
                        throw bad("IMAGE_DIMENSIONS_EXCEEDED", "图片尺寸过大（最大 8192 边长 / 2500 万像素）");
                    if (reader.read(0) == null) throw bad("INVALID_IMAGE", "图片无法解码");
                } catch (javax.imageio.IIOException error) {
                    throw bad("INVALID_IMAGE", "图片已损坏或无法解码");
                } finally {
                    reader.dispose();
                }
            }
            String id = UUID.randomUUID().toString();
            String key =
                    "uploads/" + userId + "/" + id + (mime.equals("image/png") ? ".png" : ".jpg");
            long size = Files.size(temp);
            String hash = storage.sha256(temp);
            storage.publish(temp, key);
            temp = null;
            AssetRow row =
                    new AssetRow(
                            id,
                            userId,
                            key,
                            mime,
                            size,
                            width,
                            height,
                            hash,
                            LocalDateTime.now(clock));
            // On an uncertain DB commit preserve the file; an orphan is safer than deleting a
            // committed
            // asset.
            transactions.executeWithoutResult(status -> mapper.insert(row));
            return new AssetDto(id, "/api/assets/" + id + "/content", mime, size, width, height);
        } catch (ApiException error) {
            throw error;
        } catch (IOException error) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "图片存储暂不可用");
        } finally {
            storage.clean(temp);
        }
    }

    public AssetRow requireOwned(String id, String userId) {
        AssetRow row = mapper.find(id, userId);
        if (row == null)
            throw new ApiException(HttpStatus.NOT_FOUND, "ASSET_NOT_FOUND", "素材不存在或不可访问");
        return row;
    }

    private ApiException bad(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
