# Cocos MCP 本地源码整合版

面向 Cocos Creator 3.8.x，默认服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，保留 Funplay MIT 声明。来源与其他桥接代码的许可边界见 [NOTICE](../NOTICE.md)。本仓库不作为 Cocos Store 发布包分发。

- Codex 侧入口为 `cocos-mcp`，Creator 未运行时也可初始化、检查工程并安装缺失插件。
- 工程只安装一个 `cocos-mcp-bridge`：MCP、场景辅助方法、白名单 Editor 消息、内部 Prefab 渲染和普通 Web 预览中继统一加载。
- 编辑器提供 39 个 core / 105 个 full 工具；Codex 入口另有两个连接工具和一个 DevTools 入口，实际暴露范围以 schema 为准。
- `execute_javascript` 支持 editor、scene、runtime 上下文；runtime 读取正在运行的普通 Web 预览。
- 管理窗口为 MCP Server、Tool Exposure、MCP Settings；内部 Prefab 渲染器按需打开。Workflow 与 UI Composition 已合入唯一 `cocos-skill`，编辑器不再管理内置 Skills。
- 源码更新由仓库维护，禁止面板下载上游包覆盖整合版。Chrome DevTools 运行时另行安装。

在仓库根目录执行 `node scripts/install-codex.js`，然后通过 `connect_cocos_project` 指定工程绝对路径。首次安装后保存并完全重启 Creator，再次连接确认 `connected: true`，刷新原 Web 预览以启用运行时查询。

旧 `funplay-cocos-mcp` 和 `cocos3-codex-bridge` 使用 `migrateLegacy: true` 迁移；完整备份后移出扩展目录。已有同名插件不自动覆盖。详见 [安装说明](CODEX_SETUP.md)、[工具手册](TOOLS.md) 和 [DevTools](DEVTOOLS.md)。
