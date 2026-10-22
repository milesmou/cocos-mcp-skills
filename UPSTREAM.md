# 上游来源

`cocos-mcp` 的默认 MCP 服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，原作者为 Funplay，沿用其 MIT 许可证。技能与桥接辅助能力的来源及许可边界单独记录如下。

| 本地内容 | 上游 | 导入提交 | 许可记录 |
| --- | --- | --- | --- |
| `cocos-mcp/` 默认服务 | [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp) | `dcacbea10be7baa6c2a2e7fe79f275f104dd44ba` | MIT，保留 `cocos-mcp/LICENSE` |
| `cocos-skill/` 组合工作流、UI 参考与离线结构/图像辅助脚本 | 原 `milesmou/cocos3-skill`（仓库已删除） | `8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1` | 上游快照无独立 LICENSE，未另行指定 |
| `cocos-mcp/lib/creator-bridge/`、`panel/prefab-preview.js`、`compat/creator-bridge/` 与 `docs/creator-bridge/` | 同上 | 同上 | 同上 |

代码直接纳入本仓库管理，不使用 Git 子模块，也不包含上游 `.git`。`.work/upstream/` 仅保存本地对照副本，已忽略。

本地新增的 Codex 入口、安装器和连接管理由本仓库维护。默认通过 `scripts/install-codex.js` 安装到 Codex，工程侧桥接在首次使用时按需安装并返回重启提示；上游的“先手动安装工程插件”不再是默认入口。

更新仍维护的上游时，在临时目录获取新快照，比较相应源目录并合并改动，保留本仓库的统一技能入口、模块路径、桥接归属和分发限制，最后运行服务与技能检查并更新本表的提交号。原 `cocos3-skill` 仓库已删除，其导入内容由本仓库继续维护，表中提交号用于历史溯源。避免用上游完整目录覆盖当前整合结果。原逐项操作技能和独立资源增删改脚本已去重，不能在更新时重新导入；底层能力与参数维护在 MCP，技能维护组合工作流。

`cocos-mcp/preview-template/` 的 EJS 和节点树面板基于用户提供的 MyCookingGirl Creator 3.8.8 预览模板，新增本地 Agent 执行器与认证中继。该项目模板没有提供独立 LICENSE，不能视为 Funplay MIT 授权范围；发布或再分发前需确认其许可。

可选 Chrome 调试运行时为 Google / ChromeDevTools 的 [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)，固定 npm 版本 `1.11.0`，许可 Apache-2.0。由安装器放在用户 Codex 目录，不复制其实现到本仓库，不扩展 Funplay MIT 的许可边界。

Funplay 内置的 `Funplay Cocos MCP Workflow` 与 `Funplay Cocos UI Composition` 已合并至 `cocos-skill/` 的协作/验收模块和 UI、工程就绪参考；原编辑器技能管理面板、模板分发和旧模板创建入口已移除。合并内容保留 Funplay MIT 声明，见 [技能来源](cocos-skill/NOTICE.md)，不为其余 cocos3-skill 内容另行指定许可。
