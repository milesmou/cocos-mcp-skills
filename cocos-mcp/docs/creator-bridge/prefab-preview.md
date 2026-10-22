# 预览 Cocos Prefab

只使用 Creator 内部真实渲染。编辑器不可用、版本低于 3.8.5 或内部接口失败时停止并报告，不生成近似预览。

命令中的 `<MCP目录>` 是本地服务目录的绝对路径，`<工程目录>` 是目标 Cocos 工程绝对路径；替换占位符并保留引号，不依赖当前工作目录。

## 真实 PNG

1. 按 [桥接安装](README.md) 安装或更新 `cocos3-codex-bridge` 扩展 1.2.0 或更高版本后，调用 Creator 顶部菜单 `开发者 -> 重新加载`，等待桥接重新就绪。
2. 等待编辑器和 AssetDB 就绪。
3. 使用 `db://assets/...` URL 或 Prefab UUID 导出：

   ```powershell
   node "<MCP目录>/compat/creator-bridge/scripts/cocos-editor.mjs" `
     --project "<工程目录>" `
     --timeout 60000 `
     --width 1024 `
     --height 768 `
     preview db://assets/ui/example.prefab temp/cocos-prefab-preview/example.png
   ```

4. 检查返回的 UUID、尺寸、字节数和绝对输出路径，再查看 PNG。

输出必须位于目标工程的 `temp/cocos-prefab-preview/`（或其子目录）并使用 `.png`。桥接会拒绝 `temp/` 以外的路径。它会临时打开一个 Creator `simple` 面板，复用 Inspector 的 `PreviewExtends`、`scene:prefab-preview` 和 `query-prefab-preview-data`，强制切换并确认 2D 视图，完成 WebGL 绘制后立即读取 Canvas，不会修改 Prefab。

## 验收

- 确认导出来源是 `scene:prefab-preview`。
- 确认返回的 `previewMode` 是 `2D`；切换失败时停止导出，不接受上一次遗留的 3D 状态。
- 对比不同宽高时保持 Prefab 不变；宽高只是预览 Canvas 尺寸。
- 若 PNG 透明区域在图片查看器中显示为黑色，换用支持透明通道的查看器，不要据此修改 Prefab。
- Creator 升级到 3.9 或其他版本前重新核对内部接口；不要绕过桥接的版本检查。
