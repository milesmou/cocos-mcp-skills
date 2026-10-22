# cocos-skill

面向 Cocos Creator 3.8.x 的任务工作流技能，整合自 [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill)。唯一技能入口是 [SKILL.md](SKILL.md)，保留 MCP 协作、UI 拼装、验收和项目专用业务逻辑 4 个内部模块。

技能负责分析需求、形成蓝图、选择资源、组织工具调用和判断验收结果。场景、节点、组件、资源、脚本创建、动画、截图与预览等底层能力统一由 `cocos-mcp` 提供，技能不再维护对应操作模块或重复的资源处理脚本。

| 内容 | 位置 |
| --- | --- |
| 技能入口与任务路由 | [SKILL.md](SKILL.md) |
| MCP 协作、UI 拼装、验收、cookMachine 业务设计 | `modules/` |
| UI 蓝图、视觉检查和特定工程的结构约定 | `references/` |
| 离线对象表检查、图片图册及图片比较 | `scripts/` |
| 离线对象表检查的回归测试 | `tests/` |

## 使用

将本目录作为一个完整技能目录安装到客户端的技能位置，保留 `modules/`、`references/`、`scripts/` 和 `agents/`。不要将每个模块再安装为单独技能。

在线编辑需要先按 [cocos-mcp 安装说明](../cocos-mcp/README.md) 将服务安装到目标 Creator 工程并连接 MCP 客户端，再使用 `$cocos-skill`。工具参数以客户端 schema 和 MCP 自带的 [工具手册](../cocos-mcp/docs/TOOLS.md) 为准；可选桥接安装、API 与预览说明归 [MCP 桥接文档](../cocos-mcp/docs/creator-bridge/README.md) 维护。

例如：“使用 cocos-skill 检查指定工程的登录页 Prefab，在保留现有脚本引用的前提下调整布局并验证。”目标工程路径与 Creator 版本应在开始操作时确认。

## 环境与验证

- Node.js 18+：离线对象表检查和测试。
- Cocos Creator 3.8.x：在线工作流；内部 Prefab PNG 仅支持 3.8.5–3.8.x。
- Python 3.10+ 与 Pillow：仅图片图册和严格 RGBA 对比需要。

在仓库根目录执行：

```powershell
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
node cocos-skill/scripts/validate-project.mjs --project "<工程目录>"
```

离线对象表检查是只读补充，检查磁盘场景/Prefab 的越界 `__id__`、无效对象表、孤立或缺失 `.meta` 和重复 UUID。这些检查未被当前 MCP 的引用检查完整覆盖；通过后仍需按任务验证脚本、交互和运行画面。

MyCookingGirl / `cookMachine` 示例仅适用于实际具有对应架构的目标工程，不会自动决定编辑目标。来源和许可说明见 [NOTICE.md](NOTICE.md)。
