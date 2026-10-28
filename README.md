# FRAME · 素材制作平台

前后端分离工程：Next.js 前端、Spring Boot / MyBatis 后端、MySQL 数据库。基于 [PRD V1.0](docs/source/PRD_v1.0.md) 与[八步技术设计](docs/README.md)初始化。

[GitHub 私有仓库](https://github.com/Zyw-mmj/material-studio) · [CI 结果](https://github.com/Zyw-mmj/material-studio/actions/workflows/ci.yml) · [工程记录](docs/09-project-initialization.md)

## 当前实现范围

已完成独立工程、同源 API 代理、模板列表/分类/详情/封面、统一错误与请求 ID、六张业务表与演示种子、前后端测试、CI、Compose 与持久化卷。模板数据经 Java / MyBatis 从真实 MySQL 获取，前端不硬编码业务数据。

当前是 **v0.1 工程初始化版本**。会话登录/CSRF 业务入口、图片上传、三阶段异步制作、多任务轮询和个人历史尚未实现；完整接口与状态机仍按技术文档逐步落地。页面明确显示尚未开放的能力，不接收上传或假装生成任务。

## 技术版本

| 层次 | 锁定版本 |
|---|---|
| Node.js | 24.22.1（.nvmrc / .node-version） |
| Next.js / React | 16.4.3 / 19.3.1 |
| TypeScript | 5.9.3 |
| Java / Spring Boot | JDK 21 / 4.0.9 |
| MyBatis Starter | 4.0.0 |
| Maven Wrapper | 3.9.11 |
| MySQL | 8.4 系列，Compose / 集成测试均锁定同一镜像摘要 |

前端依赖由 package-lock.json 锁定，后端由 POM、Boot BOM 和 Wrapper 管理。容器基础镜像与 GitHub Actions 固定摘要/commit SHA。

## 项目结构

```text
frontend/                  Next.js App Router、React、TS、测试与生成 API 类型
backend/                   Spring Boot、MyBatis、Flyway、Java/真实 MySQL 测试
  src/main/resources/db/   V1 结构迁移、demo profile 的 V2 种子
  src/main/resources/demo-covers/  已生成的三张自制 PNG
assets/covers/             封面 SVG 源文件
scripts/                   封面生成工具
compose.yaml               三个独立服务及数据库/文件卷
.github/workflows/ci.yml   前后端检查、测试与构建
docs/                     PRD、八步方案、OpenAPI、SQL、工程记录
```

## Compose 一键启动

需要 Docker Desktop/Engine 与 Compose v2。默认端口为前端 **3001**、数据库 **13360**，避免本机已有服务；可在 .env 修改。数据库只绑定 127.0.0.1，Java 不直接对宿主公开端口。

```bash
cp .env.example .env
# 编辑 .env，设置本地 MYSQL_PASSWORD 和 MYSQL_ROOT_PASSWORD
docker compose config --quiet
docker compose up --build -d --wait
docker compose ps
```

打开 [http://localhost:3001](http://localhost:3001)。前端 `/api/**` 转发 Java，Java 从 MySQL 查询模板。首次启动自动应用迁移与种子，无需手动导入 SQL。三张封面已随 Java 源码资源提交。

修改 JAVA_API_ORIGIN 后必须重新构建 frontend。不要把 Docker 内部域名 backend/mysql 写到浏览器代码中。

```bash
docker compose logs -f backend
docker compose down
```

普通停止保留 mysql_data 和 material_files。不要用 `down -v` 更新或重启已有项目。

## 本地分别开发

先在根目录按上节准备 .env 并启动 MySQL：

```bash
docker compose up -d --wait mysql
```

终端一，启动 Java（Maven 不会自动读取根 .env，以下显式载入自己维护的本地配置）：

```bash
cd backend
set -a
. ../.env
set +a
export DB_URL="jdbc:mysql://127.0.0.1:${MYSQL_PORT}/${MYSQL_DATABASE}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true"
export DB_USERNAME="$MYSQL_USER"
export DB_PASSWORD="$MYSQL_PASSWORD"
./mvnw spring-boot:run
```

终端二，使用 Node 24.22.1 启动前端（可用 nvm install / nvm use 切换）：

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

浏览器仍访问 3001，Java 本机端口为 8080。可以单独验证：

```bash
curl --fail http://localhost:8080/api/health
curl --fail http://localhost:3001/api/templates
curl --fail http://localhost:3001/api/templates/demo-postcard
```

## 测试与 CI

```bash
cd frontend
npm run lint
npm run typecheck
npm run test:run
npm run build
```

```bash
cd backend
./mvnw -B -ntp verify
```

后端 verify 包含 3 项单元测试、3 项 MySQL Testcontainers 集成测试和 jar 构建；前端有 4 项测试，覆盖请求错误以及路由变更后的旧响应隔离。集成测试使用独立临时 MySQL，不操作本地开发库。需要 Docker daemon，否则明确失败。

根目录 `make check` 可依次执行以上检查。GitHub Actions 在 push / pull_request 触发，使用 Node 24 与 JDK 21；CI 还校验 OpenAPI 生成的类型未漂移。实际结果见 [Actions](https://github.com/Zyw-mmj/material-studio/actions)。

## 契约与数据库变更

- [OpenAPI](docs/contracts/openapi.yaml) 包含完整 V1 设计；初始化仅实现 health 与模板四项操作，其他项属于后续计划。
- 更改契约后在 frontend 执行 `npm run api:generate` 并提交生成类型。
- 数据库结构迁移位于 backend 的 db/migration，演示种子位于 db/demo。后续变更增加 V3 等新文件，不修改已应用迁移。
- [数据库文档](docs/03-data-and-storage.md)与[任务引擎设计](docs/05-task-engine.md)描述后续实施约束，不代表相应任务功能已完成。

## 素材、配置与边界

封面为项目自制 SVG 插画，经 sharp 生成 PNG；可在 frontend 执行 `npm run covers:generate` 重建。无外部照片、真实 AI 或付费接口。前端品牌/版式为新设计，未宣称还原未提供的题目截图。

.env、依赖目录、构建缓存、运行数据和日志已加入忽略规则；仓库只提交非敏感示例配置。当前版本只提供公开模板读接口，其余业务接口默认拒绝，后续按设计实现演示会话及所有权检查。

备份/回滚：先停止新写入，成对备份 MySQL 与文件卷并记录镜像/迁移版本；仅在 schema 向后兼容时回滚旧应用，破坏性迁移需按备份恢复。当前不承诺生产级身份认证、多实例任务调度、自动任务恢复或容量清理。

## 来源与 AI 使用

工程骨架来源为 create-next-app 16.4.3 与 Spring Initializr，保留各依赖的许可证；项目业务结构、接口、样式、封面和测试按 PRD 自行编写。使用 Codex 辅助需求拆解、搭建与修改工程，并通过类型检查、前后端测试、真实数据库和运行验证修正；不包含私聊、凭据或完整提示词。实际投入未单独计时。

下一步：实现演示登录与 CSRF，然后依次完成上传、任务状态机和多任务历史，参见[实施计划](docs/08-delivery-and-plan.md#7-开发任务与依赖)。
