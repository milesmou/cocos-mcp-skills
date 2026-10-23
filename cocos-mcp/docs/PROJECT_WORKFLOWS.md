# Project isolation, Skills, and workflows

## 工程默认配置

- 工程插件没有管理菜单和配置面板，随 Creator 自动启动，只监听本机回环地址。
- 服务端口按工程路径稳定派生；工程身份校验用于阻止端口被其他工程复用后的错误操作。
- Codex 通过连接文件发现实际地址。旧工程配置文件和环境覆盖不再生效，原文件保留。
- Codex 和工程桥接均默认开放全部编辑器工具；JavaScript 安全检查和参数校验保持启用。

## Unified Cocos skill

The two built-in Funplay skill templates have been merged into [cocos-skill](../../cocos-skill/SKILL.md). Install the unified skill through the repository Codex installer. The editor no longer has a Project Skills panel, managed-template installation/update/backup actions, or Configure + Skills setup. Existing user-authored skills and instruction files are retained. The generic create_project_skill tool remains available only for explicitly authored custom project guidance.

MCP results retain structured data and separate script execution logs. Service startup and tool exposure use fixed defaults; no editor management panel is required.

## Asset Database readiness

`check_asset_ready` is available by default. Example tool arguments:

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

## 连接

默认使用 Codex 本地入口并调用 `connect_cocos_project`，见 [安装与迁移](CODEX_SETUP.md)。已有 HTTP 客户端从目标工程 `temp/cocos-mcp-connection.json` 获取实际 URL；兼容代理 `bin/funplay-cocos-mcp.js` 使用显式 `--url` 连接，不依赖旧的固定端口示例。
