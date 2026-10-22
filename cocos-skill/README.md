# cocos-skill

面向 Cocos Creator 3.8.x 的统一工作流技能，配合 [cocos-mcp](../cocos-mcp/README.md) 完成工程检查、UI 蓝图与拼装、美术替换、业务开发、运行时排障、性能分析和验收。

唯一入口是 [SKILL.md](SKILL.md)，按任务加载内部模块和参考文档。底层编辑操作由 MCP 提供；技能仅保留离线对象表检查、图片图册与图片比较脚本。

## 使用

按[仓库安装说明](../README.md#安装)安装后，在 Codex 中指定工程和任务：

> 使用 $cocos-skill 检查 D:/Games/MyGame 的登录页 Prefab，调整布局并验证交互。

首次连接会安装缺失桥接并提示重启 Creator；重启后再次连接，确认就绪再编辑。MyCookingGirl / cookMachine 示例仅用于采用对应架构的工程。

## 离线检查

在仓库根目录执行，需要 Node.js 18+：

```powershell
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
node cocos-skill/scripts/validate-project.mjs --project "<工程目录>"
```

离线脚本检查场景/Prefab 对象表、`.meta` 和重复 UUID；通过后仍需验证编译与运行效果。图片图册及严格 RGBA 对比另需 Python 3.10+ 与 Pillow。

本技能整合 cocos3-skill 与 Funplay 的 Workflow、UI Composition 指引，来源和许可见 [NOTICE.md](NOTICE.md)。
