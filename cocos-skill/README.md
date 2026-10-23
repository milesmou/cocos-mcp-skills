# cocos-skill

面向 Cocos Creator 3.8.x 的统一工作流技能，配合 [cocos-mcp](../cocos-mcp/README.md) 完成工程检查、UI 蓝图与拼装、美术替换、业务开发、运行时排障、性能分析和验收。

唯一入口是 [SKILL.md](SKILL.md)，按任务加载内部模块和参考文档。底层编辑操作由 MCP 提供；技能仅保留离线对象表检查、图片图册与图片比较脚本。

## 使用

按[仓库安装说明](../README.md#安装)安装后，在 Codex 中指定工程和任务：

> 使用 $cocos-skill 检查 D:/Games/MyGame 的登录页 Prefab，调整布局并验证交互。

通过 MCP 操作外部工程前，显式读取目标工程的 `AGENTS.md`、适用的目录级规则和其中指定的任务相关文档，不假设从工具仓库启动会自动加载另一工程规则。首次连接会安装缺失桥接并提示重启 Creator；重启后再次连接，确认就绪再编辑。

工程专用组件、命名、资源和业务约定由目标工程维护。原 MyCookingGirl UI 与 cookMachine 规则已集中到[项目 AGENTS 文档](../docs/project-agents/my-cooking-girl/AGENTS.md)，供合并到对应工程；不由通用技能自动加载，也不覆盖目标工程已有规则。

## 离线检查

在仓库根目录执行，需要 Node.js 18+：

```powershell
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
node cocos-skill/scripts/validate-project.mjs --project "<工程目录>"
```

离线脚本检查场景/Prefab 对象表、`.meta` 和重复 UUID；通过后仍需验证编译与运行效果。图片图册及严格 RGBA 对比另需 Python 3.10+ 与 Pillow。

本技能整合 cocos3-skill 与 Funplay 的 Workflow、UI Composition 指引，来源和许可见 [NOTICE.md](NOTICE.md)。
