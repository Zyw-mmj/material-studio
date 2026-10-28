package com.example.material.storage;

import com.example.material.common.ApiException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;

@Component
public class FileStorage {
    private final Path root;

    public FileStorage(@Value("${app.storage-root:./.local/material-files}") String location)
            throws IOException {
        Path directory = Path.of(location).toAbsolutePath().normalize();
        Files.createDirectories(directory);
        root = directory.toRealPath();
        for (String name : List.of("uploads", "results", "tmp"))
            Files.createDirectories(root.resolve(name));
    }

    public Path temporary() throws IOException {
        return Files.createTempFile(root.resolve("tmp"), "image-", ".part");
    }

    public Path path(String key) throws IOException {
        Path value = root.resolve(key).normalize();
        if (!value.startsWith(root) || value.equals(root))
            throw new IOException("Invalid storage key");
        Path current = root;
        for (Path piece : root.relativize(value)) {
            current = current.resolve(piece);
            if (Files.isSymbolicLink(current))
                throw new IOException("Symbolic storage path rejected");
        }
        return value;
    }

    public boolean readable(String key) {
        try {
            Path p = path(key);
            return Files.isRegularFile(p, LinkOption.NOFOLLOW_LINKS) && Files.isReadable(p);
        } catch (IOException error) {
            return false;
        }
    }

    public void publish(Path temp, String key) throws IOException {
        Path destination = path(key);
        Files.createDirectories(destination.getParent());
        path(key);
        Files.move(temp, destination, StandardCopyOption.ATOMIC_MOVE);
    }

    public ResponseEntity<Resource> content(String key, String mime, String code) {
        try {
            if (!readable(key)) throw new IOException("Unreadable file");
            Path p = path(key);
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore().cachePrivate())
                    .contentType(MediaType.parseMediaType(mime))
                    .contentLength(Files.size(p))
                    .header("X-Content-Type-Options", "nosniff")
                    .header(
                            "Content-Disposition",
                            ContentDisposition.inline()
                                    .filename(p.getFileName().toString())
                                    .build()
                                    .toString())
                    .body(new FileSystemResource(p));
        } catch (IOException error) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, code, "图片暂不可用，请稍后重试");
        }
    }

    public String sha256(Path file) throws IOException {
        try (InputStream input = Files.newInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = new byte[8192];
            int count;
            while ((count = input.read(bytes)) != -1) digest.update(bytes, 0, count);
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    public void clean(Path file) {
        if (file != null)
            try {
                Files.deleteIfExists(file);
            } catch (IOException ignored) {
            }
    }
}
