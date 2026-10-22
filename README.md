# cocos-mcp-skills

面向 Cocos Creator 引擎工作流的 MCP 工具与技能集合，围绕工程检查、场景与 Prefab 编辑、资源管理、脚本开发、UI 调整、预览与构建组织能力。

| 模块 | 用途 |
| --- | --- |
| [Cocos MCP](cocos-mcp/README.md) | 安装到 Codex 的本地 MCP 入口，按需安装工程桥接并连接 Creator，提供场景编辑、资源、预览截图与诊断等工具 |
| [Cocos Skill](cocos-skill/README.md) | 统一技能入口，负责 UI 蓝图、资源映射、拼装、美术替换、业务设计与任务验收；仅保留离线结构和图像辅助检查 |

目标工作流是先确认工程路径、引擎版本和编辑器连接，读取当前场景与资源状态，再通过技能配合 MCP 工具完成编辑、保存及相应验证，最后交付修改结果与验证记录。资源操作需要保留 UUID、`.meta` 文件和引用关系，具体 API 与操作方式以目标工程的 Creator 版本为准。

`cocos-mcp` 的默认服务 fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)，技能与桥接辅助能力整合自 [milesmou/cocos3-skill](https://github.com/milesmou/cocos3-skill)。来源提交与许可边界见 [UPSTREAM.md](UPSTREAM.md)。

## 开始使用

在仓库根目录执行一次安装：

```powershell
node scripts/install-codex.js
```

安装器以 `cocos-mcp` 名称注册 Codex MCP 入口，并链接唯一的 `cocos-skill` 技能。源码目录作为本地安装来源保留；若当前会话尚未显示新工具，重新连接 MCP 或重启 Codex。

使用时指定目标工程，例如：“用 cocos-skill 调整 D:/Games/MyGame 的登录页。”AI 先调用 `connect_cocos_project`：

1. 自动安装唯一工程插件 `cocos-mcp-bridge` 与预览模板；新装插件后提示用户保存并重启 Creator。
2. 用户重启后：再次连接，确认 `connected: true`。
3. 工程已有桥接：复用现有插件与连接，继续编辑、保存与验证。

Codex 侧入口在编辑器未运行时也能启动。Creator 工程仍需要执行引擎操作的桥接插件，首次使用时按需安装，无需提前手动复制或逐工程配置 MCP URL。运行中游戏数据使用 `execute_javascript` 的 `context: "runtime"` 查询，需打开或刷新普通 Web 预览。详细状态、辅助桥接和旧版兼容方式见 [Codex 安装说明](cocos-mcp/docs/CODEX_SETUP.md)。

场景、节点、组件、资源、脚本创建、动画、预览和截图等底层操作统一由 MCP 提供；技能只保留组合工作流，不重复维护逐项操作模块、桥接手册或资源增删改脚本。工具说明见 [MCP 工具手册](cocos-mcp/docs/TOOLS.md)，桥接说明见 [服务文档](cocos-mcp/docs/creator-bridge/README.md)。

当前工作流面向 Cocos Creator 3.8.x，Node.js 要求 18+。内部 Prefab PNG 渲染限 3.8.5–3.8.x；UI 图片图册和严格对比另外需要 Python 3.10+ 与 Pillow。具体工具是否可用以服务 schema、目标编辑器版本和当前 profile 为准。

## 本地检查

在仓库根目录执行；基础服务和离线脚本无第三方 npm 运行依赖，Chrome DevTools 使用另行安装的可选官方运行时：

```powershell
npm --prefix cocos-mcp run check
npm --prefix cocos-mcp run check:codex
npm --prefix cocos-mcp run check:compat
npm --prefix cocos-mcp test
npm --prefix cocos-mcp run docs:check
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
```

这些检查不代替真实 Creator 工程中的编辑、预览和构建验收。模块环境要求、安装方式和详细用法分别见各目录的 README。

开发与 Agent 协作规则见 [AGENTS.md](AGENTS.md)。

Chrome 预览排障与性能分析可执行 `node scripts/install-codex.js --devtools` 安装可选官方运行时，再通过同一 `cocos-mcp` 中的 `cocos_devtools` 使用，见 [DevTools 说明](cocos-mcp/docs/DEVTOOLS.md)。
