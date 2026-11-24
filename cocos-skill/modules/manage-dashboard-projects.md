# Dashboard 工程管理

用于在 Windows 上查询 Cocos Dashboard 的工程与编辑器登记，以及通过 Dashboard 打开、导入和移除工程。已核对的 Dashboard 版本为 2.2.2。工程管理按 Dashboard 登记的产品和版本查询，技能中的诊断脚本仍适用于 Creator `>=3.8.5 <3.9.0`。

输入为操作和目标工程根目录。查询可指定工程类型、版本范围或其他字段。按名称查找时，遇到同名工程先用完整路径区分。编辑器查询按产品类型和完整版本号筛选。

## 查询工程和编辑器

在仓库根目录运行 `npm --prefix cocos-skill ci` 安装脚本依赖。以下命令从已安装的技能根目录解析脚本路径，参数中的工程路径为绝对路径。

```powershell
$script = '<技能根目录>/scripts/dashboard-projects.mjs'
node $script projects
node $script projects --type 3D --version '>=3.8.5 <3.9.0'
node $script editors
node $script editors --type Creator3D --version 3.8.8
node $script inspect --path '<工程根目录>'
```

- `projects` 输出登记记录，可用 `--filter` 传入 JSON 对象按输出字段匹配。版本使用 SemVer 范围，其他字段按值匹配。`path` 是完整工程路径，`directory` 是项目列表显示的父目录。
- `editors` 输出产品类型、版本、可执行文件路径和安装状态。`installed` 要求 Dashboard 标记安装完成且文件存在。Creator 3.x 的产品类型为 `Creator3D`。
- `inspect` 核对指定目录、`assets`、`package.json` 中的 `creator.version`、完整登记路径、匹配编辑器和运行进程。打开前同时核对工程配置和登记版本，有差异时使用 Dashboard 给出的项目信息确认版本，再处理可能的升级提示。
- 默认只读读取 `%USERPROFILE%\.Cocos\profiles` 下的 `project.json` 和 `editor.json`。`--profiles <目录>` 可指定其他快照目录。工程的 `progress` 和 `state` 来自磁盘记录，`running` 根据实际 Creator 命令行匹配完整路径。进程查询不可用、信息不完整或指定 `--snapshot` 时，未匹配工程的 `running` 为 `null`。

## 在 Dashboard 中操作

从 PowerShell 执行 `Start-Process 'cocos-dashboard://panel/MAIN.project'` 唤起项目页。协议未注册时，用本机 Codex 指令或用户提供的 Dashboard 路径启动，再进入「项目」页。用 Windows 桌面工具读取可访问控件，按核对过的完整路径定位。控件无法操作时，重新获取当前窗口状态，通过可见控件完成。通过 shell 或其他桌面控制环境无法操作界面时，报告卡住的操作和已核对的工程信息。

| 操作 | 在 Dashboard 中执行 | 验证结果 |
| --- | --- | --- |
| 打开工程 | 先执行 `inspect`。匹配到运行进程时复用会话。否则在「项目」页找到目标，核对关联 Creator 版本后打开。缺少登记时先走导入。遇到会改写工程版本的提示时，按用户确认的目标版本处理。 | 等待 Creator 工程窗口就绪，再用 `inspect` 核对进程对应的完整路径和编辑器文件。需要在线编辑时，按工程规则用 Funplay `get_project_info` 核对连接。 |
| 导入工程 | Creator 3.x 先用 `inspect` 核对工程根目录、`assets` 和 `creator.version`。已登记则复用条目。否则点击「导入项目」，在目录选择器选中完整工程根目录。 | 重新读取登记记录，核对完整路径和 Creator 版本。 |
| 从列表移除 | 打开目标工程的操作菜单，选择移除，在确认对话框中选择保留工程文件。用户明确要求将工程移入回收站时，按当前桌面工具的确认要求单独处理。 | 重新读取登记记录。移除成功后，该路径已不在列表，且选择保留时对应目录仍存在。 |

## 接口与交付

Dashboard 2.2.2 的工程列表和编辑器查询分别对应 `lib-project:queryAll`、`lib-project:query`、`lib-editor:query`、`lib-editor:find`。打开、导入、移除由 Dashboard 自己的界面调用 `lib-project:open`、`lib-project:add`、`lib-project:remove`。这些是安装包内的 Electron 消息。脚本通过本地登记文件和系统进程完成查询，界面操作由 Dashboard 处理。内部 `remove(path, true)` 会进入回收站分支，从列表移除时应在界面选择保留文件。

交付时报告完整工程路径、登记版本、匹配编辑器以及实际验证到的状态。分别记录已登记、已发起启动、已就绪和已移除。
