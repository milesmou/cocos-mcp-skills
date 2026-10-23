---
name: cocos-skill
description: 配合 Cocos MCP 处理 Cocos Creator 3.8 工程检查、场景与 Prefab 编辑、资源和脚本协作、UI 蓝图和拼装、响应式布局、美术替换、运行时排障、性能分析及验收。适用于需要组合工具完成的工程任务；底层编辑与 DevTools 操作由 MCP 提供。
---

# Cocos Creator 工作流

先确认用户指定的工程路径、Creator 版本和目标场景或 Prefab。通过 Codex 侧 MCP 检查工程桥接；已有可用连接时复用编辑器，缺少插件时按连接结果提示用户重启。以 MCP 返回的 UUID、组件类型和资源信息为准，修改后保存并重新读取结果。

## 执行入口

在线任务先读 [MCP 协作流程](modules/mcp-workflow.md)。通过 MCP 操作外部工程前，显式读取目标工程的 `AGENTS.md`、适用的目录级规则及其中指定的任务相关文档；不能假设从工具仓库启动会自动加载另一工程的规则。工程专用组件、命名、资源路径和业务约定由目标工程维护，不在通用技能中预设。

完成规则读取后，调用 `connect_cocos_project` 并传入目标工程绝对路径。它会安装缺失的工程桥接插件；返回 `restart_required` 时，提示用户保存并完全重启该工程的 Creator，等待用户完成后再次连接。只有 `connected: true` 才能进行编辑操作，不自动关闭或重启用户的编辑器。

Codex 侧 MCP 可以在 Creator 未启动时工作。工具参数、桥接安装和服务实现统一查阅 MCP 自带文档或运行时 schema，技能不提供另一套安装脚本。

## 按任务加载

只读取相关模块；下表各项都是本技能的内部文档，不是独立技能。

| 任务 | 模块 |
| --- | --- |
| 确认工程、选择工具、组织修改步骤 | [MCP 协作流程](modules/mcp-workflow.md) |
| UI 分析、蓝图、拼装与美术替换 | [UI](modules/assemble-cocos-ui.md) |
| 资源导入、脚本/预览就绪、真实输入与保存证据 | [工程就绪](references/project-readiness.md) |
| Widget/Layout、SafeArea、滚动、组件属性归属与动画 | [UI 组件规则](references/assemble-cocos-ui/ui-rules.md) |
| SpriteFrame、九宫格与导入器修改 | [切图与导入](references/assemble-cocos-ui/art-slicing.md) |
| 字体、溢出、缺字和用户要求的本地化 | [字体与本地化](references/assemble-cocos-ui/text-and-localization.md) |
| 根据修改范围组合检查、判断证据与验收结论 | [验收与离线结构检查](modules/validate-cocos-content.md) |
| Chrome 预览异常、网络排障、卡顿与内存分析 | [运行时排障与性能分析](modules/analyze-runtime-performance.md) |

## 操作边界与验证

- 场景与 Prefab 的写入优先通过编辑器消息和可用 MCP 工具完成，保留 Prefab 实例关系与撤销语义；不把序列化 JSON 当作常规编辑入口。
- 资源操作使用 MCP/AssetDB，保持既有 UUID 与 `.meta`；技能不再提供独立的资源导入、移动或重命名实现。
- 用户只要求分析或蓝图时交付分析；已经要求制作或修复时继续完成相应编辑与验证。
- 桥接截图和运行时中间文件先写目标工程 `temp/cocos-skill/<任务>/`；桥接会拒绝 `temp/` 外的 PNG 输出。本仓库自身的临时验证产物使用 `.work/`，正式交付遵循用户指定位置。
- 等待导入、脚本注册和异步操作的实际结果，按改动检查引用、编译、布局、交互或运行画面。离线引用检查通过不代表脚本编译或游戏运行通过。

辅助脚本仅保留 MCP 尚未覆盖的离线对象表检查、图片图册与图片比较。命令中的 `<技能根目录>` 是本技能目录的绝对路径，`<工程目录>` 是目标 Creator 工程的绝对路径；替换占位符并保留引号。
