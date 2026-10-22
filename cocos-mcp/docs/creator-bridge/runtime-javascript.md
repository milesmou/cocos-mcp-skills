# 查询运行中游戏的数据

`execute_javascript` 的 `context: "runtime"` 在开发人员正在使用的普通 Web 预览中执行 JavaScript。`scene` 上下文仍是编辑器的场景进程；读取真实游戏业务状态时使用 `runtime`。

## 安装与连接

`connect_cocos_project` 默认一起安装缺失的 `cocos-mcp-bridge` 和工程 `preview-template/`。插件首次安装后，提示用户保存并重启 Creator，再打开或刷新原有 Web 预览。仅更新模板时刷新预览即可。不要为查询另开第二个预览实例。

模板来源是用户提供的 MyCookingGirl Creator 3.8.8 模板，保留其节点树面板，增加 `runtime-agent.js`。安装器保留工程自己的 `index.ejs`，仅补充脚本标签；已识别的旧版或本工具管理的脚本可以升级，替换前备份至工程 `temp/cocos-mcp-install/<安装ID>/preview-template/`。遇到其他本地脚本修改会停止并报告冲突。引擎安装目录和发布构建模板不会改动。

旧两插件通过 `migrateLegacy: true` 显式迁移到统一插件并重启；连接工具不自动覆盖已有扩展。`get_cocos_connection.runtimeInspector.javascript` 表示桥接支持执行，`connectedInstances` 和 `instanceIds` 表示当前预览连接；这不表示游戏场景已加载，执行时还会检查 `System.import('cc')` 和 `director.getScene()`。

## MCP 调用

调用 `execute_javascript`，以 `args` 传入数据，不把用户输入拼接成代码：

```json
{
  "context": "runtime",
  "code": "return { scene: scene.name, roots: scene.children.map(n => ({ uuid: n.uuid, name: n.name, active: n.activeInHierarchy })) };"
}
```

查询已经确认路径及组件类名的业务对象：

```json
{
  "context": "runtime",
  "args": { "path": "Canvas/Player", "component": "PlayerController" },
  "code": "const node = cc.find(args.path, scene); if (!node) throw new Error('Player node missing'); const player = node.getComponent(args.component); if (!player) throw new Error('Player component missing'); return { score: player.score, state: player.state };",
  "timeoutMs": 5000
}
```

节点路径、组件名及字段仅为示例，必须先查询目标工程的实际值。也支持 `await`、`async function run(env)`、`module.exports = async function(env)`。页面执行环境提供 `cc`、`scene`、`args` 和 `env = { cc, scene, args, window }`。通过 `cc` 或页面 `System.import` 访问已加载的业务模块，不依赖全局 `cc`。

多个预览连接时必须传入从连接状态取得的 `instanceId`；不会广播执行。返回 `instanceId`、`context`、`page`、`scene`、`capturedAt`、`durationMs`、`result` 和 `serialization`。节点及组件返回摘要，BigInt 转为字符串；循环、过深或过大数据会标记截断，查询时优先返回需要的少量字段。

兼容 CLI 可使用相同协议；以下代码执行的是当前预览而非 Scene Script：

```powershell
node "<MCP目录>/compat/creator-bridge/scripts/cocos-editor.mjs" --project "<工程目录>" request bridge execute-runtime-javascript '[{"code":"return { name: scene.name, rootCount: scene.children.length };"}]'
```

## 执行边界

命令只从带工程令牌的认证 `/request` 进入，经本机 SSE 发往所选预览。预览中继不提供未认证的执行 HTTP 接口。代码拥有当前页面的能力，可修改游戏数据；它不是只读解释器或隔离沙箱。Agent 根据用户任务选择代码，查询任务只读取数据。

`timeoutMs` 为 100–30000 毫秒的响应期限，不会中断页面 JavaScript。禁止发送死循环；超时或断线后执行可能仍在继续，先核对现场，不自动重放。异步错误、未运行游戏、实例歧义、认证失败均报告为失败，不返回伪造数据。仅适用于加载此模板的 Web 预览，不覆盖原生模拟器或设备包。
