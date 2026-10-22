# Contributing to cocos-mcp-skills

This source integration is forked from [FunplayAI/funplay-cocos-mcp](https://github.com/FunplayAI/funplay-cocos-mcp). Follow the repository [AGENTS.md](../AGENTS.md) and preserve the source and license boundaries in [UPSTREAM.md](../UPSTREAM.md).

Clone `https://github.com/milesmou/cocos-mcp-skills`, then run `node scripts/install-codex.js` from the repository root. The root has no npm project. The Codex MCP name is `cocos-mcp`; the single Creator extension is `cocos-mcp-bridge`.

Use `connect_cocos_project` with an absolute Creator 3.8.x project path. It installs the missing extension and preview template. Legacy `funplay-cocos-mcp` and `cocos3-codex-bridge` require explicit `migrateLegacy: true`; complete backups are retained under the target project's `temp/cocos-mcp-install/`. Save and fully restart Creator after installation or migration, then reconnect and verify the project identity. Do not close the user's editor automatically.

Keep MCP/editor implementation in this directory and combined task guidance in `../cocos-skill/`. Authentication, scene helpers and runtime relay live in `lib/creator-bridge/`; `compat/creator-bridge/` only retains CLI compatibility and tests. New scene helper methods must use the `bridge` prefix to avoid changing MCP method signatures.

Run the relevant existing checks from the repository root:

```powershell
npm --prefix cocos-mcp run check
npm --prefix cocos-mcp run check:codex
npm --prefix cocos-mcp run check:compat
npm --prefix cocos-mcp test
npm --prefix cocos-mcp run docs:check
npm --prefix cocos-skill run check
npm --prefix cocos-skill test
```

After tool changes, regenerate `docs/TOOLS.md` with `npm --prefix cocos-mcp run docs:generate`. Validate editor-dependent behavior in a real target project and report anything that could not be exercised. Keep temporary output in repository `.work/`, or the external project's `temp/cocos-skill/<task>/`.

Use `git diff -w` when reviewing changes. Source distributions must not replace this integration with upstream release downloads; retained upstream release manifests and scripts are historical references.
