---
name: cocos-skill
description: 通过 Cocos Dashboard 查询、打开、导入和移除工程，并为 Cocos Creator 3.8.5 及以上的 3.8.x 工程提供磁盘结构检查、素材缩略图册、严格 RGBA 图片比较和 Chrome Web 预览排障。
---

# Cocos Creator 辅助诊断

诊断功能适用于 Creator `>=3.8.5 <3.9.0`。场景、Prefab、资源编辑及 UI 制作和在线验收由 Funplay 的 `funplay-cocos-mcp-workflow` 与 `funplay-cocos-ui-composition` 提供。需要操作目标工程时，先读取工程适用的规则，再使用对应的 [Funplay 官方技能](https://github.com/FunplayAI/funplay-cocos-mcp/blob/main/docs/PROJECT_WORKFLOWS.md#built-in-skill-references)。

需要安装、更新或迁移 Funplay MCP 时，按 [Funplay MCP 安装默认](modules/setup-funplay-mcp.md)执行全局安装，并应用 `full`、关闭 MCP 控制台日志和默认选择 Codex 的设置。

## Dashboard 工程管理

需要查询工程或编辑器、无需识屏地通过 Dashboard 打开已登记的工程、导入项目或从列表移除条目时，读取 [Dashboard 工程管理](modules/manage-dashboard-projects.md)。

## 磁盘结构检查

怀疑场景或 Prefab 序列化损坏、元数据缺失或重复时，使用只读脚本检查 `assets/`。它检查空对象表、越界的 `__id__`、JSON 解析错误、缺失或孤立的 `.meta`，以及跨文件的重复 UUID 声明。结果反映已保存文件。

```powershell
node "<技能根目录>/scripts/validate-project.mjs" --project "<工程目录>" --json
```

需要核对资源引用是否能在 AssetDB 解析时，使用 Funplay 的 `validate_asset_dependencies` 或 `validate_prefab_references`。

## 图像工具

需要从本地素材中查找候选时生成缩略图册。输出包括素材路径、像素尺寸、透明边界和分页缩略图。

```powershell
python "<技能根目录>/scripts/build-visual-asset-catalog.py" --root "<素材目录>" --output "<输出目录>"
```

用户要求严格像素比较时，将同一尺寸、对应同一内容状态的参考图和实际截图传给脚本。尺寸不同时报告尺寸差异；尺寸相同时逐像素比较 RGBA，可输出热图、50% 叠图及 JSON。用 `mismatchBounds`、`topMismatchRows` 和 `topMismatchColumns` 定位差异。

```powershell
python "<技能根目录>/scripts/compare-ui-images.py" --reference "<参考图>" --actual "<实际截图>" --diff "<输出目录>/diff.png" --overlay "<输出目录>/overlay.png" --report "<输出目录>/compare.json"
```

图片脚本需要 Python 3.10+ 和 Pillow。将命令中的占位符替换为对应绝对路径。

## Chrome Web 预览排障

分析 Web 预览的请求、主线程开销或内存保留时，读取 [运行时排障与性能分析](modules/analyze-runtime-performance.md)。
