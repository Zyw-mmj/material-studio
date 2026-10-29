# 第 8 步：部署运维与实施计划

## 1. 当前交付与运行边界

本章保留部署设计及手工请求示例，身份、上传、任务与历史均已实现。真实版本、启动方法和边界以[项目 README](../README.md)和[V1.0 实施记录](10-full-implementation.md)为准；前端入口 3001，MySQL 宿主端口 13360。

默认以单机 Compose 运行，入口 `http://localhost:3001`。演示身份不适用于真实私密数据；本题不要求公网地址或自动生产部署。

## 2. 服务、配置与启动目标

| 服务 | 构建/运行目标 | 依赖/健康 | 持久化 |
|---|---|---|---|
| frontend | Node 24 多阶段构建，Next.js standalone，端口 3000 | backend 就绪后可用；页面健康路径 | 无业务卷 |
| backend | JDK 21 + Maven 构建，JRE 21 运行 jar，端口 8080 | MySQL 健康、迁移及重启收敛完成后 ready | material_files → `/data/material` |
| mysql | MySQL 8.4 固定补丁/摘要，内部端口 3306 | healthcheck，初始化 app DB/用户 | mysql_data → `/var/lib/mysql` |

数据库初始化由 Java 的版本迁移统一管理，不同时用 Compose init SQL 重复执行同一份 schema/seed。种子只在演示环境启用。封面 3 个自制 PNG 已打包到 Java 资源，并通过内容读取测试。

Compose 将 MYSQL_* 映射给数据库，给 Java 生成：

```text
DB_URL=jdbc:mysql://mysql:3306/material_platform?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true
DB_USERNAME=material_app
DB_PASSWORD=<MYSQL_PASSWORD>
```

配置字典见[根目录环境示例](../.env.example)。自定义 TASK_*/SIM_*/STORAGE_ROOT/APP_ORIGIN 由显式配置绑定类读取并校验；不能只写进 .env 却没有代码绑定。APP_ORIGIN 用于校验浏览器变更请求的 Origin，CSRF 仍启用；内部健康检查无身份数据。凭据不会发给前端，不使用 NEXT_PUBLIC_ 保存内部地址或开发密钥。

Next.js rewrite 目标在构建时解析并写入构建产物，因此 `JAVA_API_ORIGIN` 在 Compose 通过 build arg 传入，在本地开发通过环境传入。变更目标需重建 frontend，不能只改运行时 env。建议配置形状：

```ts
export default {
  output: 'standalone',
  async rewrites() {
    const origin = process.env.JAVA_API_ORIGIN;
    if (!origin) throw new Error('JAVA_API_ORIGIN is required');
    return [{ source: '/api/:path*', destination: `${origin}/api/:path*` }];
  },
};
```

本地与容器均验证 Cookie 的 Set-Cookie/Path、CSRF 请求头、multipart 及图片不被重写丢失。代理不得将所有错误包装成 200。开发 HTTP 的 Cookie Secure=false；如果后续部署 HTTPS，改 true 并配置可信代理/转发头。不能给 Cookie 设置 `Domain=backend`。

已验证启动流程：

```bash
cp .env.example .env
# 编辑本地数据库密码；需要开发覆盖时再填密钥并开启开关
bash scripts/up.sh
docker compose ps
docker compose logs backend
```

源码交付需提供 .gitignore 排除 `.env`、依赖目录、构建缓存、数据库与图片运行数据。MySQL 与 Java 不必对宿主公网映射端口；本机调试若映射，绑定 127.0.0.1。

启动问题修正：示例配置仅用于首次复制，保留已有 .env。启动脚本会拒绝占位密码、阻止另一目录替换同名容器，并在前后端启动前验证现有 MySQL 用户/库名与密码。MySQL 初始化变量不会改写已有卷；独立副本需不同 COMPOSE_PROJECT_NAME 及宿主端口。故障说明和多副本命令以[README](../README.md#mysql-unhealthy-与同机多个副本)为准。

等价本地启动目标：先准备 MySQL 8.4 与数据库用户；Java 设置本机数据库 URL、存储绝对目录、会话与模拟变量，再运行 `./mvnw spring-boot:run`；前端设置 `JAVA_API_ORIGIN=http://127.0.0.1:8080` 后 `npm ci`、`npm run dev`。最终 README 必须给出真实目录、数据库准备命令与完整配置，不能只保留这段概述。

## 3. 初始化与演示数据

- 迁移 V1 建六表，V2 插入两个用户与三个模板；数据库字符集 utf8mb4，连接/应用时区 UTC。
- 对应封面使用自制/合法来源资源，写明来源与复用范围。
- 演示输入准备 1～2 张合法 JPEG/PNG；不把私人素材放进仓库。
- 成功结果复制第一张输入，并在页面/README 说明模拟行为；两图模板第二张用于展示数量、上传与执行校验。
- 干净环境检查：三模板均可经 Java API 获取、两个身份均可选择、上传/结果卷可写，构建无需调用付费 API。

## 4. 实现后联调示例

以下使用 bash/zsh、curl、python3。登录所需 token 与 Cookie 写入本地临时目录，不复制到仓库；示例假定应用已在 3001 运行。

```bash
task_demo_dir=$(mktemp -d)
task_api=http://localhost:3001/api
curl --fail-with-body -sS -c "$task_demo_dir/cookies" \
  "$task_api/auth/csrf" -o "$task_demo_dir/csrf.json"
task_csrf=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$task_demo_dir/csrf.json")
curl --fail-with-body -sS -b "$task_demo_dir/cookies" -c "$task_demo_dir/cookies" \
  -H "X-CSRF-TOKEN: $task_csrf" -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3001' \
  --data '{"demoUserId":"demo-a"}' "$task_api/auth/login"
# 登录后重新获取 token，不能复用登录前的 token
curl --fail-with-body -sS -b "$task_demo_dir/cookies" -c "$task_demo_dir/cookies" \
  "$task_api/auth/csrf" -o "$task_demo_dir/csrf.json"
task_csrf=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$task_demo_dir/csrf.json")
curl --fail-with-body -sS -b "$task_demo_dir/cookies" "$task_api/auth/me"
curl --fail-with-body -sS "$task_api/templates"
```

上传本机合法文件，先把变量改成真实路径；用单图模板缩短脚本：

```bash
task_input_image="$PWD/backend/src/main/resources/demo-covers/avatar.png"
curl --fail-with-body -sS -b "$task_demo_dir/cookies" \
  -H "X-CSRF-TOKEN: $task_csrf" -H 'Origin: http://localhost:3001' \
  -F "file=@$task_input_image" "$task_api/assets" -o "$task_demo_dir/asset.json"
python3 -c 'import json,sys; a=json.load(open(sys.argv[1])); json.dump({"templateId":"demo-avatar","assetIds":[a["assetId"]]}, open(sys.argv[2],"w"))' \
  "$task_demo_dir/asset.json" "$task_demo_dir/create.json"
task_request_key=$(python3 -c 'import uuid; print(uuid.uuid4())')
curl --fail-with-body -sS -b "$task_demo_dir/cookies" \
  -H "X-CSRF-TOKEN: $task_csrf" -H "Idempotency-Key: $task_request_key" \
  -H 'Origin: http://localhost:3001' -H 'Content-Type: application/json' \
  --data-binary "@$task_demo_dir/create.json" "$task_api/tasks" -o "$task_demo_dir/task.json"
task_id=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["taskId"])' "$task_demo_dir/task.json")
curl --fail-with-body -sS -b "$task_demo_dir/cookies" "$task_api/tasks/$task_id"
```

失败演示：在本地启用 `DEMO_SIMULATION_OVERRIDE_ENABLED=true` 并配置密钥；在请求 JSON 加完整 simulation（见[创建接口](04-api-contract.md#5-创建任务)），使用一个**新的**幂等键和 `X-Demo-Control-Key`。指定 GENERATE，检查第三阶段 SKIPPED。密钥仅从本地环境读取，普通前端不接触。

完成后通过浏览器验证结果，再用另一独立 Cookie 文件登录 B，直接访问 A 的 taskId/assetId 应为 404。演示结束退出会话、清理本次临时目录。不要把命令中的 token 或本地密钥粘贴到验收报告。

## 5. CI 设计

已实现触发器 `push` 和 `pull_request`，两条独立作业并行运行，全部成功才通过。GitHub Actions 固定到 commit SHA，运行权限最小为 contents:read；依赖补丁和 actions SHA 写入最终版本清单。

| 作业 | 环境与目录 | 必须命令/检查 |
|---|---|---|
| frontend | Node 24、frontend/、package-lock 缓存 | `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:run` → `npm run build` |
| backend | JDK 21、backend/、Maven 缓存、Docker 可用 | `./mvnw -B verify`，单元 + MySQL 集成测试 + jar 构建 |

前端 scripts 约定：lint=`eslint .`，typecheck=`tsc --noEmit`，test:run=`vitest run`，build=`next build`。Next.js build 不代替 lint。

后端将 `*Test` 交给 Surefire、`*IT` 交给 Failsafe 并绑定 integration-test/verify。`verify` 同时覆盖 Java 测试与构建，必须让集成测试失败导致作业失败；不使用 skipTests。公开模板请求不能成为 Next.js 构建时的实时后端依赖；构建只验证页面代码，运行时再获取模板。

CI 默认不部署，日志保留检查与构建结果；未额外上传测试报告 artifact。CI 校验 OpenAPI 生成类型无漂移；本地另校验 OpenAPI 格式。额外依赖审计不属原题强制项。

## 6. 运维、备份与回滚

- 就绪：迁移和旧任务收敛完成才 ready；存活与就绪区分。内部健康探针不得暴露密钥、DB URL 或会话信息。
- 停机：先停止入口/新提交，Java 等待最多 30 秒，Compose stop_grace_period 40 秒；强制停止留下的非终态下次收敛。
- 备份：停止新写入并让任务结束或停机，成对备份 MySQL 与 material_files，记录版本/时间。只备份数据库不能恢复图片。
- 回滚：保留上一版镜像标签/摘要与迁移版本；仅在 schema 向后兼容时回滚应用。破坏性迁移必须使用备份恢复方案，不能盲目启动旧 jar。
- 不在普通重启/回滚中删除 volume，不使用 `down -v` 作为常规更新步骤。恢复备份先到独立环境核对任务、关联、结果可读性。
- 排障先按 taskId/requestId 查日志，再查任务/阶段与文件；GET 报错不得手工把成功任务改为失败“修复页面”。

## 7. 开发任务与依赖

未提供截止时间与人员，因此给出依赖与完成证据，不虚构人天。P0/P1/P2 是执行顺序，所有必需项最终都要覆盖。

| 步骤 | 优先级 | 前置 | 具体产物 | 完成证据 |
|---|---|---|---|---|
| S1 工程与版本 | P0 | 本文档 | frontend/backend 骨架、锁文件、Maven Wrapper、配置绑定、同源代理 | 构建通过；Cookie/上传/图片代理冒烟 |
| S2 数据与身份 | P0 | S1 | MySQL 迁移、种子/封面、演示会话/CSRF | me、双身份、真实 DB 约束通过 |
| S3 模板与上传 | P0 | S2 | 模板 API、FileStorage、上传和鉴权读取 | 列表/详情/合法与非法上传测试 |
| S4 任务引擎 | P0 | S3 | 幂等建档、线程池、三阶段、状态服务、任务/结果查询 | BE-01～08；成功与失败可查 |
| S5 前端闭环 | P0 | S3/S4 契约稳定 | 模板/详情/上传/任务/历史 | 真实 Java API 完成一项任务 |
| S6 生命周期边界 | P1 | S4/S5 | 多任务轮询、旧响应保护、刷新/切换、重启收敛 | FE 核心测试、AT-08～12 |
| S7 验收与 CI | P2 | 持续补测试，最终依赖 S6 | CI、关键集成测试、验收证据 | 所有 CI 门禁及 AT 通过 |
| S8 容器与交付 | P2 | S7 | Compose/Dockerfile、实际 README、源码包/commit | 干净环境复现、持久化与回滚演练 |

S1 起就写关键测试，S7 是集中补齐和验收，并非最后才开始测试。安全与用户隔离在 S2/S3 即实现，不能拖到视觉完成以后。

## 8. 最终工程交付清单

- [x] 前后端完整源码、实际依赖补丁、锁文件、Maven Wrapper、镜像版本。
- [x] 数据库迁移与种子、三张合法来源封面、示例配置，无真实凭据。
- [x] 可运行 CI，包含前端 lint/TS/构建、Java 测试/构建及约定关键测试。
- [x] Compose、Dockerfile、数据库与文件卷；或完整等价本地运行步骤。
- [x] 最终 README 给出真实启动、配置、成功/失败/延迟/多任务/刷新/身份演示、基本部署回滚。
- [x] README 逐项说明已实现、未实现、限制、实际投入；不把设计计划当完成清单。
- [x] 说明 AI 使用流程：需求拆解、上下文、生成/修改、验证与修正；无需披露私聊或全部提示词。
- [x] 脚手架、开源代码、素材来源及复用范围；验收 commit 或包含可运行源码的压缩包。
- [x] 排除 node_modules、target、.next、缓存、运行卷、真实 .env 与用户上传图片。

当前完成状态、验证范围、耗时和验收版本见[V1.0 实施记录](10-full-implementation.md)。不把设计表中的全部极端故障测试或生产备份恢复视为已执行。
