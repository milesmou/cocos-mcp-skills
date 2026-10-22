# cocos-mcp

`cocos-mcp` 的默认 MCP 服务 **fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)**，原作者为 Funplay，保留原 [MIT 许可证](LICENSE)。服务面向 Cocos Creator 编辑器，保留 HTTP MCP、stdio 代理、工具 profile、资源与提示、场景执行、预览截图、脚本诊断等功能。配合 [cocos-skill](../cocos-skill/README.md) 使用。

本目录是本地源码整合版，基于上游 `0.6.8`。目录名为 `cocos-mcp/`，Codex 服务名为 `cocos-mcp`，工程内唯一插件名为 `cocos-mcp-bridge`，菜单为 `Cocos MCP`。旧 HTTP 代理文件保留供兼容，不是另一个已发布的 npm 包。

## 环境

- Cocos Creator 3.8.x 编辑器，用于本仓库工作流；其他版本需单独验证。
- Node.js 18+，用于检查、测试和可选 stdio 代理。
- 服务没有第三方 npm 运行依赖，无需先执行 `npm install`，也无需编译即可作为扩展加载。

## 安装到 Codex

在仓库根目录执行一次，注册本地 MCP 入口并链接统一技能：

```powershell
node scripts/install-codex.js
```

新入口为 `bin/cocos-mcp.js`，在 Creator 未运行或工程缺少插件时也能初始化。Codex 配置引用本地源码，技能链接位于 `~/.agents/skills/cocos-skill`；保留源码目录。当前会话未加载工具时，重新连接 MCP 或重启 Codex。

使用时调用 `connect_cocos_project` 并传入目标工程绝对路径。工程缺少 `cocos-mcp-bridge` 桥接时自动安装所需运行文件，然后返回 `restart_required`，提示用户保存工作并完全重启该工程的 Creator。用户重启后再次连接，确认 `connected: true` 后再执行编辑。已有插件不自动覆盖；不会自动关闭或重启编辑器。

无需逐工程配置 URL；入口通过连接文件或工程回环端口发现编辑器，并校验工程身份。完整安装命令、状态、迁移与桥接辅助能力见 [Codex 安装说明](docs/CODEX_SETUP.md)。

本整合版由源码更新。面板直接安装上游更新和下载上游包进行全局安装已禁用，防止替换本仓库的修改；手动查看上游版本不受影响。更新时按根目录 [UPSTREAM.md](../UPSTREAM.md) 合并源码后再部署到目标工程。

## MCP 连接

Codex 默认连接本地入口，其启动命令为 `node "<MCP目录>/bin/cocos-mcp.js"`。原工程 HTTP 服务和旧代理仍可供已有客户端兼容使用：

```powershell
node "<MCP目录>/bin/funplay-cocos-mcp.js" --url "<面板显示的MCP URL>"
```

上面的旧代理依赖已经运行的工程服务，不具备按需安装能力；新 Codex 入口会在工具调用时检查并安装桥接。两者都不会自动启动 Creator。

`execute_javascript` 是主要执行工具，接收 `context: "editor"`、`"scene"` 或 `"runtime"`、`code` 和可选 `args`。执行上下文、Editor 消息与原桥接 CLI 的对应方式见 [编辑器执行说明](docs/EDITOR_WORKFLOW.md)。

Codex 入口另外提供 `connect_cocos_project`、`get_cocos_connection` 和 `cocos_devtools`。上游编辑器工具的 `core` 为 39 个，`full` 为 105 个，以实际配置为准。完整工具说明由源码生成，见 [docs/TOOLS.md](docs/TOOLS.md)。构建相关能力提供面板打开和状态查询，实际构建需结合目标 Creator 工程配置完成并检查结果。

## 统一 Creator 3.8 桥接

原 `funplay-cocos-mcp` 与 `cocos3-codex-bridge` 的功能合并在唯一工程插件 `cocos-mcp-bridge`。MCP、白名单消息、场景辅助方法、内部 Prefab PNG 和 Web 运行时中继统一加载。认证服务实现位于 `lib/creator-bridge/`，内部渲染面板位于 `panel/prefab-preview.js`；`compat/creator-bridge/` 只维护 CLI 和测试。

首次连接安装插件和预览模板。迁移旧工程时传入 `migrateLegacy: true`，旧插件完整备份到工程 `temp/cocos-mcp-install/` 后移出扩展目录，再提示保存并重启 Creator。已有同名插件不自动覆盖，显式升级可使用以下安装器的 `--force`（也会备份）：

```powershell
node "<MCP目录>/compat/creator-bridge/scripts/install-bridge.mjs" --project "<工程目录>" --migrate-legacy
node "<MCP目录>/compat/creator-bridge/scripts/cocos-editor.mjs" --project "<工程目录>" status
```

MCP 地址记录于 `temp/cocos-mcp-connection.json`；辅助认证信息记录于 `temp/cocos-mcp-bridge.json`，只监听 `127.0.0.1`，后者不是 MCP URL。内部 Prefab PNG 支持 Creator 3.8.5–3.8.x，输出必须位于工程 `temp/`。`includeCompatibilityBridge` 仅保留旧参数兼容，不再拆开安装。

完整操作、运行时模板安装和辅助 API 见 [桥接安装与使用](docs/creator-bridge/README.md) 与 [桥接 API](docs/creator-bridge/api.md)。这些底层能力文档统一由服务维护。

普通 Web 预览支持 `execute_javascript` 的 `context: "runtime"`，执行一次脚本并返回真实游戏数据与页面、场景来源。安装、参数与边界见 [运行时数据查询](docs/creator-bridge/runtime-javascript.md)。

## 检查

在仓库根目录执行：

```powershell
npm --prefix cocos-mcp run check
npm --prefix cocos-mcp run check:codex
npm --prefix cocos-mcp run check:compat
npm --prefix cocos-mcp test
npm --prefix cocos-mcp run docs:check
npm --prefix cocos-mcp run pack:dry-run
```

`test/` 包含默认服务测试，`compat/creator-bridge/test/` 包含迁移后的桥接测试。它们可在没有 Creator 的环境中验证协议和文件操作；编辑器实际加载、场景编辑和预览仍需在目标工程中验收。

来源与许可见 [NOTICE.md](NOTICE.md)。保留的上游发布脚本和注册清单记录上游产品流程，不用于发布本整合版。

Chrome 游戏预览的控制台、网络、性能录制及堆分析通过 `cocos_devtools` 接入。可选安装命令为 `node scripts/install-codex.js --devtools`，见 [DevTools 使用说明](docs/DEVTOOLS.md)。

原编辑器内置的 Workflow 和 UI Composition 技能已合并进 [cocos-skill](../cocos-skill/SKILL.md)。编辑器不再提供 Project Skills 面板或内置技能安装、更新、差异和备份功能，统一由仓库安装器提供技能入口。
