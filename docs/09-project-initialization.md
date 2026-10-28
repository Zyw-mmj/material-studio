# v0.1 工程初始化记录

日期：2026-10-28。用户授权在当前目录创建前后端分离工程，并初始化 GitHub 仓库。

## 1. 仓库与结构

[Zyw-mmj/material-studio](https://github.com/Zyw-mmj/material-studio)，私有仓库，默认分支 main。保留原始 PRD 与八步技术文档，新增 frontend / backend 独立工程，不使用 Next.js 代替 Java 业务层。

Git 读取使用 HTTPS；推送使用本机已配置并验证的同一 GitHub 账号 SSH 身份。真实 .env 仅留本机，依赖目录、日志、数据卷和构建产物不进入提交。

## 2. 初始化完成内容

| 范围 | 具体产物 |
|---|---|
| 前端 | Next.js 16.4.3 / React 19.3.1 / TS 5.9.3，App Router，模板列表/分类/详情、错误/空态、小屏样式 |
| API 连通 | 浏览器同源 `/api` rewrite 到 Java，前端不连接数据库；健康接口检查真实 Java 连接 |
| 后端 | Java 21 / Boot 4.0.9 / MyBatis 4.0.0，Controller-Service-Mapper 分层，错误码与 requestId |
| 数据 | Flyway V1 六表结构 + demo profile V2 种子；2 个用户数据记录、3 个模板、2 个分类 |
| 素材 | 3 张自制 SVG 源文件及对应 classpath PNG；提供可重复生成脚本 |
| 安全边界 | 只开放已实现的只读 API；其余接口默认拒绝；保留 CSRF 防护，未创建默认登录密码 |
| 工程 | Maven Wrapper 3.9.11、Node 24.22.1、npm 锁文件、示例配置、Makefile、忽略规则 |
| 容器 | 前端、Java、MySQL 三服务，多阶段镜像、非 root 运行、健康检查、数据库/文件卷 |
| CI | push/PR 触发，前端 lint/type/test/build，Java 单元/真实 MySQL 集成测试及构建，生成类型漂移检查 |

本机已有其他项目占用常见端口，因此当前默认前端 3001、MySQL 宿主 13360；容器内部端口依然是 frontend:3000、backend:8080、mysql:3306。既有其他项目服务未被停止或修改。

## 3. 本次验证

| 项目 | 状态/证据 |
|---|---|
| 干净 npm 安装 | Node 24.22.1 下 npm ci 成功，锁文件可用 |
| 前端 lint / TypeScript | 通过，包含 Next.js 路由类型生成 |
| 前端测试 | 2 个测试文件、4 项通过：业务错误、非 JSON 代理故障、无效成功响应、旧请求隔离 |
| 前端生产构建 | 通过，无构建时后端 API 依赖 |
| Java 单元 | 3 项通过：空分类、无效模板、数据库字段到 DTO 映射 |
| MySQL 集成 | 3 项通过：六表/种子/CHECK 约束、真实查询与筛选、详情/错误/PNG 内容 |
| Java verify | 通过，包含 jar 打包；集成测试无跳过 |
| Docker 镜像 | 前后端 Dockerfile 均已成功构建 |
| Compose 启动 | `docker compose up --build -d --wait` 成功；frontend/backend/mysql 三个服务均 healthy；3001 入口返回模板、筛选、详情及 PNG |
| standalone 启动 | 本机独立 3002 端口执行 npm start，healthz、模板页面及 CSS 均 200；验证后已停止临时进程 |
| 实际 API 联调 | 本机 Java + Compose MySQL 经 Next.js `/api` 代理，health、模板返回正确 |
| 页面 | 实际浏览器已打开模板页，图片与当前能力说明可见；自动化窄屏/键盘完整验收仍待后续业务阶段 |
| GitHub CI | 配置随代码提交；[Actions](https://github.com/Zyw-mmj/material-studio/actions/workflows/ci.yml)记录每个 commit 的实际执行结果 |

初始化期间修正：宿主端口冲突、Testcontainers 的摘要镜像兼容声明、MySQL CHECK 错误的 JDBC 分类断言、非 ASCII 工程目录下封面输出路径、Next.js standalone 的启动方式。

真实 MySQL 的 CHECK 返回错误码 3819，当前驱动将其包装为 UncategorizedSQLException，因此集成测试断言数据库根错误码而不是依赖错误的 Spring 异常子类假设。

## 4. 当前尚未实现

会话登录、CSRF token 业务端点、文件上传/个人访问、创建任务/幂等处理、异步线程池/三阶段状态机、模拟失败配置、多任务轮询/历史与结果。业务表和完整 OpenAPI 已预备，不能据此将这些功能标为完成。

当前只覆盖 PRD 核心工程基础及模板能力，**不等于完整 AT-01～AT-14 验收通过**。下一步按身份→素材→任务引擎→前端任务生命周期推进。

## 5. 复现入口

以[项目 README](../README.md)中的 Compose 或分别启动方式复现。数据库迁移为实际运行输入，[数据库设计](03-data-and-storage.md)保留建模解释。首轮仅文档阶段记录位于[verification.md](verification.md)，其中 Docker 未启动等状态不再代表当前工程状态。
