# 默认 MCP 工作流

本说明统一维护 Funplay MCP 的执行上下文、Editor 消息及可选桥接调用。服务源代码位于 `cocos-mcp/`，内部扩展标识仍为 `funplay-cocos-mcp`；MCP 连接名称由目标工程配置决定，不硬编码客户端工具前缀。

## 建立工程上下文

1. 通过已连接 MCP 的 `get_project_info`、`get_editor_state` 确认工程路径、Creator 版本、当前场景与连接状态。路径与用户目标不一致时先定位正确连接，不操作另一个工程。
2. 使用 `get_tool_catalog` 和客户端实际暴露的 schema 确认工具与参数。默认 `core` 提供聚焦的工具集，`full` 包含更多修改工具；不要假定所有工具都已暴露，也不要绕过禁用设置。
3. 通过 `get_hierarchy`、`get_scene_info`、`inspect_prefab`、`inspect_asset` 等读取当前事实。修改前记录目标 UUID、属性和需要恢复的上下文。

## 编辑器消息与原 CLI 的对应关系

原桥接命令与 MCP 的对应关系如下；技能只负责组合工作流，不再提供逐项操作模块：

| 原命令 | MCP 中的执行方式 |
| --- | --- |
| `request scene <method> <args-array>` | `execute_javascript`，`context: "editor"`，调用 `Editor.Message.request('scene', method, ...args)` |
| `request asset-db <method> <args-array>` | `execute_javascript`，`context: "editor"`，调用 `Editor.Message.request('asset-db', method, ...args)` |
| `request scene-script <method> <args-array>` | 原桥接专属辅助方法；安装可选桥接后，通过它的 CLI，或调用下面的 `execute-scene-script`；不能把辅助方法名直接传给 Funplay 的 `execute_scene_script` |

`execute_javascript` 的参数为 `context`、`code` 和可选的 `args` 对象。`code` 可以直接 `return` 一个结果，或定义 `run(env)`。编辑器上下文提供 `Editor`、`args`、`context`、`helpers`、`fs`、`path`、`os`、`require` 和 `console`。

只读查询当前节点树的调用参数：

```json
{
  "context": "editor",
  "code": "return await Editor.Message.request('scene', 'query-node-tree');"
}
```

按已查询的 UUID 读取节点属性：

```json
{
  "context": "editor",
  "args": { "uuid": "<查询返回的节点UUID>" },
  "code": "return await Editor.Message.request('scene', 'query-node', args.uuid);"
}
```

修改属性时，从查询结果保留对应 dump 的类型等信息，只更新需要改变的值；示例中的 `dump` 必须替换为该节点属性的实际 dump：

```json
{
  "context": "editor",
  "args": {
    "uuid": "<查询返回的节点UUID>",
    "property": "position",
    "dump": { "value": { "x": 10, "y": 20, "z": 0 } }
  },
  "code": "return await Editor.Message.request('scene', 'set-property', { uuid: args.uuid, path: args.property, dump: args.dump, record: true });"
}
```

完成后重新查询节点，再按当前场景上下文调用 `scene/save-scene` 或可用的 `save_current_scene`。Prefab 编辑上下文需确认实际保存对象与实例关联，不能盲目保存到其他场景。

不要直接拼接用户输入到 JavaScript 源码，数据通过 `args` 传入。批量步骤返回每个目标的实际结果，失败时报告已完成部分；不要盲目重试创建或删除操作。

## 常用任务与实际工具

工具参数以运行时 schema 为准。以下名称来自当前服务注册表；后续更新工具时同步维护本表。

| 任务 | 工具或执行路径 |
| --- | --- |
| 场景查询与打开 | `list_scenes`、`open_scene`、`get_scene_info` |
| 节点和组件 | `get_hierarchy`；`full` 中的 `create_node`、`set_node_transform`、`add_component`、`set_component_property`，或 Editor 消息 |
| Prefab | `inspect_prefab`、`inspect_prefab_instance`、`validate_prefab_references`；`full` 中的 `create_prefab_instance`、`apply_prefab_instance`、`revert_prefab_instance` |
| 资源 | `list_assets`、`inspect_asset`、`inspect_asset_dependencies`、`validate_asset_dependencies`；写入通过 AssetDB 消息或已暴露工具 |
| 脚本 | AssetDB 创建或导入；`run_script_diagnostics`、`get_script_diagnostic_context` 检查编译诊断 |
| 动画与事件 | `full` 中的 `list_animations`、`play_animation`、`bind_button_click_event`；复杂编辑使用对应版本的 Editor 消息，或已安装的桥接辅助方法 |
| 预览与截图 | `get_preview_mode`、`get_runtime_state`、`capture_preview_screenshot`、`capture_scene_screenshot`；`full` 中的 `run_project_preview` |
| 构建 | `get_build_status`；`full` 中的 `open_build_panel`。当前没有通用“一键构建”工具，不把打开构建面板描述为构建完成 |
| 验证 | `validate_scene`、引用验证、脚本诊断及 `get_recent_logs`，按任务组合 |

`context: "scene"` 的脚本针对编辑器当前场景上下文。真实游戏预览的截图与状态使用预览工具；不能通过编辑场景里的 `director` 结果证明 Web 预览已生效。

## 可选桥接辅助方法

只有细粒度 dump/动画管理、内部 Prefab 预览或原运行时中继等能力确实需要时，才加载 [认证桥接安装与调用](creator-bridge/README.md)。桥接有独立的连接文件和令牌，不能将它的端口当作 MCP URL。

已安装桥接时，可从 MCP 的编辑器上下文调用其场景辅助方法：

```json
{
  "context": "editor",
  "args": { "maxDepth": 6 },
  "code": "return await Editor.Message.request('scene', 'execute-scene-script', { name: 'cocos3-codex-bridge', method: 'inspectTree', args: [args] });"
}
```

完整辅助方法见 [桥接 API](creator-bridge/api.md)。`preview`、`runtime-stats` 和 `runtime-screenshot` 属于桥接服务接口，沿用相应 CLI 与 `temp/` 输出约束。
