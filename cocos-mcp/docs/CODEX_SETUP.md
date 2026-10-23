# 安装到 Codex，使用时连接工程

默认结构为：

```text
Codex
  └── 本地 MCP：bin/cocos-mcp.js
        ├── 连接与安装工具（Creator 未运行也可用）
        └── 工程内 cocos-mcp-bridge → Creator 编辑器 API
              ├── 认证辅助方法与内部 Prefab 渲染
              └── 运行时中继 → preview-template → 运行中游戏
```

Codex 侧负责启动、工程选择、安装检查和连接状态，工程侧执行实际引擎操作。无需事先手动复制插件或逐工程配置 MCP 地址。

## 安装一次

环境要求：本机 Codex CLI、Node.js 18+；在线工程使用 Creator 3.8.x。在仓库根目录执行：

```powershell
node scripts/install-codex.js --dry-run
node scripts/install-codex.js
```

安装器用 `codex mcp add cocos-mcp -- <Node绝对路径> <源码中的cocos-mcp.js绝对路径>` 注册服务，并将 `cocos-skill/` 链接到用户级 `~/.agents/skills/cocos-skill`。Windows 使用目录联接，不需要文件符号链接权限。重复执行会复用同一项；同名服务指向其他入口、处于禁用状态，或同名技能属于其他内容时停止，不覆盖。

旧安装名为 `cocos` 时，安装器先注册 `cocos-mcp`，成功后移除指向本仓库同一入口且没有自定义运行配置的旧条目。其他来源、禁用或有自定义环境、工作目录、超时设置的 `cocos` 条目保留。

这是基于本地源码的安装，保留仓库所在目录。若移动仓库，需要显式调整 Codex 中的 MCP 命令和技能链接。当前会话未显示新工具时，重新连接 MCP 或重启 Codex。

Codex 的 stdio 配置与用户级技能目录采用 [官方 MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) 和 [官方技能文档](https://learn.chatgpt.com/docs/build-skills) 描述的方式。也可手动注册同一入口：

```powershell
codex mcp add cocos-mcp -- node "<MCP目录>/bin/cocos-mcp.js"
```

## 首次使用工程

调用 `connect_cocos_project`，参数为：

```json
{
  "projectPath": "D:/Games/MyGame"
}
```

工具先确认工程版本和 `assets/`，仅检查 `extensions/cocos-mcp-bridge/`，并安装工程 `preview-template/`。缺少插件时从本地来源复制运行文件，返回 `status: "restart_required"` 和 `restartRequired: true`。不覆盖已有扩展。模板保留定制 EJS，升级受管理脚本前备份，冲突时停止；结果中的 `previewTemplate` 记录修改和备份位置。

此时应提示用户：**工程桥接已安装，请保存工作，完全退出并重新打开该工程的 Cocos Creator。** 若扩展尚未启用，用户需在扩展管理器启用。工具不会强制关闭、重启或另开编辑器，安装完成也不表示编辑器连接完成。

用户重启后再次调用连接工具。桥接随编辑器启动，连接文件写入 `temp/cocos-mcp-connection.json`，其中记录实际 URL、工程身份和进程所有者；服务会验证监听器属于目标工程。已安装插件不再复制，确认后返回 `status: "ready"`、`connected: true`。

## 状态与工具

| 工具或状态 | 行为 |
| --- | --- |
| `connect_cocos_project` | 选择绝对路径工程，检查并安装缺失插件，连接已有编辑器 |
| `get_cocos_connection` | 检查当前工程连接，不安装新插件 |
| `disconnected` | 尚未选择工程，其他编辑器工具返回连接提示 |
| `restart_required` | 插件已安装，等待用户重启后重新连接 |
| `editor_unavailable` | 插件存在但未能连接，需打开正确工程或检查启用状态 |
| `ready` | 已验证目标工程身份，可调用编辑器工具 |

Codex 默认开放全部 108 个工具：2 个连接工具、1 个 `cocos_devtools` 入口和全部 105 个编辑器工具。工具列表在 Creator 启动前后保持稳定；执行编辑操作仍需先连接正确工程。旧 `--profile core|full` 参数仅兼容解析，不再限制开放范围。

切换工程时重新调用 `connect_cocos_project`，失败时会清除旧工程的写入连接。连接中断不会自动重放写入，因为编辑器可能已经执行了该操作；重新连接后先核对现场。

## 运行时与辅助桥接

唯一插件包含 MCP、内部 Prefab PNG、场景辅助方法和普通 Web 预览中继。两个传输均可连接、工程身份正确后才返回就绪；`runtimeInspector` 返回预览实例与 JavaScript 能力。打开或刷新原普通 Web 预览后使用 `execute_javascript` 的 `context: "runtime"`。见 [运行时数据查询](creator-bridge/runtime-javascript.md) 和 [辅助方法](creator-bridge/README.md)。旧参数 `includeCompatibilityBridge` 仍接受，但不再拆开安装。

## 迁移旧插件

检测到 `funplay-cocos-mcp` 或 `cocos3-codex-bridge` 时，连接工具先报告迁移要求；显式请求：

```json
{ "projectPath": "D:/Games/MyGame", "migrateLegacy": true }
```

完整旧插件移入工程 `temp/cocos-mcp-install/bridge-<ID>/extensions/`，保留本地修改，再安装单一插件；返回 `migration.backupDirectory` 和 `restart_required`。保存并完全重启 Creator 后再次连接。现有 `cocos-mcp-bridge` 不自动覆盖；手动升级使用安装器 `--force`，同样先备份。

原 `bin/funplay-cocos-mcp.js --url ...` HTTP 代理继续保留。工程桥接使用固定默认值：自动启动、本机回环监听、按工程路径派生端口、全部工具开放。旧 `funplay-cocos-mcp.config.json`、`cocos-mcp-bridge.config.json` 与 `COCOS_MCP_*` 环境覆盖不再读取，原文件保留；工程身份算法和派生端口保持不变。认证描述文件改为 `temp/cocos-mcp-bridge.json`，旧文件不会被作为新桥接就绪证据。

## Chrome DevTools

需要控制台、网络、性能录制及堆分析时，执行 `node scripts/install-codex.js --devtools`，并在 Chrome 中授权连接。入口仍为 `cocos-mcp`，通过 `cocos_devtools` 使用可选运行时，详见 [Chrome DevTools](DEVTOOLS.md)。

Creator 不再注册 MCP 服务、工具开放范围或 MCP 设置菜单，也不提供配置面板。内部 Prefab 渲染面板由工具按需打开。默认保持 JavaScript 安全检查，不因工具全部开放而跳过工程身份与参数校验。修改 Codex 入口后重新连接 MCP 以加载完整工具列表；更新工程扩展后保存并完全重启 Creator。
