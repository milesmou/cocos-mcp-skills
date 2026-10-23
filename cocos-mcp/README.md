# cocos-mcp

面向 Cocos Creator 3.8.x 的本地 MCP 服务，**fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)**，保留 Funplay 的 [MIT 许可证](LICENSE)。其他桥接和模板内容的许可边界见 [NOTICE.md](NOTICE.md)。

## 安装与连接

需要 Node.js 18+。在仓库根目录执行：

```powershell
node scripts/install-codex.js
```

Codex 服务名为 `cocos-mcp`，入口是 `bin/cocos-mcp.js`；工程内唯一插件为 `cocos-mcp-bridge`，包含 MCP、认证辅助方法、Prefab 渲染和 Web 预览中继。

桥接随 Creator 自动启动，使用默认配置并开放全部工具，无需编辑器菜单或设置面板。

调用 `connect_cocos_project` 并传入工程绝对路径。缺少插件时自动安装桥接与预览模板，返回 `restart_required`；保存并完全重启 Creator 后再次连接，确认 `connected: true` 再编辑。

已有同名插件不自动覆盖。旧 `funplay-cocos-mcp` / `cocos3-codex-bridge` 使用 `migrateLegacy: true` 迁移，完整备份后移出扩展目录。详细流程见 [安装与迁移](docs/CODEX_SETUP.md)。

## 能力

- 场景、节点、组件、资源与 Prefab 查询和编辑。
- 脚本诊断、日志、预览、截图和构建状态查询。
- `execute_javascript`：`editor` 操作编辑器，`scene` 操作编辑场景，`runtime` 读取正在运行的 Web 预览。
- `cocos_devtools`：Chrome 控制台、网络、性能录制和堆分析，需先执行 `node scripts/install-codex.js --devtools`。

配合 [cocos-skill](../cocos-skill/SKILL.md) 完成组合任务。运行时查询需打开或刷新原 Web 预览；内部 Prefab PNG 支持 Creator 3.8.5–3.8.x。

## 文档

- [工具手册](docs/TOOLS.md) · [编辑器执行](docs/EDITOR_WORKFLOW.md)
- [运行时 JavaScript](docs/creator-bridge/runtime-javascript.md) · [Chrome DevTools](docs/DEVTOOLS.md)
- [辅助桥接与兼容 CLI](docs/creator-bridge/README.md)
- [开发与检查](CONTRIBUTING.md) · [上游来源](../UPSTREAM.md)

本整合版由本地源码维护，禁止使用上游发布包覆盖更新。
