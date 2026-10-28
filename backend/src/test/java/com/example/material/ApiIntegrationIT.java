package com.example.material;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Testcontainers
@ActiveProfiles("demo")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiIntegrationIT {
    @Container
    static final MySQLContainer MYSQL =
            new MySQLContainer(
                    DockerImageName.parse(
                                    "mysql:8.4@sha256:a0225d1ea6631c8bc2385dc4c2faba17bbf1834ecf369e1659a9a382bd8d5dd7")
                            .asCompatibleSubstituteFor("mysql"));

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", MYSQL::getJdbcUrl);
        properties.add("spring.datasource.username", MYSQL::getUsername);
        properties.add("spring.datasource.password", MYSQL::getPassword);
    }

    @LocalServerPort int port;
    @Autowired JdbcTemplate jdbc;
    @Autowired JsonMapper json;
    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void migratesAllSixTablesAndSeedsDemoRecords() {
        assertThat(
                        jdbc.queryForObject(
                                "SELECT COUNT(*) FROM information_schema.tables WHERE"
                                    + " table_schema=DATABASE() AND table_name IN"
                                    + " ('users','templates','assets','generation_tasks','task_assets','task_steps')",
                                Integer.class))
                .isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM templates", Integer.class))
                .isEqualTo(3);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "UPDATE templates SET required_image_count=3 WHERE"
                                            + " id='demo-avatar'"))
                .isInstanceOf(DataAccessException.class)
                .rootCause()
                .isInstanceOfSatisfying(
                        java.sql.SQLException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo(3819));
    }

    @Test
    void readsTemplatesFromJavaAndMysqlAndFiltersCategory() throws Exception {
        var response = get("/api/templates");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("X-Request-ID")).isPresent();
        JsonNode body = json.readTree(response.body());
        assertThat(body.get("items").size()).isEqualTo(3);
        assertThat(body.get("categories").size()).isEqualTo(2);
        var filtered =
                get("/api/templates?category=" + URLEncoder.encode("创意图片", StandardCharsets.UTF_8));
        assertThat(json.readTree(filtered.body()).get("items").size()).isEqualTo(2);
        var empty = get("/api/templates?category=missing");
        assertThat(empty.statusCode()).isEqualTo(200);
        assertThat(json.readTree(empty.body()).get("items").size()).isZero();
    }

    @Test
    void detailAndCoverAreReadableWhileInvalidIdsHaveConsistentErrors() throws Exception {
        var detail = get("/api/templates/demo-postcard");
        assertThat(detail.statusCode()).isEqualTo(200);
        assertThat(json.readTree(detail.body()).get("requiredImageCount").asInt()).isEqualTo(2);
        var missing = get("/api/templates/missing");
        assertThat(missing.statusCode()).isEqualTo(404);
        assertThat(json.readTree(missing.body()).get("code").asString())
                .isEqualTo("TEMPLATE_NOT_FOUND");
        var invalid = get("/api/templates?category=" + "x".repeat(65));
        assertThat(invalid.statusCode()).isEqualTo(400);
        var image =
                http.send(
                        HttpRequest.newBuilder(uri("/api/templates/demo-postcard/cover"))
                                .GET()
                                .build(),
                        HttpResponse.BodyHandlers.ofByteArray());
        assertThat(image.statusCode()).isEqualTo(200);
        assertThat(image.headers().firstValue("content-type")).contains("image/png");
        assertThat(image.body()).startsWith((byte) 137, (byte) 80, (byte) 78, (byte) 71);
    }

    private HttpResponse<String> get(String path) throws Exception {
        return http.send(
                HttpRequest.newBuilder(uri(path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }
}
