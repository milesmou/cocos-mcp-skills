# 来源与变更

工作流文档、离线结构检查与图像辅助脚本、UI 参考及原有测试来自：

- 仓库：<https://github.com/milesmou/cocos3-skill>
- 提交：`8cb5e0f41114bc0bae89ee601b54277dd0ed2bb1`

本仓库将原有技能合并为单一 `cocos-skill` 入口，移除逐技能注册信息和固定模型分工。与 MCP 重复的场景、节点、组件、资源、动画、脚本创建、预览和截图模块不再保留；独立资源导入、移动与重命名脚本及其测试也已移除。技能仅保留组合工作流与未被 MCP 完整覆盖的离线对象表及图像检查。

原编辑器桥接的实现与测试迁至 `../cocos-mcp/compat/creator-bridge/`；安装、API 和预览说明归 `../cocos-mcp/docs/creator-bridge/` 维护。

该上游快照没有独立的 LICENSE 文件；此处记录来源，不为其代码和文档补充或推定开源许可证，也不将 Funplay 的 MIT 许可证扩展到这些内容。
