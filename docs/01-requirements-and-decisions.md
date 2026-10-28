# 第 1 步：需求映射与技术决策

版本 V1.0 · 2026-10-28 · 状态：技术设计基线，待实现验证。

## 1. 输入与边界

输入是 [PRD V1.0](source/PRD_v1.0.md)，共 776 行。首轮设计时未提供原图；工程初始化后，用户补充了 9 张原题与参考界面截图，已据此核对 R-01～R-14，并整理[当前缺口与 TODO](../TODO.md)。参考界面要求主要布局与交互，不要求原品牌、素材或逐像素一致。当前实现范围见[V1.0 实施记录](10-full-implementation.md)。

交付一套可指导实现的技术文档，覆盖浏览模板、上传图片、创建任务、Java 三阶段模拟处理、状态查询和个人历史。真实 AI、支付、视频、管理后台、任务自动重试及多实例调度均不进入 V1。

规则标签：

- **需求必需**：PRD 中明确的功能、技术和工程要求。
- **本次决策**：实现必需目标的一种具体方案，可替换，但替换时同步修改契约、测试与部署说明。
- **后续增强**：不作为本次验收门槛，不占核心闭环的交付时间。

## 2. 可追踪需求

| 编号 | 需求必需/原文语义 | 实现位置 | 验证入口 |
|---|---|---|---|
| R-01 | Next.js App Router / React / TS，Java / Spring Boot / MyBatis，MySQL | [架构](02-architecture.md) | 依赖清单、Java 接口、数据库记录 |
| R-02 | Java 提供模板列表、分类和详情 | [API §3](04-api-contract.md#3-模板接口) | AT-01 |
| R-03 | 按模板上传、预览、替换、移除，前后端校验 | [存储](03-data-and-storage.md)、[前端](06-frontend.md) | AT-02、AT-03 |
| R-04 | 受理后尽快返回 taskId，Java 独立异步执行 | [任务引擎](05-task-engine.md) | AT-04 |
| R-05 | 三阶段顺序、边界、状态及结果/错误持久化 | [数据库](03-data-and-storage.md)、[状态机](05-task-engine.md) | AT-05、AT-07 |
| R-06 | 可指定失败阶段、可调耗时、后续中断 | [模拟配置](05-task-engine.md#6-模拟控制) | AT-06 |
| R-07 | 上传/提交/任务状态清楚，查询异常单独表示 | [前端](06-frontend.md) | AT-08 |
| R-08 | 多任务隔离，终态停止查询，卸载/切换清理 | [轮询](06-frontend.md#5-多任务查询调度) | AT-09、AT-10 |
| R-09 | 刷新从 Java 恢复个人历史和未完成任务，结果预览 | [API](04-api-contract.md)、[前端](06-frontend.md) | AT-11、AT-13 |
| R-10 | 身份可演示，后端检查素材和任务归属 | [身份与权限](04-api-contract.md#2-演示身份与会话) | AT-12 |
| R-11 | 清晰布局、反馈、小屏及键盘可操作 | [页面设计](06-frontend.md) | UI 手工检查 |
| R-12 | CI 前端 lint/类型/构建，Java 测试/构建；关键测试 | [测试](07-testing-and-acceptance.md)、[CI](08-delivery-and-plan.md#5-ci-设计) | AT-14、CI 记录 |
| R-13 | 完整源码、锁文件、SQL、README、范围与 AI 工作流 | [交付清单](08-delivery-and-plan.md#8-最终工程交付清单) | AT-14、验收 commit |
| R-14 | 推荐 Compose，或足够完整的等价启动方式 | [部署](08-delivery-and-plan.md) | 干净环境复现；Compose 为本次选择 |

R-14 中 Compose 属于推荐方式，不能把“未采用 Compose”直接判为需求失败；本方案主动选择 Compose 以减少启动差异。

## 3. 技术基线

以下为**拟采用的版本系列**，不是已经安装或测试通过的依赖清单。实现步骤 S1 必须锁定实际补丁版本、镜像标签/摘要并完成构建验证，不使用 `latest` 作为交付版本。

| 组件 | 选择 | 理由与限制 |
|---|---|---|
| Node.js | 24.x LTS，npm 随运行时锁定 | 统一本地、CI 和容器运行时 |
| Next.js / React / TypeScript | 16.x / 19.x / 5.x | App Router；具体兼容补丁由脚手架与锁文件确定 |
| Java | JDK 21 | 单一运行与编译版本 |
| Spring Boot | 4.0.x | 新项目采用明确的稳定系列，依赖由 Boot BOM 管理 |
| MyBatis Starter | 4.0.x | 与 Spring Boot 4.0 系列配套，不混用 3.0 starter |
| MySQL | 8.4.x LTS / InnoDB | JSON、CHECK 约束和事务；测试也用 MySQL |
| 构建 | Maven Wrapper 3.9.x、npm + package-lock.json | 前端 `npm ci`，后端 `./mvnw` |
| 测试 | JUnit / Spring Boot Test / MySQL Testcontainers；Vitest / Testing Library | 测试依赖具体版本在 S1 固定；浏览器 E2E 可选 |
| 部署 | Docker Compose v2、Next.js Node 服务、Java 单实例 | MySQL 与文件分别持久化 |

版本兼容依据：Next.js 文档给出 Node.js 20.9 的最低要求，并说明 Next.js 16 构建不再自动执行 lint，因此 CI 另设 lint 步骤。[Next.js 安装说明](https://nextjs.org/docs/app/getting-started/installation)

MyBatis 的官方矩阵将 starter 4.0 对应 Spring Boot 4.0+、Java 17+；Spring Boot 4.0 要求 Maven 至少 3.6.3，因此上述 JDK 21 / Maven 3.9 选择在要求范围内，仍须通过实际构建确认。[MyBatis 兼容矩阵](https://mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/)、[Spring Boot 4.0 系统要求](https://docs.spring.io/spring-boot/4.0/system-requirements.html)

Node.js 官方列出 24 为 LTS 系列；MySQL 官方说明 8.4 为 LTS 路线。[Node.js 发布说明](https://nodejs.org/en/about/previous-releases)、[MySQL 发布模型](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html)

## 4. 本次决策记录

| 决策 | 方案 | 取舍/影响 |
|---|---|---|
| D-01 服务结构 | Next.js + Spring Boot 单体 + MySQL | Java 拥有业务与状态；不加 Redis/MQ |
| D-02 浏览器入口 | 同源 `/api/**` 通过 Next.js rewrite 转发 Java | Cookie、上传和图片都走同一入口；需联调转发行为 |
| D-03 用户身份 | 两个固定演示用户，服务端 HttpSession | 无注册/密码；只演示会话与归属隔离，不证明真实身份 |
| D-04 状态同步 | 页面作用域的 HTTP 轮询 | 简单可测，卸载即清理；Worker 不依赖查询 |
| D-05 数据 | MySQL 保存六张业务表；种子数据初始化模板 | 前端不硬编码业务模板 |
| D-06 文件 | 私有本地文件目录 + Docker volume | 由鉴权 API 返回素材/结果，路径不暴露 |
| D-07 任务执行 | 提交事务完成后投递受控线程池，CAS 领取 | 不在请求线程执行，不在提交事务中启动 Worker |
| D-08 失败控制 | 环境默认值 + 演示环境中带开发密钥的单任务覆盖 | 参数在创建时快照；普通页面无全局开关 |
| D-09 阶段中断 | 后续未执行阶段统一 `SKIPPED` | 时间为空，前端显示“未执行” |
| D-10 重启处理 | 单实例启动时将旧非终态任务收敛为失败 | 不恢复执行、不自动重试；历史和文件仍保留 |
| D-11 重复提交 | 必填 `Idempotency-Key`，按用户去重 | 是本次工程增强，非原题强制；原请求重试不重复建任务 |
| D-12 上传移除 | UI 移除关联，不提供物理删除 API | PRD 允许该方式；V1 保留孤立文件，明确容量边界 |

## 5. 业务基线

- 模板种子：创意图片类“旅行明信片”需 2 图、“头像相框”需 1 图；生活记录类“生活封面”需 1 图。
- 仅支持 JPEG、PNG；单图上限 5 MiB（5,242,880 字节）；每次上传一张，所有模板最多 2 图。
- 服务端图片解码后宽高各不超过 8192、像素总数不超过 25,000,000；这是资源保护决策，属于服务端最终校验。
- 成功结果复制第一个槽位的合法输入图片，明确标注“模拟生成”；并不将两张图合成，也不接入 AI。
- 默认耗时：VALIDATE 1000 ms、GENERATE 5000 ms、FINALIZE 1000 ms。单阶段允许 0～30000 ms。
- 日期统一 UTC 存储、ISO 8601 `Z` 返回；浏览器按用户时区展示。本文演示时间按 Asia/Shanghai 理解。
- 不设“精确进度百分比”；以阶段名与状态为准。

## 6. 实施核验与边界

| 项目 | 当前默认 | 核验方式/未通过时处理 |
|---|---|---|
| 实际截止时间、人员投入 | 未提供，不虚构工期承诺 | 按步骤依赖实施；取得截止时间后排期 |
| 原题截图与 UI 图 | 已补充 9 张 | 已完成主要分区与交互；桌面/320px 和键盘检查见实施记录 |
| 依赖补丁与镜像摘要 | 已锁定 | package-lock、POM、Wrapper、Compose 与 CI 文件 |
| rewrite 的 Cookie、multipart、图片响应 | 已完成真实 Compose 冒烟 | scripts/smoke.py、浏览器上传/预览及双身份检查 |
| 存储容量 | 演示规模，无自动清理 | 交付说明实际空间；删除仅在停机且确认备份后人工操作 |

自动化、容器和浏览器证据及未验证边界详见[实施记录](10-full-implementation.md)。
