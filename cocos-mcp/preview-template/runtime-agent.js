/* cocos-mcp-runtime-agent:1 */
(function installCocosRuntimeAgent() {
    'use strict';

    /** 当前页面只安装一次 Agent 执行器，避免重复加载模板时覆盖状态。 */
    if (globalThis.__cocosAgentRuntime) return;
    /** 与 AsyncFunction 使用相同的页面上下文，支持 await 与显式 return。 */
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    /** 将业务数据和引擎对象转成有界 JSON，避免循环引用和整棵引擎对象图。 */
    function serializeRuntimeValue(input, cc) {
        /** 记录已访问对象，阻断引擎与业务对象的循环引用。 */
        const seen = new WeakSet();
        /** 返回最多二十处省略原因，方便 Agent 缩小下次查询范围。 */
        const omitted = [];
        /** 限制一次结果包含的属性与数组项总数。 */
        let remainingEntries = 2000;
        /** 限制所有字符串累计返回的字符数。 */
        let remainingText = 262144;
        /** 为被省略的数据记录路径和原因。 */
        function truncate(trail, reason) {
            if (omitted.length < 20) omitted.push({ path: trail, reason });
            return `[${reason}]`;
        }
        /** 按深度与数量上限转换当前值。 */
        function visit(value, depth, trail) {
            if (value === null || value === undefined) return null;
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
            if (typeof value === 'bigint') return value.toString();
            if (typeof value === 'string') {
                /** 当前字段在单项和累计文本额度内可保留的长度。 */
                const count = Math.min(value.length, 65536, remainingText);
                remainingText -= count;
                if (count < value.length) { truncate(trail, 'TextLimit'); return value.slice(0, count) + '[TextLimit]'; }
                return value;
            }
            if (typeof value !== 'object') return `[${typeof value}]`;
            if (seen.has(value)) return truncate(trail, 'Circular');
            if (depth > 8) return truncate(trail, 'DepthLimit');
            if (--remainingEntries < 0) return truncate(trail, 'EntryLimit');
            seen.add(value);
            if (cc.Node && value instanceof cc.Node) {
                return { type: 'cc.Node', uuid: value.uuid, name: value.name, active: value.active, activeInHierarchy: value.activeInHierarchy };
            }
            if (cc.Component && value instanceof cc.Component) {
                return { type: cc.js.getClassName(value), uuid: value.uuid, enabled: value.enabled, node: value.node?.uuid || null };
            }
            if (value instanceof Date) return value.toISOString();
            if (Array.isArray(value)) {
                /** 当前数组保留的 JSON 项目。 */
                const items = [];
                /** 当前读取的源数组位置。 */
                for (let index = 0; index < value.length; index++) {
                    if (remainingEntries < 0) { items.push(truncate(trail, 'EntryLimit')); break; }
                    remainingEntries--;
                    items.push(visit(value[index], depth + 1, `${trail}[${index}]`));
                }
                return items;
            }
            /** 无原型对象避免业务字段改变结果对象的原型。 */
            const output = Object.create(null);
            /** 当前源对象字段名。 */
            for (const key of Object.keys(value)) {
                if (remainingEntries-- < 0) { truncate(trail, 'EntryLimit'); break; }
                /** 返回结果中的有界字段名。 */
                const label = key.slice(0, 128);
                try { output[label] = visit(value[key], depth + 1, `${trail}.${label}`); }
                catch (error) { output[label] = `[PropertyError: ${error.message}]`; }
            }
            return output;
        }
        /** 转换后的根数据，最终编码大小还需包含 JSON 转义开销。 */
        let value = visit(input, 0, '$');
        if (JSON.stringify(value).length > 262144) value = truncate('$', 'SerializedSizeLimit: return fewer fields');
        return { value, serialization: { truncated: omitted.length > 0, omitted } };
    }

    /** 在当前真实游戏页面执行一次 Agent JavaScript，并返回来源和有界数据。 */
    async function execute(options = {}) {
        if (typeof options.code !== 'string' || !options.code.trim()) throw new Error('runtime JavaScript code is required');
        if (options.code.length > 65536) throw new Error('runtime JavaScript code exceeds 64 KiB');
        if (!globalThis.System?.import) throw new Error('Cocos SystemJS runtime is not ready');
        /** 当前预览实际加载的引擎模块，不依赖全局 cc。 */
        const cc = await globalThis.System.import('cc');
        /** 执行时正在运行的游戏场景。 */
        const scene = cc.director.getScene();
        if (!scene) throw new Error('No running game scene is available');
        /** 记录脚本执行耗时的起点。 */
        const started = performance.now();
        /** 以当前页面作用域执行异步函数体，保留显式 return 语义。 */
        const runner = new AsyncFunction('cc', 'scene', 'args', 'env', `
            /** 兼容 CommonJS 风格的脚本入口。 */
            const module = { exports: {} };
            /** 与 module.exports 指向相同的初始导出对象。 */
            const exports = module.exports;
            ${options.code}
            if (typeof run === 'function') return await run(env);
            if (typeof module.exports === 'function') return await module.exports(env);
            if (module.exports && typeof module.exports.run === 'function') return await module.exports.run(env);
        `);
        /** 调用方传入的独立 JSON 参数。 */
        const args = options.args || {};
        /** 等待业务查询完成后取得的原始结果。 */
        const result = await runner(cc, scene, args, { cc, scene, args, window: globalThis });
        /** 可经桥接 JSON 回传的数据及截断说明。 */
        const serialized = serializeRuntimeValue(result, cc);
        return {
            context: 'runtime', capturedAt: new Date().toISOString(), durationMs: performance.now() - started,
            page: { title: document.title, url: location.href, visibility: document.visibilityState },
            scene: { name: scene.name, uuid: scene.uuid }, result: serialized.value, serialization: serialized.serialization
        };
    }

    /** 暴露给同页面预览中继；该对象不是沙箱，不提供额外网络执行端点。 */
    globalThis.__cocosAgentRuntime = Object.freeze({ version: 1, execute });
})();
