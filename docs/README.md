# 素材制作平台 · 技术文档

设计基线：PRD V1.0 / 2026-10-28；V1.0 业务闭环于 2026-10-29 完成。下列八步保留设计理由，具体源码结构、验证结果与实现取舍以[本轮实现记录](10-full-implementation.md)和[项目 README](../README.md)为准。[v0.1 初始化记录](09-project-initialization.md)是历史快照。

对照用户补充的 9 张原题截图整理的待办、R-01～R-14 当前状态与验收条件见 [TODO](../TODO.md)。

| 步骤 | 文档 | 内容 |
|---|---|---|
| 1 | [需求映射与技术决策](01-requirements-and-decisions.md) | R-01～R-14、范围与版本基线 |
| 2 | [总体架构与模块设计](02-architecture.md) | 前后端边界、模块与事务 |
| 3 | [数据库与文件存储](03-data-and-storage.md) | 六表模型、约束、文件协议 |
| 4 | [接口契约](04-api-contract.md) | 身份、模板、素材、任务与错误 |
| 5 | [异步任务与状态机](05-task-engine.md) | 调度、顺序执行、失败与重启 |
| 6 | [前端页面与状态管理](06-frontend.md) | 页面、上传、轮询与请求隔离 |
| 7 | [测试与验收](07-testing-and-acceptance.md) | 自动化测试与 AT-01～AT-14 |
| 8 | [部署运维与实施计划](08-delivery-and-plan.md) | 完整 V1 的交付目标与步骤 |

配套资料：[原始 PRD](source/PRD_v1.0.md)、[OpenAPI](contracts/openapi.yaml)、[Schema](database/schema.sql)、[种子数据](database/seed.sql)、[首轮文档验证记录](verification.md)。

实施记录：[v0.1 初始化](09-project-initialization.md) → [V1.0 完整实现与验收](10-full-implementation.md)。后续变更同步契约、迁移、测试与运行说明。

后续修正：[启动配置、旧卷密码与多副本检查](11-startup-fix.md)。

界面迭代：[布局、账户与个人任务记录管理](12-layout-and-personal-records.md)。
