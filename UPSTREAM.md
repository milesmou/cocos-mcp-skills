# 上游来源

`cocos-mcp` 的默认 MCP 服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，原作者为 Funplay，沿用其 MIT 许可证。技能与可选桥接的来源及许可边界单独记录如下。

| 本地内容 | 上游 | 导入提交 | 许可记录 |
| --- | --- | --- | --- |
| `cocos-mcp/` 默认服务 | [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp) | `dcacbea10be7baa6c2a2e7fe79f275f104dd44ba` | MIT，保留 `cocos-mcp/LICENSE` |
| `cocos-skill/` 组合工作流、UI 参考与离线结构/图像辅助脚本 | [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill) | `8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1` | 上游快照无独立 LICENSE，未另行指定 |
| `cocos-mcp/compat/creator-bridge/` 与 `cocos-mcp/docs/creator-bridge/` | 同上 | 同上 | 同上 |

代码直接纳入本仓库管理，不使用 Git 子模块，也不包含上游 `.git`。`.work/upstream/` 仅保存本地对照副本，已忽略。

更新时在临时目录获取新的上游快照，比较相应源目录并合并改动，保留本仓库的统一技能入口、模块路径、桥接归属和分发限制，最后运行服务与技能检查并更新本表的提交号。避免用上游完整目录覆盖当前整合结果。原逐项操作技能和独立资源增删改脚本已去重，不能在更新时重新导入；底层能力与参数维护在 MCP，技能维护组合工作流。
