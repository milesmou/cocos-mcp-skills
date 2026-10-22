# Project isolation, Skills, and workflows

## 多项目与迁移

- 新项目按项目路径生成稳定端口，并使用 `cocos-<project>-<hash>` 配置名称。同名目录位于不同路径时也使用不同名称；端口哈希仍可能冲突，面板会明确显示回退状态。
- 已有 `funplay-cocos-mcp.config.json` 保留固定端口。点击“使用项目独立端口”可以主动切换；“固定当前端口”可保存当前实际端口。切换后需重新配置客户端。
- 临时回退端口不会被一键配置写入客户端。先解决冲突或固定端口，避免重启后指向错误项目。
- 一键配置保留其他 MCP 配置。只有当前编辑器正在运行、旧 `funplay_cocos` 条目准确指向当前端口且仍是工具生成的简单格式时，才会迁移旧条目；其他旧条目保留供人工检查。手动改过地址的项目条目不会被静默覆盖。
- Claude Code 使用 `~/.claude.json` 的 `projects[Git 仓库根目录].mcpServers`，不是所有项目共享的顶层条目。没有 Git 仓库时使用 Cocos 项目目录。这里的 Claude Code 配置不是 Claude Desktop 配置。
- CodeBuddy 使用 IDE 4.0 起支持的 `<Cocos 项目>/.mcp.json`，不写 CLI 或旧编辑器插件的全局配置。请在 CodeBuddy 中打开该 Cocos 项目目录，并按客户端提示启用或批准服务器；不会自动放宽 MCP 审批设置。

## Unified Cocos skill

The two built-in Funplay skill templates have been merged into [cocos-skill](../../cocos-skill/SKILL.md). Install the unified skill through the repository Codex installer. The editor no longer has a Project Skills panel, managed-template installation/update/backup actions, or Configure + Skills setup. Existing user-authored skills and instruction files are retained. The generic create_project_skill tool remains available only for explicitly authored custom project guidance.

Recent Activity still preserves nested result cards and separate script execution logs. Settings, tool exposure and client connection configuration continue to work independently of skills.

## Asset Database readiness

Enable the Full profile (or explicitly expose `check_asset_ready` in a custom profile). Example tool arguments:

```json
{"target":"db://assets/ui/Main.prefab","waitMs":1500,"pollIntervalMs":100}
```

This read-only check uses native `query-ready`, asset-info, UUID, and URL queries. An exact target needs imported metadata, matching UUID/URL round trips, and two consecutive stable observations. Omitting `target` checks only database query readiness. `waitMs` is bounded to 0–10,000 ms; zero requests one bounded observation and cannot establish stable readiness. Busy, missing, importing, identity mismatch, timeout, unavailable, and unknown results are not success. No refresh or mutation is retried by this tool.

`ready: true` is **not** proof that the importer queue is empty, source bytes are current, TypeScript compiled, or the runtime loaded the new asset. Check script diagnostics, exact persisted bindings, preview errors and runtime behavior separately. Refresh only the changed source when needed.

## Screenshot-calibrated mouse input

1. Capture the target with an editor/scene/game/preview screenshot tool; inspect the returned native image and `data.geometry`.
2. Use its `captureId` with `coordinateSpace: "image-pixels"`. Coordinates are measured in the **exact returned PNG**, from its top-left corner, not a resized chat preview or a reference design image.
3. Read back the resulting state or capture another screenshot to verify the requested action.

Example click arguments (replace the ID and coordinates with the actual capture):

```json
{"coordinateSpace":"image-pixels","captureId":"capture_from_the_response","x":420,"y":260}
```

Supported by `simulate_mouse_click`, `simulate_mouse_drag`, and mouse actions of `simulate_preview_input`. Drag uses `startX/startY/endX/endY` in the same PNG. `windowId` can select an exact Electron window for capture and legacy input; a missing explicit target never falls back to a different window. Calibrated input targets the receipt's original window/project and does not require repeating its window/panel selectors.

Metadata includes actual encoded image dimensions, viewport DPR/zoom, crop origin, and per-axis pixel-to-window scale. Receipts expire after 60 seconds, are bounded to 32 entries, and disappear when the extension reloads. Both endpoints are validated; hidden/destroyed windows, viewport/zoom/crop changes, renderer/canvas replacement, and observed editor scene changes require recapture. Scene identity and observable geometry are checked, not every runtime business-state change: `runtimeContentVerified` remains false, and cross-origin frame reloads may not be observable.

Successful input reports `events_submitted` with `businessOutcomeVerified: false`. Failure reports `INPUT_NOT_SENT` or `INPUT_OUTCOME_UNKNOWN`; after a partial dispatch, the extension attempts a mouse-button release but never replays the action. Inspect state before retrying an uncertain outcome. Synthetic events are not proof of Button hit testing, absence of occlusion, or gameplay success. Desktop screenshots cannot calibrate Electron input. Omitting `coordinateSpace` preserves legacy window coordinates and panel-center offsets; keyboard input is unchanged.

## Project-authored MCP prompts

Create Markdown files in `<Cocos project>/mcp-prompts/`. These are MCP workflow templates, not executable scripts or automatically applied instructions. A client explicitly requests a template through `prompts/get`.

Example: `mcp-prompts/inspect-prefab.md`

```markdown
---
name: inspect_prefab
description: Inspect a Cocos prefab without modifying it.
arguments: prefab_path(required), focus
---
Inspect prefab {prefab_path}. Focus: {focus}.
1. Read cocos://project/context and confirm the active Cocos project.
2. Resolve the exact asset URL and UUID. Inspect the prefab and its references using the exposed tool catalog.
3. Report missing references, unexpected layers, or hierarchy problems with exact asset/node identifiers.
This workflow is read-only. Do not rebuild or modify the prefab.
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/get",
  "params": {
    "name": "inspect_prefab",
    "arguments": {
      "prefab_path": "db://assets/ui/Main.prefab",
      "focus": "UI_2D layers and serialized references"
    }
  }
}
```

- The frontmatter is a small dependency-free format, **not general YAML**: unquoted single-line `name`, `description`, and comma-separated `arguments` only. A `(required)` suffix marks mandatory arguments.
- Names match `[a-z][a-z0-9_-]{0,63}`. Descriptions are at most 512 characters. The body must not be empty.
- Argument values must be strings. Missing required values, unknown names/arguments, and non-string values return JSON-RPC `-32602`. Omitted optional placeholders become empty strings. Substitution is single-pass and never evaluates code.
- Built-in names cannot be shadowed. Duplicate names, oversized files, malformed definitions, and symlinks are skipped with warnings in the Cocos editor console and MCP diagnostic logs.
- Discovery is limited to the first 100 top-level `.md` files in name order, each at most 256 KiB. Prompt arguments are limited to 65,536 characters each.
- Files are re-read on `prompts/list` and `prompts/get`; no editor restart is required. Clients that cache the prompt list may need a refresh/reconnect. The server does not advertise prompt-list change notifications.
- Existing built-in prompts remain callable without arguments. Optional context arguments are `touched_paths`, `idea`, `focus`, and `target` / `component_type`, respectively.

## Connection examples

Use the exact server name and URL in the MCP Server panel. Documentation examples containing `funplay_cocos` and port `8765` illustrate a legacy/fixed endpoint, not the new default. The stdio wrapper's legacy default is also `8765`; pass `--url` or `FUNPLAY_COCOS_MCP_URL` explicitly for a project-derived port.

Generated JSON preserves unrelated settings and entries. JSONC or malformed/non-object configuration is left untouched with an error. TOML updates preserve unrelated sections and options; ambiguous forms such as inline MCP tables or multiline strings currently require manual configuration. Configuration writes preserve file permissions and reject a changed read snapshot before atomic replacement.

To pin a port explicitly in `cocos-mcp-bridge.config.json`:

```json
{
  "host": "127.0.0.1",
  "portMode": "fixed",
  "port": 8765
}
```

Use `"portMode": "project"` to derive the port again. `COCOS_MCP_PORT` overrides the saved choice for that editor process.
