# 模板封面

三个 SVG 为本项目自制的几何插画，不使用外部照片或远程素材。Java 服务返回对应的 PNG，源文件保留以便修改。

安装前端依赖后，在 frontend 中执行 `npm run covers:generate` 可重新生成 `backend/src/main/resources/demo-covers/*.png`。生成脚本使用锁定的 sharp 版本；构建本身直接使用已提交 PNG，无需额外运行脚本。
