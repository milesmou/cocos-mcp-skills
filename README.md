# cocos-mcp-skills

提供 Windows 上的 Cocos Dashboard 工程管理，以及 Cocos Creator 3.8.5 及以上 3.8.x 版本（`>=3.8.5 <3.9.0`）的离线结构检查、素材图册、严格 RGBA 图片比较和 Chrome Web 预览排障。

## 安装

在本仓库根目录执行下方命令（需要 Node.js 18+）。安装器只链接用户级技能，源码目录需保留。

```powershell
npm --prefix cocos-skill ci
node scripts/install-codex.js
```

场景、Prefab、资源和 UI 编辑使用独立的 Funplay MCP。按 [Funplay MCP 安装默认](cocos-skill/modules/setup-funplay-mcp.md)全局安装扩展和 Codex 用户级技能，在目标工程开放全部工具、关闭 MCP 控制台日志，再配置 Codex 连接。Chrome Web 预览排障使用独立的 [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)。

## 从旧版迁移

先按上述步骤接入官方 Funplay 扩展，并通过 `get_project_info` 验证目标工程。随后在 Codex 配置中移除指向本仓库旧入口 `cocos-mcp/bin/cocos-mcp.js` 的服务条目。若工程仍启用此前安装的 `cocos-mcp-bridge`，在 Creator 扩展管理器中停用旧扩展；工程预览模板若有自定义内容，先核对并备份，再按工程需要调整。旧版安装器已建立的技能链接可直接复用。

## 使用

在 Codex 中指定工程和任务，例如：

> 使用 $cocos-skill 离线检查 D:/Games/MyGame 的场景、Prefab 和 .meta。

工程和编辑器的查询、打开、导入及移除操作见 [Dashboard 工程管理](cocos-skill/modules/manage-dashboard-projects.md)。图册、图片比较和排障的用法见 [cocos-skill](cocos-skill/SKILL.md)。开发约定与来源分别见 [AGENTS.md](AGENTS.md) 和 [UPSTREAM.md](UPSTREAM.md)。
