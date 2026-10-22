# cocos-mcp-skills

面向 Cocos Creator 引擎工作流的 MCP 工具与技能集合，围绕工程检查、场景与 Prefab 编辑、资源管理、脚本开发、UI 调整、预览与构建组织能力。

| 模块 | 用途 |
| --- | --- |
| [Cocos MCP](cocos-mcp/README.md) | 嵌入 Creator 编辑器的 MCP 服务，提供脚本执行、场景与资源工具、预览截图、诊断和构建状态查询；包含可选认证桥接 |
| [Cocos Skill](cocos-skill/README.md) | 统一技能入口，负责 UI 蓝图、资源映射、拼装、美术替换、业务设计与任务验收；仅保留离线结构和图像辅助检查 |

目标工作流是先确认工程路径、引擎版本和编辑器连接，读取当前场景与资源状态，再通过技能配合 MCP 工具完成编辑、保存及相应验证，最后交付修改结果与验证记录。资源操作需要保留 UUID、`.meta` 文件和引用关系，具体 API 与操作方式以目标工程的 Creator 版本为准。

`cocos-mcp` 的默认服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，技能与可选桥接整合自 [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill)。来源提交与许可边界见 [UPSTREAM.md](UPSTREAM.md)。

## 开始使用

1. 按 [服务说明](cocos-mcp/README.md) 将 `cocos-mcp/` 安装到目标 Creator 工程，打开服务面板并连接 MCP 客户端。
2. 将 `cocos-skill/` 作为一个技能目录安装，使用唯一入口 [SKILL.md](cocos-skill/SKILL.md)，不再分别注册内部模块。
3. 按任务确认工程路径、版本和编辑对象，再完成编辑、保存与验证。需要原技能的专用场景辅助方法或内部 Prefab PNG 渲染时，按需安装可选桥接。

场景、节点、组件、资源、脚本创建、动画、预览和截图等底层操作统一由 MCP 提供；技能只保留组合工作流，不重复维护逐项操作模块、桥接手册或资源增删改脚本。工具说明见 [MCP 工具手册](cocos-mcp/docs/TOOLS.md)，桥接说明见 [服务文档](cocos-mcp/docs/creator-bridge/README.md)。

当前工作流面向 Cocos Creator 3.8.x，Node.js 要求 18+。内部 Prefab PNG 渲染限 3.8.5–3.8.x；UI 图片图册和严格对比另外需要 Python 3.10+ 与 Pillow。具体工具是否可用以服务 schema、目标编辑器版本和当前 profile 为准。

## 本地检查

在仓库根目录执行；服务和离线脚本均无第三方 npm 运行依赖：

```powershell
npm --prefix cocos-mcp run check
npm --prefix cocos-mcp run check:compat
npm --prefix cocos-mcp test
npm --prefix cocos-mcp run docs:check
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
```

这些检查不代替真实 Creator 工程中的编辑、预览和构建验收。模块环境要求、安装方式和详细用法分别见各目录的 README。

开发与 Agent 协作规则见 [AGENTS.md](AGENTS.md)。
