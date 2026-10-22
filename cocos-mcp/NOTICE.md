# 来源与变更

`cocos-mcp` 的默认 MCP 服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，上游提交为 `dcacbea10be7baa6c2a2e7fe79f275f104dd44ba`，版本 `0.6.8`。原作者为 Funplay，保留原 [MIT 许可证](LICENSE)。

本仓库将其整合在 `cocos-mcp/`，保留原内部扩展标识、菜单、客户端兼容能力及测试；增加可选 Creator 3.8 桥接、分发说明和对应检查。源码分发禁用上游发布包覆盖与自动检查，并调整上游测试的 Windows 路径、实际文件权限与符号链接能力检测。原英文介绍保存在 [UPSTREAM_README.md](UPSTREAM_README.md)，中文上游介绍保存在 [README_CN.md](README_CN.md)。上游介绍中的安装、更新和发布链接描述上游产品，不代表当前整合版的分发地址。

`compat/creator-bridge/` 及 `docs/creator-bridge/` 的桥接与操作说明来自 [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill)，提交为 `8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1`。文档从技能侧迁入后调整路径与术语，避免两处维护。此部分不属于 Funplay 的 MIT 授权内容，具体见 [桥接来源说明](compat/creator-bridge/NOTICE.md)。
