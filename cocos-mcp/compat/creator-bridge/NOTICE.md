# Creator 3.8 兼容桥接

本目录的 `assets/`、`scripts/` 和 `test/` 来自 [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill) 的 `control-cocos-editor/` 与对应测试，提交为 `8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1`。

移动后保持脚本与资源的相对布局，并调整测试路径。桥接仍使用 `cocos3-codex-bridge` 扩展标识，与默认 `funplay-cocos-mcp` MCP 服务分别安装、按需启用。

同一上游的桥接安装、API、Prefab 预览和运行时截图说明位于 `../../docs/creator-bridge/`，统一由服务维护，技能仅链接这些文档。

该上游快照没有独立 LICENSE 文件；不将外层 `cocos-mcp/LICENSE` 的 Funplay MIT 授权推及此目录。
