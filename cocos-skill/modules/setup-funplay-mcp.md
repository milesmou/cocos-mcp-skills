# Funplay MCP 安装默认

为目标 Cocos Creator 工程接入或迁移 Funplay MCP 时，默认使用当前 Creator 版本的全局扩展和 Codex 用户级技能。全局扩展的默认工具范围为 `full`，默认关闭「打印 MCP 日志」，客户端默认选择 Codex。先核对工程根目录、Creator 版本和 Funplay 安装状态。

1. 在 Creator 的 **Funplay > MCP Settings > 所有项目** 执行「为所有项目安装」。首次接入且尚无 Funplay 菜单时，按官方说明引导安装，再使用该全局安装入口。安装器校验上游发布包，并登记到 Creator 版本对应的全局目录。Windows 默认目录为 `%USERPROFILE%\.CocosCreator\builtin-extensions\<Creator 版本>\funplay-cocos-mcp`。
2. 官方包安装或更新完成后，从已安装技能根目录运行 `node scripts/apply-funplay-defaults.mjs --creator-version <版本>`。脚本修改本机该版本全局扩展里的 `lib/config.js`，将 `toolProfile`、`enableConsoleLogging` 和 `lastClientTargetId` 的缺省值分别设为 `"full"`、`false`、`"codex"`。新会话加载全局扩展时读取这些缺省值，工程根目录 `funplay-cocos-mcp.config.json` 中已有的值仍优先生效。官方更新会替换全局扩展文件，更新后重新运行此步骤。
3. 将 `funplay-cocos-mcp-workflow` 和 `funplay-cocos-ui-composition` 安装到 Codex 用户目录 `~/.agents/skills/`。从已安装的全局 Funplay 扩展加载 `lib/project-skills.js`，对两个技能分别调用 `updateBuiltInProjectSkill(os.homedir(), { clientId: 'codex', skillName, extensionVersion, onlyIfMissing: true })`，其中 `extensionVersion` 取扩展 `package.json` 的版本。用 `getBuiltInProjectSkillState` 和文件读取核对 `SKILL.md` 与各自的 `references/`。保留已有技能和本地改动。
4. 在 **Funplay > MCP Server** 选择 Codex 并执行客户端配置。面板的「配置 + Skills」会写入项目级技能，只有需要在工程内单独维护技能时才选用。通过面板 URL 连接目标工程，使用 `get_project_info` 核对工程路径、Creator 版本、工具范围、日志设置和当前加载的扩展路径。需要核对实际已开放工具时，读取 `get_tool_catalog`。

全局安装按 Creator 版本隔离。当前会话若加载的是项目副本，先保留现场，之后重新打开工程再检查加载路径。如仍有重复安装，确认全局副本可用后按目标工程的规则处理项目副本。

[Funplay 官方安装和配置说明](https://github.com/FunplayAI/funplay-cocos-mcp/blob/main/README_CN.md)
