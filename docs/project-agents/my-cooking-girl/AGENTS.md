# MyCookingGirl 项目规范迁入参考

本文件保存从旧 UI 参考和特殊烹饪设备流程迁出的项目专属条目，供迁入 MyCookingGirl 工程时核对与合并。实际执行以目标工程根 `AGENTS.md` 为准；有现有规则时先比较再合并，不直接覆盖。

本文不是 cocos-mcp-skills 仓库或通用 cocos-skill 的执行指令，不适用于其他游戏。以下路径均相对目标游戏工程，**不相对本文件所在目录**。目标工程须在根 `AGENTS.md` 显式引用并读取 `extensions/cocos3-toolkit/AGENTS.md` 第 0～10 节；该文件来自 toolkit 发布包。toolkit 的源码开发规则不应用于 SVN 游戏工程。

## 维护边界

| 规则 | 维护位置 |
| --- | --- |
| Creator/TS、性能、Transform、对象池、资源、事件、日志、UI/MCP 工作流 | cocos3-toolkit 的 `AGENTS.md` 共享部分 |
| ReferenceCollector、MUIComponent/MButton 分发、Switch、ListEnhance、SafeWidget、排序边界 | cocos3-toolkit 的 `AGENTS.md` 共享部分 |
| SVN、业务目录、UI 参考、按钮默认参数、公共 Prefab、cookMachine 专用逻辑 | 目标游戏工程根 `AGENTS.md` |
| 通用 MCP 能力与技能流程 | cocos-mcp-skills 的 MCP 文档与 `cocos-skill/` |

共享机制以目标工程安装版本的源码为准；不把 MyCookingGirl 的资源、参数或业务架构重新放入通用技能。项目专属条目变更时同步核对本迁入参考，避免旧参考覆盖当前工程。

---

## 版本控制规范

1. 当前工程使用 SVN 管理版本，禁止使用 Git 命令；所有版本控制相关操作必须使用对应的 SVN 命令。
2. 查看工作副本状态使用 `svn status`，查看改动使用 `svn diff`；需要忽略空白差异时使用 `svn diff -x -w`。
3. “提交 SVN”表示在工程根目录提交当前工作副本的所有改动。提交前必须通过 `svn status` 检查全部改动，将需要纳入版本控制的新文件执行 `svn add`、已删除文件执行 `svn delete`，然后在工程根目录执行 `svn commit .`。
4. SVN 提交日志必须使用 UTF-8 编码。包含中文时，禁止直接通过 `svn commit -m` 传递日志；必须将日志写入 UTF-8 编码文件，并使用 `svn commit . -F <日志文件> --encoding UTF-8` 提交。提交完成后必须通过 `svn log -r <版本号> --xml` 检查日志是否正确。

## 工程配置与工作流

- Creator 版本以工程 `package.json` 的 `creator.version` 和实际编辑器信息为准；当前配置为 3.8.8，不以历史快照覆盖当前版本。
- 设计分辨率与适配开关从 `settings/v2/packages/project.json` 的 `general.designResolution` 读取并记录。当前配置为宽 750、高 1500、`fitWidth = true`、`fitHeight = false`；这些值仅记录当前状态，执行任务时重新读取，不将本文件中的数值作为固定常量。
- 全屏 UI 根使用当前工程设计尺寸；小控件和列表项保留自身尺寸，不重复编码工程设计分辨率。
- 编辑器、UI 拼装、预览、保存与验收使用共享规范指定的当前 `cocos-skill` 和 MCP。旧 `.agents/cocos3-skill` 路径已由统一技能取代。
- 章节特殊烹饪设备必须先读取并执行本文件“章节特殊烹饪设备”一节，再结合通用工作流落地；不能仅套用普通组件流程，不再依赖已经移除的 `create-special-cook-machine` 独立 Skill。

## UI 根结构与参考选择

- Prefab 根节点名与文件名一致。业务根按控制脚本要求挂载 `UITransform`、业务组件和 `ReferenceCollector`；`Animation`、`UIOpacity`、`Widget` 按职责选择。
- 常规全屏窗口通常在根控制器下设置 `home` 内容容器。`UIAvg`、`UIGuide`、`UIGameFailReason`、`UIDress`、Loading 等特殊窗口可能没有该结构，不强制补齐。
- 弹窗外部关闭热区可能名为 `fullCoseBtn`、`BtnCloseFull`、`BtnClose` 等。是否存在、名称、点击范围和顺序以控制脚本及同业务目录 Prefab 为准。
- 优先查看同业务目录职责相同的完整窗口和 item。长列表可参考 `UILetter`、`UIStroy`、`UIUpMachineList`、`UIMasterChallengeRank`；HUD 参考 `UIHUD` 的锚定与公共实例策略，不复制整棵复杂树。

## 项目交互与历史接口

- 按钮、开关和滑块使用 toolkit 的 `MButton`、`MToggle`、`MSlider`，遵循共享规范的收集器和最近控制器分发边界。
- 相邻界面或需求没有特殊配置时，MButton 使用 `transition = SCALE`、`zoomScale = 0.9`、`duration = 0.1` 秒、`defaultAudio = true`、`cooldown = 0.2` 秒。
- `_target` 可为空，此时使用组件对自身节点的默认目标。长按、连击、快速响应和异形点击默认关闭；异形点击还需配置 `PolygonCollider2D`。
- 大小写和 `tittle`、`seting`、`stroy` 等历史拼写属于业务代码接口，不顺手修正。修改 `closeBtn`、`btnBack` 等按钮名之前搜索脚本中的 `onClickButton` 路由、字符串比较和序列化旧回调。
- 项目常用 Layout `resizeMode = CONTAINER`；先设置 item 尺寸与间距，再从内向外更新。最终模式按容器职责与相邻实现选择。

## 公共 Prefab 复用

使用前通过 AssetDB 核实当前 URL、UUID 和依赖。以下为项目已有资源路径，不固化历史 UUID，不复制内部节点树；差异优先采用实例属性覆盖。

| 用途 | 项目资源 URL |
| --- | --- |
| 红点 | `db://assets/bundles/dynamic/prefab/RedDot.prefab` |
| 战斗道具及目标 | `db://assets/bundles/dynamic/uiPrefab/fightItems/FightItem.prefab` |
| 钻石栏 | `db://assets/bundles/dynamic/uiPrefab/common/topDiamond.prefab` |
| 金币栏 | `db://assets/bundles/dynamic/uiPrefab/common/topGold.prefab` |
| 材料栏 | `db://assets/bundles/dynamic/uiPrefab/common/topMat.prefab` |
| 广告入口 | `db://assets/bundles/dynamic/uiPrefab/common/AdBtnItem.prefab` |
| 通用奖励项 | `db://assets/bundles/dynamic/uiPrefab/common/rewardItemShell.prefab` |
| 通用光效底 | `db://assets/bundles/static/Effect/AI_di.prefab` |

`FightItem_200x` 变体、`mainGmBtnList`、`moveNum` 和 `lianJiAnimNode` 等其他公共资源按任务查询真实位置，不凭名称推算路径。

## 章节特殊烹饪设备

仅在为 `machine_*` / 关卡机台编写章节专用逻辑时执行本节。普通 UI 或普通逻辑组件不套用设备架构。

### 边界与落地位置

- 默认继承 `cookMachine`，不新建第二套设备基类。特殊逻辑放子类，不堆入通用 `cookMachine` / `machineCtrl`；用户明确要求公共钩子时才最小调整基类。
- 脚本放在 `db://assets/bundles/Level_<章节表 LevelTabId>/scripts/`，文件名与 `@ccclass('...')` 一致，沿用项目驼峰类名风格。
- 通常一个机台一个专用类；多个机台确实共享规则时可共用。挂载前确认是替换原 `cookMachine` 还是额外挂载，通常替换为子类组件，避免双重执行。
- 注释和交流使用中文；LF、依赖、日志与生命周期同时遵循共享规范。

### 实现前查询

确认机台 ID、Level bundle、Prefab、依赖的 `$` 节点以及 Spine 动画名和骨骼名；名称来自实际资源，不编造。

| 参考职责 | 相对目标工程根目录的脚本路径 |
| --- | --- |
| 火力改变制作时间 | `assets/bundles/Level_2/scripts/JiaoHuaJiKaoLu.ts` |
| 骨骼库存与自动补货动画 | `assets/bundles/Level_4/scripts/yuXiaChuanMachine.ts` |
| 设备基类和可覆写钩子 | `assets/scripts/ui/battle/machine/cookMachine.ts` |
| 表现层 | `assets/scripts/ui/battle/machine/machineShow.ts` |

按当前基类实现核对 `maxStockNum`、`getAddFoodTimeS()`、`startAddFoodNum()`、`showNumBar()`、`initMachineData`、`initOnBattleStart`、`initMachineState`、`getWorkTime()`、`roleActiveMeCheck()`；这些名称是查找线索，不能假定当前版本全部存在。需要新增钩子时先说明理由，再最小修改。

### 子类与表现层

- 基类导入沿用 `import { cookMachine } from 'db://assets/scripts/ui/battle/machine/cookMachine'`，先确认实际导出。
- 设备通过共享规范规定的 ReferenceCollector 作用域缓存依赖，状态保存在 TypeScript 字段中，仅变化时同步 Spine / UI。
- 定时器使用 `schedule` / `unschedule`，在 `onDisable` / `initMachineState` 成对清理，防止重开或重置遗留回调。
- 动画优先走 `myMachineShowTs` / 基类 `playAnimState`；需要同状态重播时先查 `machineShow` 是否有强制接口，缺少时再最小扩展。
- 补货和制作动画时长与逻辑时长对齐，检查 `getAddFoodTimeS` 的引导压缩路径，不能固定假设普通时长；原实现中引导补货可能压到 1 秒。
- 隐藏库存条或补货条时同时检查 `roleActiveMeCheck`，防止父类将条未激活视为异常而重新显示。
- 通过 MCP/AssetDB 导入脚本，等待注册并检查诊断；再在目标 Prefab 上替换或挂载实际注册组件，保存并回读引用。

## 项目验收与交付

- UI：检查 `$` key、收集器和最近控制器归属、按钮路由唯一性、Switch 顺序及默认索引、模板显隐、viewport/Content/Mask、SafeWidget 和排序边界；刷新受影响收集器。
- 设备：验证开局、战斗开始、重置后的 UI 和骨骼状态，以及补货、制作、拿取、引导压缩时间和技能加速路径；检查定时器清理及高频节点查询。
- 区分静态 Prefab 检查与真实运行验证。依赖业务数据、适配、动画或交互时必须取得相应运行证据；有视觉参考时按通用 UI 工作流比较真实渲染。
- 交付说明修改对象、已保存与已验证状态、未完成项。设备任务另列挂载节点、是否替换原组件、依赖的 `$` 引用/动画名及基类钩子变化。
