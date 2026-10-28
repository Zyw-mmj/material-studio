# Material Studio Web

Next.js App Router / React / TypeScript 独立前端，默认端口 3001。Java API 为唯一业务数据来源。

使用根目录 `.nvmrc` 对应 Node，执行 `npm ci`、`npm run dev`。默认 API 指向本机 8080；需要更改时复制 `.env.example` 到 `.env.local`。

`npm run lint`、`npm run typecheck`、`npm run test:run`、`npm run build` 为本地检查；`npm run api:generate` 从 OpenAPI 更新类型。完整容器及数据库启动说明见[项目 README](../README.md)。

当前开放模板列表、分类与详情；上传、身份、任务和历史尚待实现。
