# 第 4 步：接口契约

机器可读定义：[OpenAPI 3.0.3](contracts/openapi.yaml)。本章解释行为，OpenAPI 规定字段、必填项、类型、路径和响应；发生不一致必须一起修正后再联调。

OpenAPI 的 14 项操作均已实现，含身份、上传、任务、历史与图片鉴权读取。当前验证见[实施记录](10-full-implementation.md)。健康接口返回 service、status、stage、timestamp，用于前后端连通检查，数据库就绪使用 Actuator readiness。

## 1. 通用约定

- 浏览器基址 `/api`；本地入口 `http://localhost:3001/api`。不把 `backend:8080` 暴露给浏览器。
- JSON 使用 UTF-8、camelCase；上传为 multipart，图片读取为二进制。成功直接返回资源对象，列表为 `{items,nextCursor}`，不另包一层 `data`。
- 时间为 UTC ISO 8601（示例 `2026-10-28T14:00:00.000Z`），ID 不透明，任务/素材/幂等键为 UUID。
- 会话 Cookie：`MP_SESSION`、HttpOnly、SameSite=Lax、Path=/，HTTPS 配置 Secure，不设置内部服务域名 Domain。
- 所有 POST 要求 `X-CSRF-TOKEN`；前端通过 CSRF API 获取，不从 HttpOnly Cookie 读取会话。
- 所有个人数据、会话与 CSRF 响应 `Cache-Control: no-store`；文件为 `private, no-store`。前端个人 fetch 也使用 `cache: 'no-store'`。
- 请求/响应携带 `X-Request-ID`，响应中由服务端生成或校验后沿用。错误体含 requestId。
- JSON 请求拒绝未知字段；素材数组不允许重复。用户标识仅来自服务端会话，不接受请求中的 userId。

错误形状：

```json
{
  "code": "INVALID_ASSET_COUNT",
  "message": "当前模板需要 2 张图片",
  "details": {"expected": 2, "actual": 1},
  "requestId": "req-example"
}
```

## 2. 演示身份与会话

| 方法 | 路径 | 输入 | 返回/行为 |
|---|---|---|---|
| GET | `/api/auth/csrf` | 无，允许未登录 | 200 `{token,headerName:"X-CSRF-TOKEN"}`，必要时创建匿名会话 |
| POST | `/api/auth/login` | `{demoUserId:"demo-a"}` 或 demo-b；CSRF | 200 `{userId,displayName,mode:"DEMO"}`，更新会话 Cookie |
| GET | `/api/auth/me` | 会话 Cookie | 200 当前身份；未登录 401 |
| POST | `/api/auth/logout` | 会话 + CSRF | 204，无 body，注销并过期 Cookie |

演示登录没有密码，允许选择两个预置用户。该机制验证“当前会话只能访问自己记录”，不提供真实账号的身份保证；不得把它描述为可用于真实私密数据的生产认证。

登录时按 Spring Security 认证流程写入 SecurityContext 并保存到会话，变更会话 ID，清理旧 CSRF token；不能只改前端 userId。自定义 JSON 登录入口必须调用会话认证策略和 SecurityContextRepository，避免自定义 Controller 绕过认证框架的会话保护。退出清理认证与会话。

前端顺序：GET csrf → POST login → 丢弃旧 token → GET csrf → GET me → 加载个人数据。身份切换时先清前端状态，使用旧会话的有效 CSRF 登录新身份，再获取新 token。登出后同样丢弃旧 token。会话 30 分钟无请求过期，Java 重启后失效。

采用 Spring Security 的 session CSRF token，并通过 JSON 端点暴露当前请求可用 token。登录/退出后重新取得 token 是必要的，不能复用旧值；multipart token 放请求头，避免解析文件后才进行 CSRF 检查。[Spring Security CSRF 文档](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)

认证异常区分：未认证的受保护 GET 为 401；POST 的 CSRF 过滤可能先返回 403。前端收到 CSRF_INVALID 后只重新读取 me/csrf 并要求重试，不自动用新幂等键重复提交。对象不属于当前用户统一返回 404。

## 3. 模板接口

### GET /api/templates?category=创意图片

公开只读；category 可不传，传空字符串视为不筛选。返回：

```json
{
  "categories": ["创意图片", "生活记录"],
  "items": [{
    "id": "demo-postcard",
    "title": "旅行明信片",
    "category": "创意图片",
    "coverUrl": "/api/templates/demo-postcard/cover",
    "description": "上传两张图片，演示结果为第一张图片的副本",
    "requiredImageCount": 2,
    "acceptedMimeTypes": ["image/jpeg", "image/png"],
    "maxFileSizeBytes": 5242880
  }]
}
```

categories 始终返回全部启用模板的分类，按名称排序；items 按 ID 排序。未知分类为 200 + 空 items，不能作为接口故障。V1 模板数量固定，不分页。

### GET /api/templates/{id} / GET /api/templates/{id}/cover

详情返回上面的单个模板结构；不存在/下架为 404 `TEMPLATE_NOT_FOUND`。封面从受控 classpath 路径返回 PNG/JPEG，允许公开读取；资源缺失返回 503 `COVER_UNAVAILABLE`，不能向客户端暴露文件位置。

## 4. 素材接口

### POST /api/assets

登录与 CSRF 必需；multipart 字段 `file` 恰好一个。不带模板 ID，先按平台全局上限校验，建任务再按模板约束校验。Content-Type 由浏览器自动生成 multipart boundary，前端不能手写该头。

201 示例：

```json
{
  "assetId": "11111111-1111-4111-8111-111111111111",
  "previewUrl": "/api/assets/11111111-1111-4111-8111-111111111111/content",
  "mimeType": "image/png",
  "sizeBytes": 281003,
  "width": 1200,
  "height": 800
}
```

空文件/多文件/坏图片 400；字节超限 413；不支持类型或声明类型与实际类型不符 415；尺寸超限 400。支持的 MIME 声明必须与检测结果一致，不接受把 ZIP 声明为 PNG。

### GET /api/assets/{id}/content

登录，校验所属用户后返回图片。无权/不存在为 404 `ASSET_NOT_FOUND`，已登记文件暂不可读为 503 `ASSET_UNAVAILABLE`。本版本不提供 DELETE API；UI 移除只清空当前槽位，旧素材保留。

## 5. 创建任务

### POST /api/tasks

登录、CSRF、`Idempotency-Key: <UUID>` 必填。请求：

```json
{
  "templateId": "demo-postcard",
  "assetIds": [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222"
  ]
}
```

按数组顺序保存 position；数量必须与模板一致。模板存在性、素材归属、实际可用性、类型大小和重复 ID 均由后端校验。验证失败不建任务。

202，带 `Location: /api/tasks/{taskId}`：

```json
{
  "taskId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "status": "QUEUED",
  "createdAt": "2026-10-28T14:00:00.000Z",
  "replayed": false
}
```

- 创建请求不等待 Worker。返回 status 是建档/调度后的观察值，不保证一定是 QUEUED。
- 同用户同幂等键、同规范化内容：仍返回 202，同 taskId，`replayed:true`；不重复投递。幂等记录随任务保留，V1 无过期策略。
- 同键不同内容：409 `IDEMPOTENCY_CONFLICT`。不同用户的同键互不影响。
- 线程池拒绝：已创建任务持久化 FAILED / EXECUTOR_REJECTED，三阶段 SKIPPED，仍返回 202 + 对应 taskId；UI 立即查询并展示失败原因。
- 如果任务已入库，但后续状态读取/拒绝写入因 DB 故障未能确认，返回 503 `SUBMISSION_UNCERTAIN`，details 可含 taskId；客户端保留原键重试，不推断没有创建任务。

开发覆盖示例，必须额外携带 `X-Demo-Control-Key` 且配置允许覆盖：

```json
{
  "templateId": "demo-avatar",
  "assetIds": ["11111111-1111-4111-8111-111111111111"],
  "simulation": {
    "failAtStep": "GENERATE",
    "delaysMs": {"validate": 1000, "generate": 10000, "finalize": 1000}
  }
}
```

simulation 为可选对象，null 与省略均使用默认配置；对象必须含 failAtStep（阶段名或 null）和完整 delaysMs，单值 0～30000 的整数。不出现则使用环境默认值。未开覆盖返回 400 `SIMULATION_DISABLED`，密钥错误/缺失返回 403 `DEMO_CONTROL_FORBIDDEN`；普通浏览器页面不接触密钥。覆盖仅影响本任务，绝不修改其他任务或全局设置。

## 6. 查询任务与历史

### GET /api/tasks/{id}

登录，返回一致快照：

```json
{
  "taskId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "templateId": "demo-postcard",
  "templateTitle": "旅行明信片",
  "status": "FAILED",
  "currentStep": "GENERATE",
  "resultUrl": null,
  "errorCode": "SIMULATED_FAILURE",
  "errorMessage": "模拟生成阶段按测试配置触发失败",
  "version": 3,
  "createdAt": "2026-10-28T14:00:00.000Z",
  "updatedAt": "2026-10-28T14:00:06.000Z",
  "startedAt": "2026-10-28T14:00:00.000Z",
  "finishedAt": "2026-10-28T14:00:06.000Z",
  "assets": [
    {"assetId":"11111111-1111-4111-8111-111111111111","position":1,"previewUrl":"/api/assets/11111111-1111-4111-8111-111111111111/content"},
    {"assetId":"22222222-2222-4222-8222-222222222222","position":2,"previewUrl":"/api/assets/22222222-2222-4222-8222-222222222222/content"}
  ],
  "steps": [
    {"name":"VALIDATE","order":1,"status":"SUCCEEDED","startedAt":"2026-10-28T14:00:00.000Z","finishedAt":"2026-10-28T14:00:01.000Z","errorCode":null,"errorMessage":null},
    {"name":"GENERATE","order":2,"status":"FAILED","startedAt":"2026-10-28T14:00:01.000Z","finishedAt":"2026-10-28T14:00:06.000Z","errorCode":"SIMULATED_FAILURE","errorMessage":"模拟生成阶段按测试配置触发失败"},
    {"name":"FINALIZE","order":3,"status":"SKIPPED","startedAt":null,"finishedAt":null,"errorCode":null,"errorMessage":null}
  ]
}
```

`currentStep` 是正在或最后处理的阶段；任务未开始即失败时为 null。成功时 resultUrl 为 `/api/tasks/{id}/result` 且错误字段为 null。steps 按 order 排序，不允许客户端以经过时间猜阶段。

### GET /api/tasks?status=ALL&templateId=...&limit=20&cursor=...

只查询当前用户：status 为 ALL（默认）、ACTIVE（QUEUED/RUNNING）、SUCCEEDED 或 FAILED。limit 默认 20、范围 1～100；cursor 为上一页 nextCursor。返回 `{items:[TaskSummary],nextCursor:null|string}`，TaskSummary 为详情去掉 assets、steps。未知筛选值、坏游标为 400；无记录为 200 空数组。

前端首次/刷新先查历史首页，再按 ACTIVE 分页扫完当前作用域的所有进行中任务，避免只给历史第一页做轮询导致遗漏较早任务。新任务通过创建响应追加并补查详情。筛选条件改变后丢弃旧游标。

### GET /api/tasks/{id}/result

校验用户归属与任务状态后返回二进制图片；非成功 409 `RESULT_NOT_READY`，结果文件故障 503 `RESULT_UNAVAILABLE`。URL 不包含服务器文件路径，不作为公开分享链接。

## 7. 错误码表

| HTTP | code | 场景/前端动作 |
|---|---|---|
| 400 | INVALID_REQUEST / INVALID_CURSOR | 格式、未知字段、参数不合法，显示定位信息 |
| 400 | INVALID_ASSET_COUNT / DUPLICATE_ASSET | 数量错误或重复图片 ID，修正上传槽 |
| 400 | INVALID_IMAGE / IMAGE_DIMENSIONS_EXCEEDED | 损坏图片/尺寸限制，换图 |
| 400 | ASSET_CONSTRAINT_VIOLATION | 图片不满足当前模板约束 |
| 400 | SIMULATION_DISABLED | 非允许环境提交模拟覆盖 |
| 401 | UNAUTHENTICATED | 暂停查询、清理个人缓存、重新选择身份 |
| 403 | CSRF_INVALID | 刷新身份/token，保留原任务幂等键 |
| 403 | DEMO_CONTROL_FORBIDDEN | 开发覆盖密钥不合法 |
| 404 | TEMPLATE_NOT_FOUND / ASSET_NOT_FOUND / TASK_NOT_FOUND | 不存在或无权；不区分他人对象 |
| 409 | IDEMPOTENCY_CONFLICT / RESULT_NOT_READY | 重复键内容冲突/结果未就绪 |
| 413 | FILE_TOO_LARGE | 超过文件或请求体上限 |
| 415 | UNSUPPORTED_IMAGE_TYPE | 类型不支持或声明与实际不符 |
| 503 | STORAGE_UNAVAILABLE / ASSET_UNAVAILABLE / RESULT_UNAVAILABLE / COVER_UNAVAILABLE | 存储不可用，保留已知业务状态 |
| 503 | SERVICE_UNAVAILABLE / SUBMISSION_UNCERTAIN | DB 等暂不可用；提交不确定时用原键确认 |
| 500 | INTERNAL_ERROR | 未预期服务异常，展示通用提示并保留 requestId |

`SIMULATED_FAILURE`、`EXECUTOR_REJECTED`、`SERVER_RESTARTED`、`STEP_EXECUTION_FAILED`、`EXECUTION_INTERRUPTED` 是**任务数据中的业务失败码**，通常通过 200 详情返回；不能与 HTTP 请求失败混为一谈。

## 8. 联调顺序

1. 通过同源入口取得 csrf、选择 A 身份、刷新 csrf、读取 me，确认 Cookie 与 token 正确。
2. 查询模板列表/详情/封面，分别测试空分类与无效模板。
3. 上传合法文件，再读取 previewUrl；用 B 会话访问 A 的素材，预期 404。
4. 带幂等键建任务，立即查询详情，观察三阶段；同键重试确认 taskId 不变。
5. 带开发密钥创建第二阶段失败任务，核对 FINALIZE=SKIPPED。
6. 切换身份与断网，核对查询失败仅改变界面查询状态。

具体可复制的 curl 流程见[部署文档 §4](08-delivery-and-plan.md#4-实现后联调示例)。也可在已启动的本机 Compose 上执行 python3 scripts/smoke.py，验证同源真实业务。
