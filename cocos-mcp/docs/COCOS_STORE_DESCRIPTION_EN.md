# Cocos MCP local source distribution

For Cocos Creator 3.8.x. Forked from [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp), retaining Funplay's MIT notice. Other imported bridge code has separate license boundaries; see [NOTICE](../NOTICE.md). This repository is not a Cocos Store release package.

- Codex runs `cocos-mcp` locally and can initialize, inspect projects and install a missing bridge before Creator starts.
- A single project extension, `cocos-mcp-bridge`, includes MCP, authenticated Editor messages, scene helpers, internal Prefab rendering and the Web preview runtime relay.
- Editor profiles provide 39 core / 105 full tools; the Codex gateway adds two connection tools and one DevTools entry. Consult the live schema for exposure settings.
- `execute_javascript` supports editor, scene and runtime contexts. Runtime targets the existing ordinary Web preview.
- Management panels are MCP Server, Tool Exposure and MCP Settings, with an internal Prefab renderer opened on demand. Workflow and UI Composition instructions live in the single `cocos-skill`; built-in skill management has been removed from Creator.
- Update this source distribution through the repository. Upstream release replacement is disabled. Chrome DevTools has an optional separately installed runtime.

Run `node scripts/install-codex.js` from the repository root, then call `connect_cocos_project` with the absolute project path. After installation, save and fully restart Creator, reconnect until `connected: true`, and refresh the original Web preview.

Use `migrateLegacy: true` to back up and migrate `funplay-cocos-mcp` and `cocos3-codex-bridge`. Existing unified extensions are not overwritten automatically. See [setup](CODEX_SETUP.md), [tools](TOOLS.md) and [DevTools](DEVTOOLS.md).
