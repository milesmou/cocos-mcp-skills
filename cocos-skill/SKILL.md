---
name: cocos-skill
description: 配合 Cocos MCP 完成 Cocos Creator 3.8 的 UI 分析、节点蓝图、资源映射、拼装、美术替换及任务验收，并按工程架构设计业务组件。适用于需要组合工具完成的工程任务；底层场景、节点、组件、资源、动画和截图操作由 MCP 提供。
---

# Cocos Creator 工作流

先确认用户指定的工程路径、Creator 版本和目标场景或 Prefab，复用已经打开的编辑器。以 MCP 返回的 UUID、组件类型和资源信息为准，修改后保存并重新读取结果。

## 执行入口

在线任务先读 [MCP 协作流程](modules/mcp-workflow.md)，使用已连接的 `cocos-mcp` 工具。底层操作参数与桥接安装统一查阅 MCP 自带文档或运行时 schema，不在技能中维护第二套 API 手册。

## 按任务加载

只读取相关模块；下表各项都是本技能的内部文档，不是独立技能。

| 任务 | 模块 |
| --- | --- |
| 确认工程、选择工具、组织修改步骤 | [MCP 协作流程](modules/mcp-workflow.md) |
| UI 分析、蓝图、拼装与美术替换 | [UI](modules/assemble-cocos-ui.md) |
| 根据修改范围组合检查、判断证据与验收结论 | [验收与离线结构检查](modules/validate-cocos-content.md) |
| cookMachine 架构下的章节专用业务逻辑 | [项目专用示例](modules/create-special-cook-machine.md) |

只有目标工程实际采用 `cookMachine` / `cocos3-toolkit` 架构且任务涉及章节烹饪设备时，读取 [项目专用示例](modules/create-special-cook-machine.md)。MyCookingGirl 的 UI 参考也仅在对应项目结构中使用，不作为其他工程的默认结构。

## 操作边界与验证

- 场景与 Prefab 的写入优先通过编辑器消息和可用 MCP 工具完成，保留 Prefab 实例关系与撤销语义；不把序列化 JSON 当作常规编辑入口。
- 资源操作使用 MCP/AssetDB，保持既有 UUID 与 `.meta`；技能不再提供独立的资源导入、移动或重命名实现。
- 用户只要求分析或蓝图时交付分析；已经要求制作或修复时继续完成相应编辑与验证。
- 桥接截图和运行时中间文件先写目标工程 `temp/cocos-skill/<任务>/`；桥接会拒绝 `temp/` 外的 PNG 输出。本仓库自身的临时验证产物使用 `.work/`，正式交付遵循用户指定位置。
- 等待导入、脚本注册和异步操作的实际结果，按改动检查引用、编译、布局、交互或运行画面。离线引用检查通过不代表脚本编译或游戏运行通过。

辅助脚本仅保留 MCP 尚未覆盖的离线对象表检查、图片图册与图片比较。命令中的 `<技能根目录>` 是本技能目录的绝对路径，`<工程目录>` 是目标 Creator 工程的绝对路径；替换占位符并保留引号。
