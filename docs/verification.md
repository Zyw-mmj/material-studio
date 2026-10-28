# 来源与验证记录

记录日期：2026-10-28（Asia/Shanghai）。对象：本仓库技术文档 V1.0，非应用验收报告。

本页保留首轮仅交付文档时的检查记录。后续工程初始化、真实 MySQL 测试和容器验证以[初始化记录](09-project-initialization.md)为准；下文“未执行”是首轮文档阶段的状态。

## 1. 输入与完整性

- 原始文件：`/Users/zyw/Downloads/PRD_v1.0.md`。
- 仓库副本：[PRD_v1.0.md](source/PRD_v1.0.md)，776 行，原文保持不变。
- SHA-256：`86457ae30d19264a770b32270de1461b80284731bb557b2abf8a4296c4e253da`。
- 原题截图、UI-01～UI-03 原始图片未提供；未独立核对截图要求，未实施视觉还原。
- 开始工作时项目尚无业务源码或已有提交；本次不创建应用、发布服务或提交 Git commit。

## 2. 文档检查

| 检查 | 方式 | 结果/边界 |
|---|---|---|
| 原文副本 | 字节比较与 SHA-256 | 与用户提供文件一致 |
| OpenAPI | YAML 解析 + openapi-spec-validator | 3.0.3 结构有效，12 个路径、13 个操作、20 个 schema |
| 请求/响应示例 | 解析接口文档 7 个 JSON 示例，以 OAS30Validator 对应 schema 校验 | 7/7 有效；未发送真实 HTTP 请求 |
| SQL 草案 | sqlglot 的 MySQL 方言解析 | 六张 CREATE TABLE、两组 INSERT 可解析；不是 MySQL 实例执行结果 |
| 内部文档链接 | 扫描本次编写的 10 份 Markdown 的本地目标与章节锚点 | 45 个链接/锚点可解析；不自动改写原始 PRD |
| 需求追踪 | 检查 R-01～R-14 与 AT-01～AT-14 覆盖 | 全部在对应追踪表中出现，并人工核对设计入口 |
| 交叉一致性 | 对照状态、字段、路径、身份和文件策略 | 文档/API/SQL 使用统一枚举、接口与六表模型 |
| 代码块与格式 | 检查围栏配对、JSON 语法、非来源文件行尾 | 已检查；Markdown 有意的换行不作为业务测试 |
| Shell 示例 | bash -n 语法检查 | 语法通过，未实际执行启动或 API 命令 |

校验依赖安装于系统临时目录的独立 Python venv，不添加为业务依赖。其作用是检查文档与语法，不生成虚假的构建/测试通过记录。

本次校验工具版本：PyYAML 6.0.3、openapi-spec-validator 0.7.2、openapi-schema-validator 0.6.3、sqlglot 30.25.0、jsonschema 4.25.1。

## 3. 未执行的验证

- 本机可找到 Docker CLI，但 Docker daemon 未运行；没有启动或修改 Docker 服务，因此**未在真实 MySQL 8.4 执行 SQL**。
- 未安装或构建 Next.js / Java 应用；未锁定应用补丁版本和镜像摘要。
- 未运行 API、页面、Worker、MySQL 集成测试、GitHub Actions 或 Compose。
- 未验证 Cookie/CSRF、上传/图片代理、真实文件卷、性能、备份/回滚或 AT-01～AT-14。
- 没有生成三张种子模板对应的封面 PNG；后续工程必须补齐。

这些项目在 [实施计划 S1～S8](08-delivery-and-plan.md#7-开发任务与依赖) 中安排，完成后以实际日志/测试结果替换“待执行”，不能直接沿用设计预期作为证据。

## 4. 官方参考

下列资料于本次设计时访问，用于核验框架兼容与行为；本项目的版本系列、架构和参数均是自身设计决策，不表示官方对该项目的验证。

| 资料 | 本文使用范围 |
|---|---|
| [Next.js 安装](https://nextjs.org/docs/app/getting-started/installation) | Node/TS 基础要求、单独运行 lint |
| [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites) | 采用同源 URL 代理的能力依据 |
| [Node.js Releases](https://nodejs.org/en/about/previous-releases) | 选择 Node 24 LTS 系列 |
| [MyBatis Starter](https://mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/) | starter 4.0 / Boot 4.0+ / Java 17+ 配套矩阵 |
| [Spring Boot 4.0 系统要求](https://docs.spring.io/spring-boot/4.0/system-requirements.html) | JDK 与 Maven 基础兼容要求 |
| [Spring 事务事件](https://docs.spring.io/spring-framework/reference/data-access/transaction/event.html) | 提交后事件机制；本基线实际选择显式提交后投递 |
| [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html) | POST 防护、会话 token 与登录后更新 |
| [MySQL 发布模型](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html) | 选择 8.4 LTS 系列 |

## 5. 变更规则

本次仅编写技术文档，PRD 原文不改。若后续调整身份、字段、状态、模拟方式或部署入口，须同步修改相应章节、OpenAPI、SQL/迁移、验收表和实际 README，并记录版本变化。应用完成前，所有“已实现/已通过”声明都应有真实证据。
