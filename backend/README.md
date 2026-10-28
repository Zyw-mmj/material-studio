# Material Studio API

Java 21 / Spring Boot 4.0.9 / MyBatis 4.0.0，Maven Wrapper 3.9.11。业务接口与数据库由此工程承担。

默认 demo profile，由 Flyway 创建六张业务表并预置两个演示身份记录和三个模板。用户记录已建不等于登录接口已实现。

- `GET /api/health`：Java 连通检查。
- `GET /api/templates?category=...`：模板和分类。
- `GET /api/templates/{id}`：模板详情。
- `GET /api/templates/{id}/cover`：自制 PNG 封面。
- `GET /actuator/health/readiness`：内部数据库就绪检查。

运行 `./mvnw test` 执行单元测试；`./mvnw verify` 还会启动 Testcontainers MySQL，执行集成测试并构建 jar，必须有可用 Docker，不静默跳过测试。

完整环境变量和本地/Compose 启动命令见[项目 README](../README.md)。Flyway 已应用迁移不可原地修改，后续结构变化新增迁移版本。
