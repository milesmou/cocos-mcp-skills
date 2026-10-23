# 来源与变更

`cocos-mcp` 的默认 MCP 服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，上游提交为 `dcacbea10be7baa6c2a2e7fe79f275f104dd44ba`，版本 `0.6.8`。原作者为 Funplay，保留原 [MIT 许可证](LICENSE)。

本仓库将其整合在 `cocos-mcp/`，统一工程内扩展标识为 `cocos-mcp-bridge`，保留客户端兼容能力及测试；合并 Creator 3.8 桥接、分发说明和对应检查。源码分发禁用上游发布包覆盖与自动检查，并调整上游测试的 Windows 路径、实际文件权限与符号链接能力检测。原英文介绍保存在 [UPSTREAM_README.md](UPSTREAM_README.md)，中文上游介绍保存在 [README_CN.md](README_CN.md)。上游介绍中的安装、更新和发布链接描述上游产品，不代表当前整合版的分发地址。

默认安装入口改为 Codex 侧本地 MCP：增加工程桥接检查与按需安装、重启状态返回、工程身份校验和连接文件发现。引擎操作仍由工程内桥接执行；保留原 HTTP/stdio 代理供已有客户端兼容。安装和重新连接流程见 [CODEX_SETUP.md](docs/CODEX_SETUP.md)。

`lib/creator-bridge/`、`panel/prefab-preview.js`、`compat/creator-bridge/` 及 `docs/creator-bridge/` 的桥接与操作说明来自原 `milesmou/cocos3-skill`（仓库已删除），导入提交为 `8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1`，现由本仓库维护。文档从技能侧迁入后调整路径与术语，避免两处维护。此部分不属于 Funplay 的 MIT 授权内容，具体见 [桥接来源说明](compat/creator-bridge/NOTICE.md)。

`preview-template/` 基于用户提供的 MyCookingGirl Creator 3.8.8 模板，保留节点树面板并新增运行时 JavaScript 查询。它与来自 cocos3-skill 的桥接内容单独记录许可，不属于 Funplay 的 MIT 授权范围。

本地整合版已移除编辑器服务菜单、工具开放范围和设置面板及其 IPC 管理逻辑，固定自动启动并开放全部工具。旧配置文件保留但不再读取；内部 Prefab 渲染面板继续由工具按需使用。
