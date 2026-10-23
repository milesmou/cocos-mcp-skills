# MyCookingGirl 工程 Agent 规则

## 适用范围与使用方式

本文件从 cocos-skill 原有的 MyCookingGirl UI 参考和特殊烹饪设备模块整理而来，供合并到 MyCookingGirl 工程根目录的 `AGENTS.md`。目标工程已有文件时保留其内容并合并相关条目，不直接覆盖。本文件在工具仓库中仅作为待迁入的项目规则，不由通用技能自动加载，也不适用于其他 Cocos 工程。

以下 `assets/...`、`settings/...` 和 `db://assets/...` 路径均相对目标游戏工程，不相对本文件或 cocos-mcp-skills 仓库。组件行为来自该项目采用的 cocos3-toolkit；执行前核对当前脚本实现、相邻 Prefab 和实际资源，不能仅凭同名组件套用规则。

原 UI 参考来自 Creator 3.8.8 下的 77 个 Prefab 快照。数量、750 × 1334 根尺寸及组件分布属于历史证据，不是当前版本或新界面的硬性指标；不要求维持固定数量。

## 工程与 MCP

- 通过 MCP 操作工程前，显式读取目标工程根目录的 `AGENTS.md`、适用的目录级规则及其中指定的任务相关文档。从工具仓库启动不能假设目标工程规则已自动加载。
- 确认目标工程绝对路径、当前 Creator 版本和编辑对象；连接返回 `connected: true` 后才能编辑。桥接安装后若返回 `restart_required`，等待用户保存并完全重启 Creator，再次连接核对工程身份。
- 当前设计分辨率与适配开关从 `settings/v2/packages/project.json` 的 `general.designResolution` 读取。全屏 UI 根使用当前设计尺寸，小控件和列表项保留自身尺寸。
- 场景、Prefab、资源和组件操作通过可用 MCP/AssetDB 接口执行，保留 UUID、`.meta`、嵌套实例和属性覆盖；不手写 Prefab 序列化对象表。

## UI 根结构与参考选择

- Prefab 根节点名与文件名一致。业务根按控制脚本要求挂载 `UITransform`、业务组件和 `ReferenceCollector`；`Animation`、`UIOpacity`、`Widget` 按职责选择。
- 常规全屏窗口通常在根控制器下设置 `home` 内容容器。`UIAvg`、`UIGuide`、`UIGameFailReason`、`UIDress`、Loading 等特殊窗口可能没有该结构，不强制补齐。
- 弹窗外部关闭热区可能名为 `fullCoseBtn`、`BtnCloseFull`、`BtnClose` 等。是否存在、名称、点击范围和顺序以控制脚本及同业务目录 Prefab 为准。
- 优先查看同业务目录职责相同的完整窗口和 item。长列表可参考 `UILetter`、`UIStroy`、`UIUpMachineList`、`UIMasterChallengeRank`；HUD 参考 `UIHUD` 的锚定与公共实例策略，不复制整棵复杂树。
- 展开的 UI 节点使用 `UI_2D`。离线读取嵌套 Prefab 存根时，不因存根未展开组件而判定缺少 `UITransform` 或 Layer。

## ReferenceCollector 与控制器作用域

- 仅脚本需要直接访问的节点使用 `$` 前缀，纯装饰节点保持普通名称。`$ItemNum` 对应 `this.rc.get("ItemNum", Type)`。
- key 是去掉 `$` 并 trim 后的名称，同一收集器作用域中必须唯一。大小写和 `tittle`、`seting`、`stroy` 等历史拼写属于代码接口，不顺手修正。
- 收集器仅管理自己的有效子树，遇到嵌套 `ReferenceCollector` 时停止深入；外层控制器不能直接读取该边界内部的 `$` 节点。
- 新增、移动或重命名 `$` 节点后调用工程实际的 `ReferenceCollector.refresh`，并检查 `_nodes`，确认 key、对象和作用域正确。
- 继承 `MUIComponent` 的业务脚本通过 `@requireComponent(ReferenceCollector)` 要求同节点收集器；挂载后仍需确认组件存在且已刷新。纯视觉节点不机械添加收集器。
- 需要独立控制的列表项保留自己的业务组件、收集器和所需 `$` 子节点。访问嵌套实例时优先使用实例根组件或公开引用，避免依赖易变深层路径。

## MButton 与点击分发

- 普通 UI 按钮优先使用项目 `MButton`。相邻界面或需求没有特殊配置时，采用 `transition = SCALE`、`zoomScale = 0.9`、`duration = 0.1`、`defaultAudio = true`、`cooldown = 0.2`。
- `_target` 可为空，此时沿用组件对自身节点的默认目标。长按、连击、快速响应和异形点击默认关闭；异形点击还需配置 `PolygonCollider2D`。
- `MUIComponent.__preload()` 扫描当前控制范围内的 `MButton`，转发至 `onClickButton(btnName, btn)`。遇到嵌套 `MUIComponent` 时停止，按钮归属最近控制器。
- 使用自动分发时按稳定按钮节点名处理点击，不再为同一逻辑添加序列化 `clickEvents`。只有现有脚本依赖独立 handler 或明确要求 Inspector 回调时才使用 `EventHandler`。
- 修改按钮名之前，搜索 `onClickButton` 的 switch、字符串比较和资源中的旧回调，避免破坏 `closeBtn`、`btnBack` 等既有接口。

## Switch、模板与初始状态

- 项目 `Switch` 按直接子节点索引维护 `checkIndex`。子节点顺序、默认索引及 `updateCheckByName` 使用的名称均为状态契约，必须完整记录和保留。
- Switch 表示显示状态，Toggle 表示用户选择；不能仅为统一组件而互换。
- inactive 节点可能是互斥状态、模板、引导、特效或暂不显示内容，不能全树激活，也不能全部当作模板。
- 固定槽位和状态子节点保留完整数量及顺序；动态同构列表才采用一个完整 item 模板或嵌套 item Prefab。先查脚本是否按固定索引、名称或数量访问，再处理相似节点。

## 布局、滚动、安全区与排序

- Layout 先设置 item 尺寸和间距，再从内向外更新。项目常用 `resizeMode = CONTAINER`，最终模式按容器职责及相邻实现选择。
- ScrollView 必须绑定 `content`，Content 位于带 Mask 的 viewport 子树内。已有结构以带 Mask 的 `content.parent` 推断 viewport 时，记录 `viewportSource = content.parent`，不另造一层 View。
- Content 使用 `ListEnhance` 时，直接子节点必须是完整 item 根；该组件通过 `UIOpacity` 隐藏视区外直接子项，不把一个 item 拆成多个平级渲染节点。
- 顶部、底部或全屏边缘控件需要安全区时，使用 `Widget + SafeWidget`。SafeWidget 仅用于位置不再被动画或业务代码修改的节点，同一轴不重复维护位置。
- `SortingNode2D` 一次性设置子树渲染器排序，`SortingPrevent` / `SortingGroup2D` 形成遍历边界。保留这些边界，不随意给内部 Sprite 添加或改写 `Sorting2D`。
- 重构前查询 AnimationClip 轨道和脚本路径。动画或脚本控制的位置、缩放、透明度和激活状态需标为动态，避免再由持续布局控制。

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
- 脚本使用 LF 换行，注释和交流使用中文。禁止循环引用，仅类型依赖使用 `import type`；日志使用 `mLogger`，不使用 `console`。

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
- 初始化时通过 `this.rc.get('Key', Type)` 缓存引用，不在 `update` 中反复 `get` / `find`。状态保存在 TypeScript 字段中，仅变化时同步 Spine / UI。
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
