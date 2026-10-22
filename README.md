# cocos-mcp-skills

面向 Cocos Creator 3.8.x 的 MCP 工具与技能集合，支持场景与 Prefab 编辑、UI 拼装、资源和脚本协作、运行时排障与性能分析。

- [cocos-mcp](cocos-mcp/README.md)：安装到 Codex，自动检查工程桥接，提供编辑器、游戏运行时和 Chrome DevTools 工具。
- [cocos-skill](cocos-skill/README.md)：统一技能入口，组织 UI 制作、业务开发和任务验收流程。

## 安装

需要 Node.js 18+。在仓库根目录执行：

```powershell
node scripts/install-codex.js
```

安装器注册 `cocos-mcp`，并链接用户级 `cocos-skill`。保留源码目录；当前会话未加载工具时，重新连接 MCP。

需要 Chrome 控制台、网络、性能和内存分析时，安装可选运行时（环境与授权要求见 [DevTools 文档](cocos-mcp/docs/DEVTOOLS.md)）：

```powershell
node scripts/install-codex.js --devtools
```

## 使用

在 Codex 中指定工程和任务，例如：

> 使用 $cocos-skill 调整 D:/Games/MyGame 的登录页，完成后验证布局与交互。

Agent 会连接目标工程，首次使用时安装唯一插件 `cocos-mcp-bridge` 和预览模板。出现重启提示后，保存并完全重启 Creator，再次连接确认 `connected: true`。读取游戏运行时数据前，打开或刷新原 Web 预览。

旧插件迁移与连接说明见 [安装文档](cocos-mcp/docs/CODEX_SETUP.md)，能力与参数见 [工具手册](cocos-mcp/docs/TOOLS.md)。开发和检查命令见 [CONTRIBUTING.md](cocos-mcp/CONTRIBUTING.md)，Agent 约定见 [AGENTS.md](AGENTS.md)。

## 来源

`cocos-mcp` **fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)**，保留 Funplay MIT 声明。技能与桥接辅助能力由本仓库统一维护，历史来源和许可边界见 [UPSTREAM.md](UPSTREAM.md)。
