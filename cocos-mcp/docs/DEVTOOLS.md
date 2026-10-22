# Chrome 预览排障与性能分析

`cocos-mcp` 的 `cocos_devtools` 工具连接开发人员正在使用的 Chrome 游戏预览，转发 Google 官方 `chrome-devtools-mcp` 的控制台、网络、性能录制与堆分析能力。业务数据查询继续使用 `execute_javascript` 的 `context: "runtime"`，不在技能中复制底层接口。

## 安装与授权

在本仓库根目录执行：

```powershell
node scripts/install-codex.js --devtools
```

可选运行时固定为 `chrome-devtools-mcp@1.11.0`，安装至用户 Codex 目录下 `cocos-mcp/devtools/1.11.0/`，不添加到 Creator 工程依赖。要求 npm，以及 Node 20.19.x、22.12+ 或 23+。基础 MCP 的 Node 18 支持不受影响。安装器不会下载或启动 Chrome。

自动连接要求 Chrome 144+。在原 Chrome 中打开 `chrome://inspect/#remote-debugging`，启用远程调试并允许传入连接。该授权由 Chrome 要求；工具不能代替用户确认。无需重启 Creator 或替换预览模板。重连 MCP 或重启 Codex 后，当前会话可加载新增工具。

子服务始终使用 `--autoConnect`，关闭使用统计、CrUX 查询与更新检查。没有可连接 Chrome 时返回错误，不启动另一浏览器或游戏预览。自动连接方式及限制见 [官方连接说明](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/advanced-usage.md#automatically-connecting-to-a-running-chrome-instance)。

## 选择工程与页面

1. 调用 `connect_cocos_project` 指定工程，确认桥接及普通 Web 预览可用。
2. 调用 `cocos_devtools`，参数 `{"action":"list_tools"}`，读取当前转发工具的实际 `inputSchema`。
3. 调用 `{"action":"list_pages"}` 获取当前工程预览的 `pageId`、`instanceId`、URL 和标题。
4. 每次 `call` 都传这个 `pageId`，包括离线堆分析。服务重新核对预览端口、页面 URL 和桥接中的实际实例 ID，拒绝其他工程或已切换页面。多实例时明确选择。

`status` 报告安装情况、子服务是否启动、最近核验页面及时间，不将进程启动当作浏览器已连接。页面列表只返回工程匹配的预览，不暴露新建页面、导航或扩展安装等无关操作。工具名和参数来自固定版本官方服务，不猜测接口。

## 控制台与网络

以下 `pageId` 是示例，应使用实际返回值：

```json
{
  "action": "call",
  "pageId": 2,
  "toolName": "list_console_messages",
  "toolArgs": { "pageSize": 50 }
}
```

通过 `get_console_message` 查看具体日志和堆栈；`list_network_requests`、`get_network_request` 查看请求、状态、耗时、头及响应。先列出实际 ID，再读取详情。历史依赖当前 DevTools 子会话，不保证包含连接前的全部记录；先连接，再复现原操作，不擅自刷新或清除状态。

## 性能录制与内存

```json
{
  "action": "call",
  "pageId": 2,
  "toolName": "performance_start_trace",
  "toolArgs": { "reload": false, "autoStop": false }
}
```

复现指定操作后，在同一 MCP 会话用同一 `pageId` 调用 `performance_stop_trace`。包装层默认 `reload: false`、`autoStop: false`，保留游戏状态；显式需要页面加载分析时才使用刷新录制。一个会话维护一个录制，只停止本会话发起的录制。

原始 `.json.gz` 文件保存到工程 `temp/cocos-skill/devtools/`，返回实际路径与官方分析。文件可导入 Chrome Performance 面板；`performance_analyze_insight` 的 ID 来自这次实际结果。录制提供时间线和 JavaScript 采样，编辑器节点数、网页加载指标或单次空闲采样不能直接证明游戏 FPS/GPU 性能。

`take_heapsnapshot` 保存 `.heapsnapshot`。之后按实际工具目录使用摘要、支配树、引用链或差分快照分析。堆快照会影响游戏运行，按明确的内存排查任务采集，先固定同一场景和复现步骤。连接通畅不等于已验证内存泄漏。

## 文件、会话与失败

采样、请求体输出及堆分析输入限制在当前工程 `temp/cocos-skill/devtools/`，可传该目录内的相对或绝对路径。子服务以目标工程为工作目录，并通过 MCP `roots/list` 声明工程根目录。需确认文件实际写入，不能以开始采样代替完成。

`disconnect`、切换工程或正常结束 stdio 会尝试停止本会话录制并释放子服务，保留 Chrome。停止失败会返回警告；强制终止进程无法保证采样保存。超时和断线不自动重放操作，先核对现场再继续。

官方运行时为 Apache-2.0，来源见 [来源记录](../../UPSTREAM.md)，完整参数见 [官方工具文档](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)。
