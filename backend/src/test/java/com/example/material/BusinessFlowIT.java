package com.example.material;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.example.material.storage.FileStorage;
import com.example.material.task.*;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.*;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.awt.image.BufferedImage;
import java.io.*;
import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

import javax.imageio.ImageIO;

@Testcontainers
@ActiveProfiles("demo")
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "demo.simulation-override-enabled=true",
            "demo.control-key=integration-control-key",
            "sim.validate-delay-ms=0",
            "sim.generate-delay-ms=0",
            "sim.finalize-delay-ms=0"
        })
class BusinessFlowIT {
    @Container
    static final MySQLContainer MYSQL =
            new MySQLContainer(
                    DockerImageName.parse(
                                    "mysql:8.4@sha256:a0225d1ea6631c8bc2385dc4c2faba17bbf1834ecf369e1659a9a382bd8d5dd7")
                            .asCompatibleSubstituteFor("mysql"));

    static final Path STORAGE = tempDirectory();

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MYSQL::getJdbcUrl);
        r.add("spring.datasource.username", MYSQL::getUsername);
        r.add("spring.datasource.password", MYSQL::getPassword);
        r.add("app.storage-root", () -> STORAGE.toString());
    }

    @LocalServerPort int port;
    @Autowired JsonMapper json;
    @Autowired TaskMapper tasks;
    @Autowired TaskQueryService queries;
    @Autowired TaskCommandService commands;
    @Autowired TaskStateService states;
    @Autowired TaskDispatcher dispatcher;
    @Autowired TaskRecovery recovery;
    @Autowired FileStorage files;
    @MockitoBean TaskSleeper sleeper;

    @MockitoSpyBean(name = "generationExecutor")
    ThreadPoolTaskExecutor executor;

    private final List<String> created = new ArrayList<>();
    private final List<CountDownLatch> gates = new ArrayList<>();

    @AfterEach
    void finishWorkers() throws Exception {
        gates.forEach(CountDownLatch::countDown);
        for (String id : created) awaitTerminal(id);
    }

    @AfterAll
    static void cleanFiles() throws Exception {
        try (var walk = Files.walk(STORAGE)) {
            for (Path file : walk.sorted(Comparator.reverseOrder()).toList())
                Files.deleteIfExists(file);
        }
    }

    static Path tempDirectory() {
        try {
            return Files.createTempDirectory("material-studio-it-");
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void sessionsRotateAndCsrfIsRequired() throws Exception {
        Client client = new Client();
        String old = client.csrf();
        assertThat(
                        client.post("/auth/login", Map.of("demoUserId", "demo-a"), null, null, null)
                                .statusCode())
                .isEqualTo(403);
        assertThat(
                        client.post("/auth/login", Map.of("demoUserId", "demo-a"), old, null, null)
                                .statusCode())
                .isEqualTo(200);
        assertThat(node(client.get("/auth/me")).get("userId").asString()).isEqualTo("demo-a");
        assertThat(client.post("/auth/logout", null, old, null, null).statusCode()).isEqualTo(403);
        String fresh = client.csrf();
        assertThat(client.post("/auth/logout", null, fresh, null, null).statusCode())
                .isEqualTo(204);
        assertThat(client.get("/auth/me").statusCode()).isEqualTo(401);
        assertThat(new Client().get("/tasks").statusCode()).isEqualTo(401);
    }

    @Test
    void uploadValidatesBytesMimeSizeAndDimensions() throws Exception {
        Client a = login("demo-a");
        var png = a.upload(image(8, 6, "png"), "image/png");
        assertThat(png.statusCode()).isEqualTo(201);
        var asset = node(png);
        assertThat(asset.get("width").asInt()).isEqualTo(8);
        assertThat(a.get("/assets/" + asset.get("assetId").asString() + "/content").statusCode())
                .isEqualTo(200);
        assertThat(a.upload(image(4, 4, "jpg"), "image/jpeg").statusCode()).isEqualTo(201);
        assertCode(a.upload(new byte[0], "image/png"), 400, "INVALID_IMAGE");
        assertCode(
                a.upload("<svg/>".getBytes(StandardCharsets.UTF_8), "image/png"),
                415,
                "UNSUPPORTED_IMAGE_TYPE");
        assertCode(a.upload(image(4, 4, "png"), "image/jpeg"), 415, "UNSUPPORTED_IMAGE_TYPE");
        assertCode(a.upload(new byte[5242881], "image/png"), 413, "FILE_TOO_LARGE");
        assertCode(a.upload(image(8193, 1, "png"), "image/png"), 400, "IMAGE_DIMENSIONS_EXCEEDED");
    }

    @Test
    void privateAssetsTasksAndResultsAreIsolatedAndIdentityCanSwitch() throws Exception {
        Client a = login("demo-a"), b = login("demo-b");
        String asset = asset(a);
        String id = create(a, asset, null, UUID.randomUUID().toString());
        awaitTerminal(id);
        assertThat(b.get("/assets/" + asset + "/content").statusCode()).isEqualTo(404);
        assertThat(b.get("/tasks/" + id).statusCode()).isEqualTo(404);
        assertThat(b.get("/tasks/" + id + "/result").statusCode()).isEqualTo(404);
        assertCode(
                b.post("/tasks", body(asset, null), b.token, UUID.randomUUID().toString(), null),
                404,
                "ASSET_NOT_FOUND");
        for (JsonNode item : node(b.get("/tasks")).get("items"))
            assertThat(item.get("taskId").asString()).isNotEqualTo(id);
        assertThat(
                        a.post("/auth/login", Map.of("demoUserId", "demo-b"), a.token, null, null)
                                .statusCode())
                .isEqualTo(200);
        a.token = a.csrf();
        assertThat(a.get("/tasks/" + id).statusCode()).isEqualTo(404);
    }

    @Test
    void successIsSequentialAndProducesReadableResult() throws Exception {
        Client a = login("demo-a");
        String id = create(a, asset(a), null, UUID.randomUUID().toString());
        TaskRow row = awaitTerminal(id);
        assertThat(row.status()).isEqualTo("SUCCEEDED");
        assertThat(row.resultKey()).isNotNull();
        var detail = node(a.get("/tasks/" + id));
        assertThat(detail.get("steps").size()).isEqualTo(3);
        for (JsonNode step : detail.get("steps")) {
            assertThat(step.get("status").asString()).isEqualTo("SUCCEEDED");
            assertThat(step.get("startedAt").isNull()).isFalse();
            assertThat(step.get("finishedAt").isNull()).isFalse();
        }
        var order = inOrder(sleeper);
        order.verify(sleeper).pause(id, "VALIDATE", 0);
        order.verify(sleeper).pause(id, "GENERATE", 0);
        order.verify(sleeper).pause(id, "FINALIZE", 0);
        assertThat(a.get("/tasks/" + id + "/result").statusCode()).isEqualTo(200);
        long version = row.version();
        for (int i = 0; i < 3; i++) a.get("/tasks/" + id);
        assertThat(tasks.find(id).version()).isEqualTo(version);
    }

    @Test
    void eachInjectedFailureStopsLaterStages() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        for (int failed = 0; failed < 3; failed++) {
            String id =
                    create(
                            a,
                            asset,
                            simulation(TaskModels.STEPS.get(failed), 0),
                            UUID.randomUUID().toString());
            var row = awaitTerminal(id);
            assertThat(row.status()).isEqualTo("FAILED");
            assertThat(row.errorCode()).isEqualTo("SIMULATED_FAILURE");
            assertThat(row.resultKey()).isNull();
            var steps = tasks.steps(id);
            for (int i = 0; i < 3; i++) {
                assertThat(steps.get(i).status())
                        .isEqualTo(i < failed ? "SUCCEEDED" : i == failed ? "FAILED" : "SKIPPED");
                if (i > failed) {
                    assertThat(steps.get(i).startedAt()).isNull();
                    verify(sleeper, never()).pause(id, TaskModels.STEPS.get(i), 0);
                }
            }
        }
    }

    @Test
    void httpReturnsWhileWorkerBlockedAndEveryBoundaryIsCommitted() throws Exception {
        Client a = login("demo-a");
        var entered = List.of(new CountDownLatch(1), new CountDownLatch(1), new CountDownLatch(1));
        for (int i = 0; i < 3; i++) gates.add(new CountDownLatch(1));
        doAnswer(
                        call -> {
                            int index = TaskModels.STEPS.indexOf(call.getArgument(1));
                            entered.get(index).countDown();
                            if (!gates.get(index).await(5, TimeUnit.SECONDS))
                                throw new IllegalStateException("test gate timeout");
                            return null;
                        })
                .when(sleeper)
                .pause(anyString(), anyString(), anyLong());
        String id = create(a, asset(a), simulation(null, 10000), UUID.randomUUID().toString());
        for (int i = 0; i < 3; i++) {
            assertThat(entered.get(i).await(2, TimeUnit.SECONDS)).isTrue();
            var detail = queries.detail(id, "demo-a");
            assertThat(detail.status()).isEqualTo("RUNNING");
            assertThat(detail.currentStep()).isEqualTo(TaskModels.STEPS.get(i));
            assertThat(detail.steps().get(i).status()).isEqualTo("RUNNING");
            long version = detail.version();
            assertThat(node(a.get("/tasks/" + id)).get("version").asLong()).isEqualTo(version);
            assertThat(tasks.find(id).version()).isEqualTo(version);
            gates.get(i).countDown();
        }
        assertThat(awaitTerminal(id).status()).isEqualTo("SUCCEEDED");
    }

    @Test
    void logoutDoesNotCancelAnAcceptedTask() throws Exception {
        Client a = login("demo-a");
        CountDownLatch entered = new CountDownLatch(1), gate = new CountDownLatch(1);
        gates.add(gate);
        doAnswer(
                        call -> {
                            if (call.getArgument(1).equals("GENERATE")) {
                                entered.countDown();
                                if (!gate.await(5, TimeUnit.SECONDS))
                                    throw new IllegalStateException("gate timeout");
                            }
                            return null;
                        })
                .when(sleeper)
                .pause(anyString(), anyString(), anyLong());
        String id = create(a, asset(a), null, UUID.randomUUID().toString());
        assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(a.post("/auth/logout", null, a.token, null, null).statusCode()).isEqualTo(204);
        gate.countDown();
        assertThat(awaitTerminal(id).status()).isEqualTo("SUCCEEDED");
        Client refreshed = login("demo-a");
        assertThat(refreshed.get("/tasks/" + id + "/result").statusCode()).isEqualTo(200);
    }

    @Test
    void concurrentIdempotentSubmissionOnlyExecutesOnce() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a), key = UUID.randomUUID().toString();
        var request = a.request("/tasks", body(asset, null), a.token, key, null);
        var first = a.http.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        var second = a.http.sendAsync(request, HttpResponse.BodyHandlers.ofString());
        var one = first.get(3, TimeUnit.SECONDS);
        var two = second.get(3, TimeUnit.SECONDS);
        assertThat(one.statusCode()).isEqualTo(202);
        assertThat(two.statusCode()).isEqualTo(202);
        String id = node(one).get("taskId").asString();
        created.add(id);
        assertThat(node(two).get("taskId").asString()).isEqualTo(id);
        awaitTerminal(id);
        verify(sleeper, times(1)).pause(id, "VALIDATE", 0);
        verify(sleeper, times(1)).pause(id, "GENERATE", 0);
        verify(sleeper, times(1)).pause(id, "FINALIZE", 0);
        assertCode(
                a.post("/tasks", body(asset(a), null), a.token, key, null),
                409,
                "IDEMPOTENCY_CONFLICT");
    }

    @Test
    void creationValidationDoesNotLeavePartialTasks() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        int before = tasks.list("demo-a", "ALL", null, null, null, 10000).size();
        assertCode(
                a.post(
                        "/tasks",
                        Map.of("templateId", "demo-postcard", "assetIds", List.of(asset)),
                        a.token,
                        UUID.randomUUID().toString(),
                        null),
                400,
                "INVALID_ASSET_COUNT");
        assertCode(
                a.post(
                        "/tasks",
                        Map.of("templateId", "demo-postcard", "assetIds", List.of(asset, asset)),
                        a.token,
                        UUID.randomUUID().toString(),
                        null),
                400,
                "DUPLICATE_ASSET");
        assertCode(
                a.post(
                        "/tasks",
                        Map.of(
                                "templateId",
                                "demo-avatar",
                                "assetIds",
                                List.of(asset),
                                "userId",
                                "demo-b"),
                        a.token,
                        UUID.randomUUID().toString(),
                        null),
                400,
                "INVALID_REQUEST");
        assertThat(tasks.list("demo-a", "ALL", null, null, null, 10000)).hasSize(before);
    }

    @Test
    void developerSimulationNeedsCorrectKey() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        var body = body(asset, simulation("GENERATE", 0));
        assertCode(
                a.post("/tasks", body, a.token, UUID.randomUUID().toString(), null),
                403,
                "DEMO_CONTROL_FORBIDDEN");
        assertCode(
                a.post("/tasks", body, a.token, UUID.randomUUID().toString(), "wrong-key"),
                403,
                "DEMO_CONTROL_FORBIDDEN");
    }

    @Test
    void rejectionIsPersistedAndNoStageRuns() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        doThrow(new RejectedExecutionException("test rejection"))
                .when(executor)
                .execute(any(Runnable.class));
        String id = create(a, asset, null, UUID.randomUUID().toString());
        var row = awaitTerminal(id);
        assertThat(row.errorCode()).isEqualTo("EXECUTOR_REJECTED");
        assertThat(row.currentStep()).isNull();
        assertThat(tasks.steps(id)).allSatisfy(s -> assertThat(s.status()).isEqualTo("SKIPPED"));
        verify(sleeper, never()).pause(eq(id), anyString(), anyLong());
    }

    @Test
    void startupConvergesQueuedAndRunningRecordsWithoutReexecution() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        var request = new TaskModels.CreateRequest("demo-avatar", List.of(asset), null);
        String queued = commands.create("demo-a", UUID.randomUUID().toString(), request, null).id();
        created.add(queued);
        String running =
                commands.create("demo-a", UUID.randomUUID().toString(), request, null).id();
        created.add(running);
        states.claim(running);
        states.advance(running, "VALIDATE", "GENERATE");
        recovery.run(new DefaultApplicationArguments());
        assertThat(tasks.find(queued).errorCode()).isEqualTo("SERVER_RESTARTED");
        assertThat(tasks.steps(queued))
                .allSatisfy(s -> assertThat(s.status()).isEqualTo("SKIPPED"));
        var steps = tasks.steps(running);
        assertThat(steps.get(0).status()).isEqualTo("SUCCEEDED");
        assertThat(steps.get(1).status()).isEqualTo("FAILED");
        assertThat(steps.get(2).status()).isEqualTo("SKIPPED");
        long version = tasks.find(running).version();
        recovery.run(new DefaultApplicationArguments());
        assertThat(tasks.find(running).version()).isEqualTo(version);
    }

    @Test
    void historyIsStablePaginatedAndResultsStaySuccessfulAfterStorageLoss() throws Exception {
        Client a = login("demo-a");
        String asset = asset(a);
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            String id = create(a, asset, null, UUID.randomUUID().toString());
            awaitTerminal(id);
            ids.add(id);
        }
        String cursor = null;
        Set<String> seen = new HashSet<>();
        do {
            var page = node(a.get("/tasks?limit=2" + (cursor == null ? "" : "&cursor=" + cursor)));
            for (JsonNode item : page.get("items"))
                assertThat(seen.add(item.get("taskId").asString())).isTrue();
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
        } while (cursor != null);
        assertThat(seen).containsAll(ids);
        assertThat(node(a.get("/tasks?status=ACTIVE")).get("items").size()).isZero();
        String id = ids.getFirst();
        Files.delete(files.path(tasks.find(id).resultKey()));
        assertCode(a.get("/tasks/" + id + "/result"), 503, "RESULT_UNAVAILABLE");
        assertThat(tasks.find(id).status()).isEqualTo("SUCCEEDED");
        assertCode(a.get("/tasks?cursor=invalid"), 400, "INVALID_CURSOR");
    }

    TaskRow awaitTerminal(String id) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(6);
        TaskRow row;
        do {
            row = tasks.find(id);
            if (row != null && TaskModels.terminal(row.status())) return row;
            Thread.sleep(10);
        } while (System.nanoTime() < deadline);
        throw new AssertionError("Task did not finish: " + id + " " + row);
    }

    byte[] image(int width, int height, String format) throws IOException {
        var buffer = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, buffer);
        return buffer.toByteArray();
    }

    Client login(String user) throws Exception {
        Client c = new Client();
        c.token = c.csrf();
        assertThat(
                        c.post("/auth/login", Map.of("demoUserId", user), c.token, null, null)
                                .statusCode())
                .isEqualTo(200);
        c.token = c.csrf();
        return c;
    }

    String asset(Client c) throws Exception {
        var r = c.upload(image(8, 8, "png"), "image/png");
        assertThat(r.statusCode()).withFailMessage(r.body()).isEqualTo(201);
        return node(r).get("assetId").asString();
    }

    Object simulation(String fail, int delay) {
        var map = new LinkedHashMap<String, Object>();
        map.put("failAtStep", fail);
        map.put("delaysMs", Map.of("validate", delay, "generate", delay, "finalize", delay));
        return map;
    }

    Map<String, Object> body(String asset, Object simulation) {
        var map = new LinkedHashMap<String, Object>();
        map.put("templateId", "demo-avatar");
        map.put("assetIds", List.of(asset));
        if (simulation != null) map.put("simulation", simulation);
        return map;
    }

    String create(Client c, String asset, Object simulation, String key) throws Exception {
        var r =
                c.post(
                        "/tasks",
                        body(asset, simulation),
                        c.token,
                        key,
                        simulation == null ? null : "integration-control-key");
        assertThat(r.statusCode()).withFailMessage(r.body()).isEqualTo(202);
        String id = node(r).get("taskId").asString();
        created.add(id);
        return id;
    }

    JsonNode node(HttpResponse<String> response) {
        return json.readTree(response.body());
    }

    void assertCode(HttpResponse<String> r, int status, String code) {
        assertThat(r.statusCode()).withFailMessage(r.body()).isEqualTo(status);
        assertThat(node(r).get("code").asString()).isEqualTo(code);
    }

    class Client {
        final HttpClient http =
                HttpClient.newBuilder()
                        .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL))
                        .connectTimeout(Duration.ofSeconds(3))
                        .build();
        String token;

        URI uri(String path) {
            return URI.create("http://localhost:" + port + "/api" + path);
        }

        HttpResponse<String> get(String path) throws Exception {
            return http.send(
                    HttpRequest.newBuilder(uri(path)).timeout(Duration.ofSeconds(3)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
        }

        String csrf() throws Exception {
            return node(get("/auth/csrf")).get("token").asString();
        }

        HttpRequest request(String path, Object body, String csrf, String key, String control) {
            var builder =
                    HttpRequest.newBuilder(uri(path))
                            .timeout(Duration.ofSeconds(3))
                            .header("Content-Type", "application/json")
                            .header("Origin", "http://localhost:3001");
            if (csrf != null) builder.header("X-CSRF-TOKEN", csrf);
            if (key != null) builder.header("Idempotency-Key", key);
            if (control != null) builder.header("X-Demo-Control-Key", control);
            return builder.POST(
                            HttpRequest.BodyPublishers.ofString(
                                    body == null ? "" : json.writeValueAsString(body)))
                    .build();
        }

        HttpResponse<String> post(String path, Object body, String csrf, String key, String control)
                throws Exception {
            return http.send(
                    request(path, body, csrf, key, control), HttpResponse.BodyHandlers.ofString());
        }

        HttpResponse<String> upload(byte[] content, String mime) throws Exception {
            String boundary = "studio-boundary";
            var output = new ByteArrayOutputStream();
            output.write(
                    ("--"
                                    + boundary
                                    + "\r\n"
                                    + "Content-Disposition: form-data; name=\"file\";"
                                    + " filename=\"test.png\"\r\n"
                                    + "Content-Type: "
                                    + mime
                                    + "\r\n\r\n")
                            .getBytes(StandardCharsets.UTF_8));
            output.write(content);
            output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            var builder =
                    HttpRequest.newBuilder(uri("/assets"))
                            .timeout(Duration.ofSeconds(5))
                            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                            .header("X-CSRF-TOKEN", token)
                            .header("Origin", "http://localhost:3001");
            return http.send(
                    builder.POST(HttpRequest.BodyPublishers.ofByteArray(output.toByteArray()))
                            .build(),
                    HttpResponse.BodyHandlers.ofString());
        }
    }
}
