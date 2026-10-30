# FRAME · 素材制作平台

可独立运行的前后端分离素材制作网站。浏览模板、选择演示身份、上传图片、提交制作任务，再查看后台阶段和个人历史。**制作使用可控模拟器，成功结果为第一张输入图的副本。**

[GitHub 私有仓库](https://github.com/Zyw-mmj/material-studio) · [GitHub Actions](https://github.com/Zyw-mmj/material-studio/actions) · [技术文档](docs/README.md) · [完成清单](TODO.md) · [业务验证](docs/10-full-implementation.md) · [布局与个人记录迭代](docs/12-layout-and-personal-records.md)

## 已完成的业务

- Java / MyBatis 提供分类、三个模板及封面，涵盖一图与两图要求。
- 两个固定演示身份、Java 会话、CSRF、素材/任务/结果的服务端所有权校验。
- JPEG/PNG 真实上传、预览、替换、移除；文件及元数据分别持久化到文件卷和 MySQL。
- 短事务创建任务后立即返回 202；Java 有界线程池依次执行「素材检查 → 模拟生成 → 结果整理」，不依赖页面或查询推进。
- 指定阶段失败、可调耗时、阶段记录、成功图片、个人历史、刷新恢复、多任务独立跟踪。
- 查询异常与任务失败分别展示；终态停止自动查询；离页、隐藏、身份变化时清理请求，旧响应不能覆盖新数据。
- 幂等提交、版本保护、队列拒绝反馈、单实例重启收敛、Compose 与关键测试。

## 技术版本与目录

| 层次                                 | 版本                                                |
| ------------------------------------ | --------------------------------------------------- |
| Node.js                              | 24.22.1（.nvmrc / .node-version）                   |
| Next.js / React / TypeScript         | 16.4.3 / 19.3.1 / 5.9.3                             |
| Java / Spring Boot / MyBatis Starter | JDK 21 / 4.0.9 / 4.0.0                              |
| Maven Wrapper                        | 3.9.11                                              |
| MySQL                                | 8.4，Compose 与 Testcontainers 使用同一固定镜像摘要 |

应用版本 1.0.0。前端 package-lock、后端 POM/BOM/Wrapper、容器镜像摘要和 Actions commit SHA 均已提交。

```text
frontend/                 Next.js App Router、React、TS、Vitest
backend/                  Spring Boot、MyBatis、Flyway、JUnit/Testcontainers
  src/main/resources/db/  V1 结构迁移、demo profile V2 种子
assets/covers/            自制 SVG 封面源文件，PNG 已打包到后端资源
scripts/smoke.py          同源全栈验证（Python 标准库）
scripts/up.sh             启动前检查配置、同名副本与真实数据库连接
compose.yaml              frontend、backend、mysql；数据库与文件卷
.github/workflows/ci.yml  push / pull_request 检查、测试与构建
docs/                     分步技术方案、OpenAPI、SQL、实施与验收记录
```

## Compose 启动

下面是从 GitHub 下载后首次运行的完整流程。已有项目更新请直接看本节末尾的「已有项目更新」，保留原 `.env`。

### 1. 准备环境与仓库权限

安装 Git、Docker Desktop（Linux 也可使用 Docker Engine + Compose v2），并启动 Docker。macOS/Linux 使用终端，Windows 在 WSL 或 Git Bash 中执行本节命令。无需本机 Java、Node.js、Maven 或 MySQL。

在终端检查：

```bash
git --version
docker compose version
docker info
```

三条命令都应成功；`docker info` 若提示无法连接 daemon，请先启动 Docker Desktop/Engine 再继续。首次构建需要联网下载容器镜像及 npm/Maven 依赖，耗时取决于网络和机器性能；后续构建会复用缓存。

本项目是 **GitHub 私有仓库**。下载者需要先获得仓库访问权限，并配置 GitHub 的 Git 身份验证（HTTPS 凭据管理器 / Personal Access Token，或 SSH 密钥）；GitHub 网页登录本身不代表终端已经登录。出现 `Repository not found` 或认证失败时，先检查账号与权限。

### 2. 下载 main 分支最新代码

在准备存放项目的目录执行：

```bash
git clone --config core.autocrlf=false --branch main https://github.com/Zyw-mmj/material-studio.git
cd material-studio
git log -1 --oneline
```

`core.autocrlf=false` 让此仓库保留脚本的 LF 换行，避免 Windows 自动转换换行后 Bash/Maven 脚本无法执行。如果已配置 SSH，可将 clone 地址替换为 `git@github.com:Zyw-mmj/material-studio.git`。后续所有启动、查看日志和停止命令都在项目根目录执行，即包含 `compose.yaml` 和 `scripts/` 的目录。

### 3. 首次创建本机配置

仅在没有 `.env` 时复制，避免覆盖已有密码：

```bash
test -f .env || cp .env.example .env
```

用文本编辑器打开根目录 `.env`（macOS/Linux 可执行 `nano .env`）：

- 将 `MYSQL_PASSWORD=CHANGE_ME_LOCAL_DB` 中的示例值换成自己生成的随机密码。
- 将 `MYSQL_ROOT_PASSWORD=CHANGE_ME_LOCAL_ROOT` 换成另一个随机密码。建议使用较长的英文字母、数字组合，避免空格和 `$` 的配置转义问题；不要保留 `CHANGE_ME` 示例值。
- 其余配置首次可保持默认。前端使用 **3001**，MySQL 宿主端口使用 **13360**；Java 仅暴露在容器网络。

在 nano 中按 `Control + O`、回车保存，再按 `Control + X` 退出。`.env` 仅保存在本机，不提交 Git。

如果本机已运行另一份本项目，先按下一节「同机多个副本」修改新副本的项目名和端口，再启动；重新下载到新目录不会自动隔离现有数据库。

### 4. 一条命令启动完整项目

```bash
bash scripts/up.sh
```

脚本先拒绝空/示例密码，检查同名容器是否属于另一目录；再启动 MySQL 并验证应用用户和 root 的实际连接，密码错误会立即给出原因，验证通过才构建并启动前后端。`make up` 使用同一入口。

首次启动自动执行数据库迁移，写入两个演示用户、三个模板，并准备示例封面，**无需手动导入 SQL 或另外启动后端**。上传图片及制作结果由容器数据卷保存。

### 5. 确认启动成功并体验

```bash
docker compose ps
```

应看到 `mysql`、`backend`、`frontend` 三个服务均为 `Up`，健康状态为 `healthy`。如果尚在 `starting`，稍后再查看；如果脚本报错或容器 `unhealthy`，先查看本节末尾的日志命令，不要直接删除数据卷。

打开 [http://localhost:3001/templates](http://localhost:3001/templates)。应能看到三个模板，并可切换分类。浏览器 `/api/**` 经 Next.js 转发到 Java；浏览器不使用容器域名。可选的连通性检查：

```bash
curl --fail http://localhost:3001/api/health
```

然后按以下最小流程验证业务：

1. 点击右上角账户按钮，选择「演示用户 A」，无需注册或输入密码。
2. 打开「旅行明信片」，上传两张 JPEG/PNG，每张不超过 5 MiB。仓库自带的 `backend/src/main/resources/demo-covers/avatar.png` 和 `life.png` 可直接作为本地演示素材。
3. 点击「开始制作」，观察「素材检查 → 模拟生成 → 结果整理」，完成后打开结果。模拟成功结果是第一张输入图的副本。
4. 进入「我的制作」查看记录，刷新页面后记录仍在。切换为 B 时应只显示 B 自己的记录；再切回 A 可读回 A 的记录。

### 已有项目更新

回到原来运行项目的目录，确认自己的代码改动已妥善保存后执行：

```bash
git switch main
git pull --ff-only origin main
bash scripts/up.sh
```

保留原 `.env`、Compose 项目名和数据卷，**不要重新用示例配置覆盖密码，也不要用 `docker compose down -v` 更新**。更新后打开相同地址，必要时强制刷新浏览器。修改 `JAVA_API_ORIGIN` 后必须重新构建 frontend；上面的启动脚本会执行构建。

### 查看日志与停止

```bash
# 查看三个服务的最近日志
docker compose logs --tail=100 mysql backend frontend

# 持续查看后端日志，Control + C 退出日志查看
docker compose logs -f backend

# 停止并移除容器，保留数据库和图片数据卷
docker compose down

# 下次继续运行（先确认 Docker 已启动）
bash scripts/up.sh
```

已核对配置时也可直接执行标准命令 `docker compose up --build -d --wait`；该入口使用 Compose 原生等待机制。需要提前诊断密码或目录冲突时使用上面的脚本。

## MySQL unhealthy 与同机多个副本

**修改 `.env` 不会修改旧数据卷中的数据库密码。** MySQL 的 MYSQL_USER、MYSQL_PASSWORD、MYSQL_ROOT_PASSWORD、MYSQL_DATABASE 只在空数据目录首次初始化时生效。已有库应继续使用原连接配置；这与 [MySQL 官方镜像说明](https://hub.docker.com/_/mysql)一致。

遇到 `Access denied` / `mysql is unhealthy`：

1. 保留数据卷，恢复初始化该数据库时使用的 `.env`。不知道旧密码时先取回原配置或备份，不用新示例密码覆盖旧库，也不要为消除报错删除卷。
2. 在原项目目录执行 `bash scripts/up.sh`。脚本会指出 MYSQL_PASSWORD、MYSQL_ROOT_PASSWORD 或库名/用户配置不匹配，不展示密码。
3. 若需检查原生健康检查的具体错误，可执行以下命令。MySQL 错误已保留在健康日志中，不再只有一个空输出的失败码：

```bash
docker compose logs --tail=100 mysql
docker inspect --format '{{json .State.Health}}' "$(docker compose ps -a -q mysql)"
```

**同一 Docker 中，新克隆/解压到另一目录不代表独立实例。** 默认项目名仍保留为 `material-studio`，避免旧项目升级后丢失原卷的关联。[Compose 按项目名隔离资源](https://docs.docker.com/compose/how-tos/project-name/)，独立副本应在自己的 `.env` 中同时设置：

```dotenv
COMPOSE_PROJECT_NAME=material-studio-preview
FRONTEND_PORT=3002
MYSQL_PORT=13361
```

再为这个新实例设置自己的两个数据库密码，执行 `bash scripts/up.sh`，打开 `http://localhost:3002`。新项目名使用新的数据库/图片卷，旧数据不会自动迁入。后续启动、停止与更新保持同一项目名；仅修改宿主端口不能隔离数据卷。脚本也支持 `-p <项目名>`、`--env-file <文件>` 等 Compose 全局选项，后续操作要使用同一组选项。

## 界面演示

1. 右上角打开「账户与个人记录」，选择「演示用户 A」，打开「旅行明信片」，准备两张 JPEG/PNG（可使用后端 demo-covers 中的自制图片）。少一张时不能提交。
2. 选择、替换或移除素材；全部上传就绪后点「开始制作」。受理后按钮恢复，继续上传可创建新任务。
3. 观察每项任务的真实阶段，或离开制作页进入「我的制作」。刷新后从 Java 恢复记录，继续跟踪未完成任务。
4. 成功后预览图片；失败卡展示具体阶段、原因及未执行步骤。点击「查看详情」打开结果、输入素材、任务编号及各阶段状态与时间。
5. 切换 B，A 的个人记录立即隐藏；B 使用自己的列表。退出后个人 API 需重新登录。
6. 查询暂不可用时保留最后已知状态、显示查询异常，可手动「恢复查询」。查询异常不会把任务改成业务失败。

每个演示身份是共享、无密码的固定测试身份，用于验证会话归属和隔离，**不提供真实账号身份保证，不用于真实私密素材**。Java 重启后会话失效，重新选择原身份可读取历史。

## 布局与个人任务记录管理

- **模板库**：紧凑分类栏和封面网格，卡片明确标出“需 N 张图片”。分类、数量要求与模板信息来自 Java。
- **详情/制作**：桌面左侧显示模板缩略图、素材要求和上传/提交，右侧显示当前模板的个人任务。小屏变为单列，保留同一套操作。
- **账户与个人记录**：右上角账户按钮打开原生模态对话框，显示 Java 返回的当前身份与 ID；提供个人记录入口、切换演示身份和退出。选择当前身份不会重新登录；切换时立即移除旧身份的上传草稿、个人图片及查询。
- **我的制作**：按“全部 / 进行中 / 已完成 / 失败”和模板组合筛选。条件传给 Java，覆盖整个历史；后续分页保持相同条件。页面显示当前已加载条数，不把它当作个人历史总数。切换筛选会取消旧作用域的请求。
- **记录详情**：点击卡片的“查看详情”或“查看结果”，在弹窗集中展示大图、输入素材、完整任务编号、创建/开始/结束时间、三阶段状态及失败原因。查看记录不会推进或重跑任务。

记录、阶段与素材归属由 MySQL/Java 会话管理，文件保存在持久化卷；刷新或重新选择同一演示身份可恢复历史。页面只跟踪未完成任务：恢复 ACTIVE 分页后继续同步，终态停查。即使筛选“已完成”，也会发现当前模板范围内的进行中任务，完成后显示其结果。网络错误保留最近已知状态并提供恢复入口，失败任务不提供原任务重新执行功能。

对话框具备标题、关闭标签、Tab/Shift+Tab 焦点循环和 Escape 关闭，关闭后回到触发按钮；触发记录已从筛选结果移除时回到主要内容。上传输入有稳定名称与说明，图标按钮有可读标签；提交反馈会获得焦点，键盘不会因按钮暂时禁用而失去位置。页面恢复可见时，账户和任务区共享同一次身份核验，避免并发核验相互取消。

演示：以 A 连续创建任务，在“我的制作”切状态/模板筛选并打开详情；刷新恢复记录；打开账户切 B，A 的记录立即隐藏；再切 A，读取原历史。账户弹窗只提供已有演示能力，未加入账单、密码重置、账户注销等题外入口。筛选条件和上传草稿不跨页面刷新保存，服务端制作记录持续保留。

## 配置与模拟失败

配置以根 `.env.example`、`compose.yaml` 和后端 `application.yml` 为准。根 `.env` 只在本机保存，不提交。

| 配置                                                 | 默认/用途                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| COMPOSE_PROJECT_NAME                                 | material-studio；同机独立副本使用不同值，隔离容器、网络和卷         |
| MYSQL_* / MYSQL_PORT                                 | 数据库用户、密码、库名；宿主端口 13360                              |
| FRONTEND_PORT / APP_ORIGIN                           | 3001；Origin 默认按该端口生成，使用其他域名时显式设置一致值         |
| JAVA_API_ORIGIN                                      | 构建时代理目标，Compose 为 http://backend:8080                      |
| STORAGE_ROOT                                         | Compose 固定 /data/material；本机 Java 默认 ./.local/material-files |
| SIM_VALIDATE_DELAY_MS                                | 1000                                                                |
| SIM_GENERATE_DELAY_MS                                | 5000                                                                |
| SIM_FINALIZE_DELAY_MS                                | 1000；以上每项 0～30000 毫秒                                        |
| SIM_FAIL_AT_STEP                                     | NONE；可选 VALIDATE、GENERATE、FINALIZE，影响之后新建任务           |
| TASK_EXECUTOR_THREADS / TASK_EXECUTOR_QUEUE_CAPACITY | 2 / 20；拒绝时记录 EXECUTOR_REJECTED 失败                           |
| DEMO_SIMULATION_OVERRIDE_ENABLED / DEMO_CONTROL_KEY  | false / 空；仅开发 API 使用，普通前端不接触密钥                     |
| SESSION_COOKIE_SECURE                                | 本机 HTTP 默认 false；HTTPS 部署须设置 true                         |

最简单的失败演示：在 `.env` 设置 `SIM_FAIL_AT_STEP=GENERATE`，执行 `docker compose up -d --wait backend`，在页面创建新任务。预期第一阶段成功、第二阶段失败、第三阶段 SKIPPED。改回 NONE 并更新 backend 后，新任务恢复正常。调整三个 SIM 延迟可观察排队/处理中；配置会在建任务时快照，不改变已存在任务。

同时创建成功和失败任务可启用每任务覆盖：在私有 `.env` 设置 `DEMO_SIMULATION_OVERRIDE_ENABLED=true` 和自行生成的非空 `DEMO_CONTROL_KEY`，更新 backend，再执行：

```bash
python3 scripts/smoke.py --include-failure
```

该脚本从私有配置读取密钥，不输出 Cookie/token/密钥；上传自制 PNG，验证三任务、指定 GENERATE 失败、幂等重试、只读查询、跨用户 404、刷新历史及结果字节。证据写入已忽略的 `.local/smoke-evidence.json`。不启用覆盖时执行 `python3 scripts/smoke.py`，只演示成功流程。脚本会新增演示数据。完整手工请求见[API 联调示例](docs/08-delivery-and-plan.md#4-实现后联调示例)。

## API 与任务规则

[OpenAPI](docs/contracts/openapi.yaml) 的 14 项操作均已实现，TS 类型从契约生成。

| 业务 | 接口                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 身份 | GET /api/auth/csrf、POST /api/auth/login、GET /api/auth/me、POST /api/auth/logout |
| 模板 | GET /api/templates、GET /api/templates/{id}、GET /api/templates/{id}/cover        |
| 素材 | POST /api/assets、GET /api/assets/{id}/content                                    |
| 制作 | POST /api/tasks、GET /api/tasks、GET /api/tasks/{id}、GET /api/tasks/{id}/result  |
| 连通 | GET /api/health                                                                   |

所有 POST 带最新 `X-CSRF-TOKEN`；登录变更会话 ID/token，退出销毁会话。素材/任务/结果按 Java 会话用户查询，他人对象统一 404。Cookie 为 HttpOnly、SameSite=Lax，个人响应 no-store。上传恰好一个 multipart `file`，只收真实可解码 JPEG/PNG，声明类型须匹配，非空且 ≤5 MiB，宽高各 ≤8192、总像素 ≤2500 万；建任务再次校验数量、归属与文件可用性。

创建需 UUID `Idempotency-Key`。短事务保存任务、三个阶段及素材关联，提交后投递有界执行器并返回 202。相同用户/键/内容重试返回同 taskId，内容冲突 409。提交响应丢失时页面保留原键并显示「确认提交结果」，避免网络重试重复建档。

任务状态 `QUEUED → RUNNING → SUCCEEDED / FAILED`；阶段 `VALIDATE → GENERATE → FINALIZE`。阶段状态为 PENDING/RUNNING/SUCCEEDED/FAILED/SKIPPED。耗时处理不占长事务；阶段交接和终态使用短事务提交。先写完整结果并原子发布，再记录成功。失败停止后续处理。GET 仅查询，不推进阶段，也不把成功任务改回处理中。

前端按用户、页面 epoch 和 taskId 管理记录；恢复历史首页后分页发现所有 ACTIVE。单任务无重叠请求，详情全局最多并发 4 个，常规 2 秒、失败退避至 30 秒，终态停查。隐藏/离页取消请求，恢复可见前核验身份；BroadcastChannel/storage 事件通知同源标签身份变化。

## 本机分别开发

先在根目录准备 `.env`，启动 MySQL：

```bash
bash scripts/up.sh --mysql-only
```

终端一（先停止 Compose 中的 backend/frontend，避免端口和单实例任务竞争）：

```bash
docker compose stop frontend backend
cd backend
set -a
. ../.env
set +a
export DB_URL="jdbc:mysql://127.0.0.1:${MYSQL_PORT}/${MYSQL_DATABASE}?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true"
export DB_USERNAME="$MYSQL_USER"
export DB_PASSWORD="$MYSQL_PASSWORD"
./mvnw spring-boot:run
```

终端二，使用 Node 24.22.1（`nvm install && nvm use`）：

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

浏览器入口仍为 3001，Java 本机端口 8080。本机 Java 使用自己的存储目录；切换运行方式时历史仍关联原存储卷，要一并迁移文件或使用独立演示数据库，不能把文件缺失当作任务失败。

## 测试与 CI

```bash
cd frontend
npm ci
npm run api:generate
npm run lint
npm run typecheck
npm run test:run
npm run build
```

```bash
cd backend
./mvnw -B -ntp verify
```

本轮 **前端 28 项、Java 19 项测试通过**。Java 包括 3 单元 + 16 MySQL Testcontainers 集成测试，覆盖阶段顺序/可观察边界/失败中断、会话/上传/所有权、并发幂等、队列拒绝、注销后继续处理和重启收敛；前端覆盖乱序多任务、终态停查、查询异常保留、隐藏/清理/刷新恢复、上传替换、同键确认与身份切换。测试容器为独立 MySQL 和临时目录，不操作开发库；缺 Docker 明确失败。

根目录 `make check` 依次执行前后端检查。GitHub Actions 在 push / pull_request 自动执行 lint、TS、测试与构建，并检查生成 API 类型无漂移。浏览器手工、全栈与重启证据及验收范围见[验证记录](docs/10-full-implementation.md)。

启动回归另运行 `python3 -m unittest discover -s scripts -p 'test_*.py' -v`，覆盖示例密码、旧库密码错误、另一目录的同名项目、首次初始化等待和数据卷保留；已纳入独立 CI 作业。

## 持久化、部署与边界

- MySQL 保存任务/阶段/历史/输入与模拟快照；上传和结果写 `material_files`。单实例启动会把旧 QUEUED/RUNNING 记录收敛为 SERVER_RESTARTED 失败，保留已完成阶段，未开始阶段 SKIPPED；**不恢复执行、不自动重试**。
- 只有单 Java 实例负责调度；内存队列非持久消息队列。执行器满时明确失败。运行中 DB 故障可能留下待重启收敛的任务。
- MySQL 与文件没有跨资源事务：先准备文件再提交元数据，异常允许留下无引用文件；未关联素材、失败临时文件没有自动定期清理。需要监控容量并在停机备份后人工维护。
- 结果文件暂不可读返回 503，任务仍为原成功状态。浏览器上传草稿和待确认请求不跨刷新保存，已受理任务可从历史恢复。
- 完成项见 TODO。范围外未实现：真实 AI、视频编辑、支付/积分/会员、模板管理、第三方登录、原任务重试、任务删除/下载、自动重启续跑和生产多实例调度。

部署：配置独立私有凭据与正确 APP_ORIGIN，保留卷，构建并等待三服务健康，执行 smoke 与页面检查。备份：停止新写入，成对备份 MySQL 和文件卷，记录镜像/迁移版本。回滚：保留上一版本镜像，只有 schema 向后兼容时回滚应用；破坏性变更需成对恢复备份，在独立环境核对历史与图片。不要在常规回滚中删除卷。此处提供基本操作流程，未演练生产备份恢复。

## 来源、AI 工作流与投入

骨架来自 create-next-app 16.4.3 与 Spring Initializr，保留依赖许可证。业务接口、状态机、前端交互、测试及版式按 PRD 编写。三张 SVG 封面为项目自制插画，使用 sharp 转为已提交 PNG；无外部照片或付费资源。参考原题 UI-01/02/03 的列表与左右制作/历史主要布局，未复刻原品牌或逐像素样式。

使用 Codex 辅助开发：先把原题 R-01～R-14 拆为 TODO，提供现有源码、契约、数据表和界面上下文，逐步实现身份→上传→引擎→查询→界面，再通过真实 MySQL 测试、前端测试、容器和浏览器验证修正。例如测试发现 JSON 登录需要显式调用会话认证策略以轮换 CSRF；补齐策略后验证旧 token 被拒、新 token 可用。未披露私人聊天、真实凭据或完整提示词。

早期文档和初始化阶段未单独计时。本轮 goal 开发从 2026-10-28 23:35（Asia/Shanghai）开始，实际经过时间与交付状态记录在[本轮记录](docs/10-full-implementation.md)，不估算此前投入。
