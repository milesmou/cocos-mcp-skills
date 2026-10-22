# cocos-mcp

`cocos-mcp` 的默认 MCP 服务 **fork 自 [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp)**，原作者为 Funplay，保留原 [MIT 许可证](LICENSE)。服务面向 Cocos Creator 编辑器，保留 HTTP MCP、stdio 代理、工具 profile、资源与提示、场景执行、预览截图、脚本诊断等功能。配合 [cocos-skill](../cocos-skill/README.md) 使用。

本目录是本地源码整合版，基于上游 `0.6.8`。目录名为 `cocos-mcp/`，运行时扩展名称、菜单和代理文件名仍保留 `funplay-cocos-mcp` / `Funplay`，以兼容现有消息与客户端配置；不是另一个已发布的 npm 包。

## 环境

- Cocos Creator 3.8.x 编辑器，用于本仓库工作流；其他版本需单独验证。
- Node.js 18+，用于检查、测试和可选 stdio 代理。
- 服务没有第三方 npm 运行依赖，无需先执行 `npm install`，也无需编译即可作为扩展加载。

## 安装到目标工程

首次安装时，将本目录完整复制到目标工程的 `extensions/funplay-cocos-mcp/`。在仓库根目录可执行以下 PowerShell 命令，先替换工程路径：

```powershell
$cocosProject = "D:/path/to/your-cocos-project"
$extensionTarget = Join-Path $cocosProject "extensions/funplay-cocos-mcp"
if (Test-Path -LiteralPath $extensionTarget) {
    throw "目标已存在，请先确认已有扩展及本地修改，再执行更新。"
}
New-Item -ItemType Directory -Path (Join-Path $cocosProject "extensions") -Force | Out-Null
Copy-Item -LiteralPath "./cocos-mcp" -Destination $extensionTarget -Recurse
```

复用已经打开的目标工程，在 Creator 扩展管理器中启用扩展并重新加载编辑器。随后打开 `Funplay > MCP Server`，使用面板显示的实际 URL 连接客户端。新工程采用独立端口，不将 `8765` 当作固定端口；一个工程只运行一个 Creator 实例。

本整合版由源码更新。面板直接安装上游更新和下载上游包进行全局安装已禁用，防止替换本仓库的修改；手动查看上游版本不受影响。更新时按根目录 [UPSTREAM.md](../UPSTREAM.md) 合并源码后再部署到目标工程。

## MCP 连接

优先使用服务面板提供的对应客户端配置。支持 HTTP 的客户端直接使用实际 URL；仅支持 stdio 的客户端运行本地代理：

```powershell
node "<MCP目录>/bin/funplay-cocos-mcp.js" --url "<面板显示的MCP URL>"
```

该进程只代理已经运行的编辑器服务，不会独立启动 Creator。使用本地路径可确保客户端运行当前整合版；不要用上游 `npx` 包名代替。

`execute_javascript` 是主要执行工具，接收 `context: "editor"` 或 `"scene"`、`code` 和可选 `args`。执行上下文、Editor 消息与原桥接 CLI 的对应方式见 [编辑器执行说明](docs/EDITOR_WORKFLOW.md)。

默认 `core` 暴露 39 个工具，`full` 提供 106 个工具；以实际配置为准。完整工具说明由源码生成，见 [docs/TOOLS.md](docs/TOOLS.md)。构建相关能力提供面板打开和状态查询，实际构建需结合目标 Creator 工程配置完成并检查结果。

## 可选 Creator 3.8 认证桥接

`compat/creator-bridge/` 保留 `cocos3-skill` 的白名单消息桥接、场景辅助方法、内部 Prefab PNG 预览和普通 Web 预览中继。默认 MCP 不依赖它；仅在任务需要这些能力时安装。

```powershell
node "<MCP目录>/compat/creator-bridge/scripts/install-bridge.mjs" --project "<工程目录>"
node "<MCP目录>/compat/creator-bridge/scripts/cocos-editor.mjs" --project "<工程目录>" status
```

安装后先在 Creator 启用 `cocos3-codex-bridge` 并重新加载，再调用 `status`。服务只监听 `127.0.0.1`，认证信息在目标工程 `temp/cocos3-codex-bridge.json`；这是独立桥接协议，不是 MCP URL。内部 Prefab PNG 仅支持 Creator 3.8.5–3.8.x，输出必须位于工程 `temp/`。

完整操作、运行时模板安装和辅助 API 见 [桥接安装与使用](docs/creator-bridge/README.md) 与 [桥接 API](docs/creator-bridge/api.md)。这些底层能力文档统一由服务维护。

## 检查

在仓库根目录执行：

```powershell
npm --prefix cocos-mcp run check
npm --prefix cocos-mcp run check:compat
npm --prefix cocos-mcp test
npm --prefix cocos-mcp run docs:check
npm --prefix cocos-mcp run pack:dry-run
```

`test/` 包含默认服务测试，`compat/creator-bridge/test/` 包含迁移后的桥接测试。它们可在没有 Creator 的环境中验证协议和文件操作；编辑器实际加载、场景编辑和预览仍需在目标工程中验收。

来源与许可见 [NOTICE.md](NOTICE.md)。保留的上游发布脚本和注册清单记录上游产品流程，不用于发布本整合版。
