/**
 * Browser half of `dsh-plugin-workbuddy-gateway`.
 *
 * This file is the loader's lazy-CJS factory artifact: the page injects
 * `window.__ModuleLoader__`, and the client module system loads it when the
 * profile composes the package. `react` is the only external, and it comes from
 * the loader's module table rather than a bundled copy.
 *
 * It contributes one section to the settings panel (`settings.section`): the
 * gateway's lifecycle controls, its accounts, its model inventory, and the
 * `llm-pi-ai` route that puts those models in the picker. All data comes from
 * the host half over same-origin `fetch`; this file only renders and polls.
 *
 * @module dsh-plugin-workbuddy-gateway/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-workbuddy-gateway',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const h = React.createElement

    /** Host bridge base; mirrors `ROUTE_BASE` in the host half. */
    const BASE = '/dsh-workbuddy-gateway/api/v1'

    /** Poll interval while the gateway is running or starting. */
    const POLL_ACTIVE_MS = 2000

    /** Poll interval while the gateway is stopped or failed. */
    const POLL_IDLE_MS = 5000

    /** Two languages, as the rest of this machine's plugins do. */
    const COPY = {
      zh: {
        nav: 'WorkBuddy',
        intro: '把 WorkBuddy（workbuddy.ai / codebuddy.cn）的订阅额度变成 DSH 可用的模型。插件负责托管本地反代网关、管理账号，并写入对应的模型提供方路由。',
        state: {
          running: '运行中',
          starting: '启动中',
          stopped: '已停止',
          failed: '启动失败',
        },
        stateHint: {
          running: '网关正在提供 OpenAI 兼容接口',
          starting: '正在等待网关报告监听成功',
          stopped: '网关未运行，WorkBuddy 模型不可用',
          failed: '网关启动失败或已退出，见下方日志',
        },
        start: '启动',
        stop: '停止',
        restart: '重启',
        refresh: '刷新',
        starting: '正在启动…',
        stopping: '正在停止…',
        gateway: '网关',
        endpoint: '接口地址',
        pid: '进程',
        uptime: '已运行',
        port: '端口',
        gatewayDir: '网关目录',
        pythonPath: 'Python 解释器',
        platform: '平台',
        script: '启动脚本',
        accountStore: '账号目录',
        usageStore: '用量目录',
        applyPort: '应用端口',
        portNote: '改动端口会同时更新模型路由里的接口地址；需要重启网关才生效。',
        key: '接口密钥',
        keySet: '已配置',
        keyUnset: '未配置',
        keyNote: '密钥存放在 DSH 的凭据库里（WORKBUDDY_API_KEY），不写进 settings.yaml。网关与模型路由都用它。',
        generateKey: '生成密钥',
        clearKey: '清除密钥',
        keyOnce: (value) => `新密钥（只显示这一次）：${value}`,
        accounts: '账号',
        noAccounts: '还没有账号。用下面的「浏览器授权登录」，或从本机 WorkBuddy 桌面端导入。',
        // The gateway filters its account list by realm, so both numbers are
        // scoped to one realm; a cross-realm "usable" count was the bug.
        accountUsable: (usable, total) => `本区可用 ${usable} / 共 ${total}`,
        accountScopeNote: '只列出当前区域的账号。另一个区（国内版 / 国际版）需要切换区域才会显示。',
        realm: '区域',
        realmIntl: '国际版 (workbuddy.ai)',
        realmCn: '国内版 (codebuddy.cn)',
        realmDefault: '跟随网关当前设置',
        realmNote: '网关运行时切换区域立即生效；停止时在下次启动应用。',
        realmSwitched: '区域设置已保存。请查看网关当前区域和模型清单。',
        activeRealm: '网关当前区域',
        modelsRealm: '模型清单所属区域',
        realmUnknown: '未确认',
        realmStopped: '网关未运行',
        realmManual: '自动维护已关闭；请点击「写入模型路由」更新 DSH 模型选项。',
        expires: (text) => `${text} 后过期`,
        disabled: '已停用',
        scan: '扫描桌面端账号',
        refreshCredits: '刷新积分',
        claimCredits: '领取积分',
        checkin: '签到',
        checkedIn: (time) => `已签到${time ? ` · ${time}` : ''}`,
        notCheckedIn: '未签到',
        enableAll: '全部启用',
        disableAll: '全部停用',
        enable: '启用',
        disable: '停用',
        creditBalance: (value) => `${value} 积分`,
        taskClaimed: '积分任务已执行，请刷新积分查看结果。',
        scanNote: '只读取本机 WorkBuddy 桌面端已有的凭证，不会修改它。',
        import: '导入',
        imported: (name) => `已导入 ${name}`,
        remove: '移除',
        confirmRemove: '确认移除',
        cancel: '取消',
        login: '浏览器授权登录',
        loginStarted: '已在浏览器打开授权页；完成后账号会自动出现。',
        loginWait: '等待授权…',
        loginDone: '授权完成',
        loginFailed: (message) => `授权失败：${message}`,
        openLink: '打开授权链接',
        models: '模型',
        modelsNote: (count) => `网关提供 ${count} 个模型。`,
        modelContext: '上下文',
        modelOutput: '最大输出',
        modelReasoning: '推理档位',
        modelVision: '图片',
        provider: '模型路由',
        providerPresent: '已写入 settings.yaml',
        providerAbsent: '未写入',
        providerNote: '把网关的模型注册成 DSH 的提供方，模型选择器里就会出现。只增删本插件自己那一条路由，不动其他提供方。',
        providerSync: '写入模型路由',
        providerRemove: '移除模型路由',
        providerWaiting: '需要先启动网关才能读取模型清单。',
        providerSynced: (count) => `已写入 ${count} 个模型。`,
        providerRemoved: '已移除模型路由。',
        log: '网关日志',
        logEmpty: '暂无输出。',
        readErrors: '部分读取失败',
        busy: '处理中…',
        failed: (message) => `操作失败：${message}`,
        hostHint: 'host 半改动需要重启 dsh 才生效；本页刷新即可。',
        autostart: '随 dsh 启动',
        autoSync: '自动维护模型路由',
        save: '保存',
        saved: '已保存。',
      },
      en: {
        nav: 'WorkBuddy',
        intro: 'Turns a WorkBuddy (workbuddy.ai / codebuddy.cn) subscription into models DSH can use. The plugin supervises the local translation gateway, manages its accounts, and writes the matching provider route.',
        state: {
          running: 'Running',
          starting: 'Starting',
          stopped: 'Stopped',
          failed: 'Failed',
        },
        stateHint: {
          running: 'The gateway is serving an OpenAI-compatible endpoint',
          starting: 'Waiting for the gateway to report that it is listening',
          stopped: 'The gateway is not running, so WorkBuddy models are unavailable',
          failed: 'The gateway failed to start or has exited — see the log below',
        },
        start: 'Start',
        stop: 'Stop',
        restart: 'Restart',
        refresh: 'Refresh',
        starting: 'Starting…',
        stopping: 'Stopping…',
        gateway: 'Gateway',
        endpoint: 'Endpoint',
        pid: 'Process',
        uptime: 'Uptime',
        port: 'Port',
        gatewayDir: 'Gateway directory',
        pythonPath: 'Python interpreter',
        platform: 'Platform',
        script: 'Launch script',
        accountStore: 'Account store',
        usageStore: 'Usage store',
        applyPort: 'Apply port',
        portNote: 'Changing the port also updates the endpoint in the provider route; restart the gateway for it to take effect.',
        key: 'API key',
        keySet: 'Configured',
        keyUnset: 'Not configured',
        keyNote: 'The key lives in DSH\'s credential store (WORKBUDDY_API_KEY), never in settings.yaml. Both the gateway and the provider route use it.',
        generateKey: 'Generate key',
        clearKey: 'Clear key',
        keyOnce: (value) => `New key (shown once): ${value}`,
        accounts: 'Accounts',
        noAccounts: 'No accounts yet. Use "Sign in via browser" below, or import from the local WorkBuddy desktop app.',
        // Both numbers are scoped to one realm, because that is how the gateway
        // filters its account list.
        accountUsable: (usable, total) => `${usable} usable of ${total} in this realm`,
        accountScopeNote: 'Only accounts in the current realm are listed. Switch realms to see the other one.',
        realm: 'Realm',
        realmIntl: 'Global (workbuddy.ai)',
        realmCn: 'China (codebuddy.cn)',
        realmDefault: 'Follow the gateway\'s current setting',
        realmNote: 'Realm changes apply immediately while the gateway is running, or on its next start.',
        realmSwitched: 'Realm saved. Check the active gateway realm and model catalog.',
        activeRealm: 'Active gateway realm',
        modelsRealm: 'Model catalog realm',
        realmUnknown: 'Not confirmed',
        realmStopped: 'Gateway not running',
        realmManual: 'Automatic maintenance is off; sync the model route to update the DSH model picker.',
        expires: (text) => `expires in ${text}`,
        disabled: 'disabled',
        scan: 'Scan desktop accounts',
        refreshCredits: 'Refresh credits',
        claimCredits: 'Claim credits',
        checkin: 'Check in',
        checkedIn: (time) => `Checked in${time ? ` · ${time}` : ''}`,
        notCheckedIn: 'Not checked in',
        enableAll: 'Enable all',
        disableAll: 'Disable all',
        enable: 'Enable',
        disable: 'Disable',
        creditBalance: (value) => `${value} credits`,
        taskClaimed: 'Credit tasks ran; refresh credits to see the result.',
        scanNote: 'Reads credentials the local WorkBuddy desktop app already has, and does not modify them.',
        import: 'Import',
        imported: (name) => `Imported ${name}`,
        remove: 'Remove',
        confirmRemove: 'Confirm remove',
        cancel: 'Cancel',
        login: 'Sign in via browser',
        loginStarted: 'The authorization page was opened in your browser; the account appears here once you finish.',
        loginWait: 'Waiting for authorization…',
        loginDone: 'Authorized',
        loginFailed: (message) => `Authorization failed: ${message}`,
        openLink: 'Open authorization link',
        models: 'Models',
        modelsNote: (count) => `The gateway serves ${count} model(s).`,
        modelContext: 'Context',
        modelOutput: 'Max output',
        modelReasoning: 'Reasoning',
        modelVision: 'Images',
        provider: 'Provider route',
        providerPresent: 'Written to settings.yaml',
        providerAbsent: 'Not written',
        providerNote: 'Registers the gateway\'s models as a DSH provider so they appear in the model picker. It only adds or removes this plugin\'s own route and never touches other providers.',
        providerSync: 'Write provider route',
        providerRemove: 'Remove provider route',
        providerWaiting: 'Start the gateway first so its model list can be read.',
        providerSynced: (count) => `Wrote ${count} model(s).`,
        providerRemoved: 'Provider route removed.',
        log: 'Gateway log',
        logEmpty: 'No output yet.',
        readErrors: 'Some reads failed',
        busy: 'Working…',
        failed: (message) => `Failed: ${message}`,
        hostHint: 'Host-half changes need a dsh restart; this page only needs a refresh.',
        autostart: 'Start with dsh',
        autoSync: 'Keep the provider route in sync',
        save: 'Save',
        saved: 'Saved.',
      },
    }

    /** The copy object for one language tag. */
    const COPY_BY_LANGUAGE = { zh: COPY.zh, en: COPY.en }

    /** Language tag this page is reading, resolved once so its copy is stable. */
    const LANGUAGE = (() => {
      const tag = typeof navigator !== 'undefined' && typeof navigator.language === 'string'
        ? navigator.language.toLowerCase()
        : 'en'
      return tag.startsWith('zh') ? 'zh' : 'en'
    })()

    /**
     * The current language's copy.
     *
     * Returns one of two module-level constants, so the object identity is
     * stable across renders and safe to use in a React dependency array — a
     * fresh object each render would restart the polling effect every time.
     */
    function copy() {
      return COPY_BY_LANGUAGE[LANGUAGE]
    }

    /** `12s` / `3m04s` / `2h11m` / `4d03h`. */
    function humanDuration(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
      const seconds = Math.round(ms / 1000)
      if (seconds < 60) return `${seconds}s`
      const minutes = Math.floor(seconds / 60)
      if (minutes < 60) return `${minutes}m${String(seconds % 60).padStart(2, '0')}s`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, '0')}m`
      return `${Math.floor(hours / 24)}d${String(hours % 24).padStart(2, '0')}h`
    }

    /** `1234` → `1.2k`, `1000000` → `1.0M`. */
    function humanCount(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value < 1000) return String(value)
      if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`
      return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    }

    /** Tone tokens per state, resolved against the theme's semantic aliases. */
    const TONE = {
      running: {
        fg: 'var(--dsw-alias-state-success-primary, #067647)',
        bg: 'var(--dsw-alias-state-success-bg, rgba(6,118,71,0.10))',
      },
      starting: {
        fg: 'var(--dsw-alias-state-warn-primary, #b54708)',
        bg: 'var(--dsw-alias-state-warn-bg, rgba(181,71,8,0.10))',
      },
      failed: {
        fg: 'var(--dsw-alias-state-error-primary, #d92d20)',
        bg: 'var(--dsw-alias-state-error-bg, rgba(217,45,32,0.10))',
      },
      stopped: {
        fg: 'var(--dsw-alias-label-tertiary, #667085)',
        bg: 'var(--dsw-alias-bg-layer-2, rgba(102,112,133,0.10))',
      },
    }

    const style = {
      wrap: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '2px 0 24px', color: 'var(--dsw-alias-label-primary, #111)' },
      intro: { margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary, #667085)' },
      bar: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      barActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' },
      badge: (tone) => ({
        fontSize: '11px', lineHeight: '16px', padding: '1px 7px', borderRadius: '999px',
        fontWeight: 600, whiteSpace: 'nowrap', color: tone.fg, background: tone.bg,
        border: `1px solid ${tone.fg}`,
      }),
      stateText: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary, #344054)' },
      button: {
        appearance: 'none', font: 'inherit', fontSize: '13px', lineHeight: '20px', padding: '5px 12px',
        borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        color: 'var(--dsw-alias-label-primary, #111)',
      },
      buttonPrimary: {
        appearance: 'none', font: 'inherit', fontSize: '13px', lineHeight: '20px', padding: '5px 12px',
        borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-state-business-primary, #4176e6)',
        background: 'var(--dsw-alias-state-business-bg, rgba(65,118,230,0.10))',
        color: 'var(--dsw-alias-state-business-primary, #4176e6)',
      },
      buttonDanger: {
        appearance: 'none', font: 'inherit', fontSize: '13px', lineHeight: '20px', padding: '5px 12px',
        borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-state-error-primary, #d92d20)',
        background: 'var(--dsw-alias-state-error-bg, rgba(217,45,32,0.10))',
        color: 'var(--dsw-alias-state-error-primary, #d92d20)',
      },
      buttonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
      card: {
        display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 14px',
        border: '1px solid var(--dsw-alias-border-l2, #eaecf0)', borderRadius: '10px',
        background: 'var(--dsw-alias-bg-layer-1, #fff)', minWidth: 0,
      },
      cardTitle: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--dsw-alias-label-tertiary, #667085)' },
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px 16px' },
      field: { display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 },
      fieldLabel: { fontSize: '11px', lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary, #667085)' },
      fieldValue: { fontSize: '13px', lineHeight: '20px', overflowWrap: 'anywhere' },
      rowTop: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
      input: {
        font: 'inherit', fontSize: '13px', lineHeight: '20px', padding: '4px 8px', width: '110px',
        borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
        background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit',
      },
      select: {
        font: 'inherit', fontSize: '13px', lineHeight: '20px', padding: '4px 8px',
        borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
        background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', maxWidth: '100%',
      },
      checkboxRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--dsw-alias-label-secondary, #344054)' },
      note: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary, #667085)' },
      notice: { fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-state-error-primary, #d92d20)' },
      success: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-success-primary, #067647)' },
      warn: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-state-warn-primary, #b54708)' },
      accountRow: {
        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', flexWrap: 'wrap',
        border: '1px solid var(--dsw-alias-border-l2, #eaecf0)', borderRadius: '10px',
      },
      accountMain: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 },
      accountName: { fontSize: '13px', fontWeight: 500, overflowWrap: 'anywhere' },
      mono: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '11px', lineHeight: '16px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      },
      log: {
        maxHeight: '240px', overflowY: 'auto', padding: '8px 10px', margin: 0,
        border: '1px solid var(--dsw-alias-border-l1, #f2f4f7)', borderRadius: '8px',
        background: 'var(--dsw-alias-bg-layer-2, #f9fafb)',
      },
      logLine: { display: 'flex', gap: '8px' },
      logTime: { color: 'var(--dsw-alias-label-tertiary, #667085)', flexShrink: 0 },
      logError: { color: 'var(--dsw-alias-state-error-primary, #d92d20)' },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
      th: {
        textAlign: 'left', padding: '4px 8px 4px 0', fontWeight: 600,
        color: 'var(--dsw-alias-label-tertiary, #667085)',
        borderBottom: '1px solid var(--dsw-alias-border-l1, #f2f4f7)',
      },
      td: { padding: '4px 8px 4px 0', borderBottom: '1px solid var(--dsw-alias-border-l1, #f2f4f7)', verticalAlign: 'top' },
      spinner: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, #667085)' },
    }

    /** Unwrap the bridge's `{ ok, data }` envelope. */
    async function getJson(path, signal) {
      const response = await fetch(`${BASE}${path}`, { signal })
      const payload = await response.json().catch(() => null)
      if (payload === null || payload.ok !== true) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`)
      }
      return payload.data
    }

    /** POST one JSON body and unwrap the envelope. */
    async function postJson(path, body) {
      const response = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const payload = await response.json().catch(() => null)
      if (payload === null || payload.ok !== true) {
        throw new Error(payload?.error?.message ?? `HTTP ${response.status}`)
      }
      const result = payload.data?.result
      if (result?.ok === false) throw new Error(result.error ?? result.msg ?? 'Gateway operation failed')
      const failures = result?.results?.filter((entry) => entry.ok === false) ?? []
      if (failures.length > 0) {
        throw new Error(failures.map((entry) => `${entry.uid}: ${entry.error ?? entry.msg ?? 'Failed'}`).join('; '))
      }
      return payload.data
    }

    /** One status badge. */
    function StateBadge({ state, t }) {
      const tone = TONE[state] ?? TONE.stopped
      return h('span', { style: style.badge(tone), title: t.stateHint[state] ?? '' }, t.state[state] ?? state)
    }

    /** A labelled value. */
    function Field({ label, value, title }) {
      return h('div', { style: style.field },
        h('span', { style: style.fieldLabel }, label),
        h('span', { style: style.fieldValue, title: title ?? String(value ?? '') }, String(value ?? '—')))
    }

    /**
     * The whole settings section.
     *
     * One polling loop owns the page's data; it reads through a ref for the
     * OAuth state so a login in progress never restarts it.
     */
    function Section() {
      const t = copy()
      const [state, setState] = React.useState({ phase: 'loading', data: null, error: null })
      const [busy, setBusy] = React.useState(null)
      const [message, setMessage] = React.useState(null)
      const [portDraft, setPortDraft] = React.useState(null)
      const [scan, setScan] = React.useState(null)
      const [login, setLogin] = React.useState(null)
      const [confirmUid, setConfirmUid] = React.useState(null)
      const [generation, setGeneration] = React.useState(0)
      const dataRef = React.useRef(null)
      const aliveRef = React.useRef(true)
      // Reads started before or during a mutation cannot publish stale settings.
      const mutationRef = React.useRef({ version: 0, pending: false })

      React.useEffect(() => {
        aliveRef.current = true
        return () => { aliveRef.current = false }
      }, [])

      // One polling loop. It backs off when the gateway is idle or the tab is
      // hidden, and it keeps polling through an OAuth wait so the new account
      // appears without the operator refreshing the page.
      //
      // `login` is a dependency on purpose: starting a login has to wake the
      // loop, and a ref would not. `setGeneration` is a stable setter, so this
      // only restarts when the pending login actually changes.
      React.useEffect(() => {
        let cancelled = false
        let timer = null
        const tick = async () => {
          if (cancelled) return
          const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
          if (!hidden && !mutationRef.current.pending) {
            const version = mutationRef.current.version
            try {
              const data = await getJson('/state')
              if (!cancelled && version === mutationRef.current.version) {
                dataRef.current = data
                setState({ phase: 'ready', data, error: null })
              }
            } catch (error) {
              if (!cancelled && version === mutationRef.current.version) {
                setState((current) => ({
                  phase: 'error',
                  data: current.data,
                  error: error instanceof Error ? error.message : String(error),
                }))
              }
            }

            // Poll the pending OAuth flow, if any. The gateway answers
            // `{status: "pending"|"ok"|"error"|"expired"|"unknown", ...}`.
            if (login !== null && login.state !== undefined) {
              try {
                const result = await getJson(`/accounts/login/poll?state=${encodeURIComponent(login.state)}`)
                const poll = result.poll ?? {}
                if (!cancelled && poll.status === 'ok') {
                  setLogin(null)
                  setMessage({ kind: 'ok', text: t.loginDone })
                  setGeneration((value) => value + 1)
                } else if (!cancelled && (poll.status === 'error' || poll.status === 'expired' || poll.status === 'unknown')) {
                  setLogin(null)
                  setMessage({ kind: 'error', text: t.loginFailed(String(poll.message ?? poll.status)) })
                }
              } catch {
                /* a failed poll is not fatal; the next tick retries */
              }
            }
          }
          if (cancelled) return
          const latest = dataRef.current
          const active = latest?.gateway?.state === 'running' || latest?.gateway?.state === 'starting'
            || login !== null
          const delay = hidden ? 8000 : active ? POLL_ACTIVE_MS : POLL_IDLE_MS
          timer = setTimeout(() => { void tick() }, delay)
        }
        void tick()
        return () => {
          cancelled = true
          if (timer !== null) clearTimeout(timer)
        }
      }, [generation, login, t])

      const refresh = React.useCallback(() => setGeneration((value) => value + 1), [])

      /** Apply confirmed settings and model data before the next background poll. */
      const applyConfigResult = React.useCallback((result) => {
        if (!aliveRef.current || result?.settings === undefined) return
        setState((current) => {
          if (current.data === null) return current
          return {
            ...current,
            data: {
              ...current.data,
              ...result,
              settings: { ...current.data.settings, ...result.settings },
              gateway: result.gateway ?? current.data.gateway,
            },
          }
        })
        dataRef.current = dataRef.current === null ? null : {
          ...dataRef.current,
          ...result,
          settings: { ...dataRef.current.settings, ...result.settings },
        }
      }, [])

      /** Run one mutating action with busy state and error reporting. */
      const run = React.useCallback(async (label, action, successText) => {
        if (mutationRef.current.pending) return null
        mutationRef.current.pending = true
        mutationRef.current.version += 1
        setBusy(label)
        setMessage(null)
        try {
          const result = await action()
          if (aliveRef.current) {
            if (successText !== undefined) setMessage({ kind: 'ok', text: successText })
            refresh()
          }
          return result
        } catch (error) {
          if (aliveRef.current) {
            setMessage({ kind: 'error', text: t.failed(error instanceof Error ? error.message : String(error)) })
            refresh()
          }
          return null
        } finally {
          mutationRef.current.pending = false
          mutationRef.current.version += 1
          if (aliveRef.current) setBusy(null)
        }
      }, [refresh, t])

      const data = state.data

      if (state.phase === 'loading' && data === null) {
        return h('div', { style: style.wrap }, h('p', { style: style.note }, t.busy))
      }

      if (data === null) {
        return h('div', { style: style.wrap },
          h('p', { style: style.notice }, t.failed(state.error ?? '')),
          h('p', { style: style.note }, t.hostHint),
          h('div', { style: style.bar }, h('button', { style: style.button, onClick: refresh }, t.refresh)))
      }

      const gateway = data.gateway ?? {}
      const settings = data.settings ?? {}
      const account = data.account ?? { accounts: [], usable: 0 }
      const provider = data.provider ?? {}
      const models = Array.isArray(data.models) ? data.models : []
      const realmLabel = (realm) => realm === 'cn' ? t.realmCn : realm === 'intl' ? t.realmIntl : t.realmUnknown
      const running = gateway.state === 'running'
      const accounts = Array.isArray(account.accounts) ? account.accounts : []
      const tone = TONE[gateway.state] ?? TONE.stopped

      /** One lifecycle button, disabled while another action is in flight. */
      const action = (label, onClick, variant) => h('button', {
        style: {
          ...(variant === 'primary' ? style.buttonPrimary : variant === 'danger' ? style.buttonDanger : style.button),
          ...(busy !== null ? style.buttonDisabled : {}),
        },
        disabled: busy !== null,
        onClick,
      }, label)

      const body = [
        h('p', { key: 'intro', style: style.intro }, t.intro),

        // Status bar: state, endpoint, and the lifecycle controls.
        h('div', { key: 'bar', style: style.bar },
          h(StateBadge, { state: gateway.state, t }),
          h('span', { style: style.stateText },
            busy !== null ? t.busy : (running ? gateway.baseUrl ?? '' : t.stateHint[gateway.state] ?? '')),
          h('div', { style: style.barActions },
            running
              ? action(t.restart, () => void run('restart', () => postJson('/gateway/restart')), undefined)
              : action(t.start, () => void run('start', () => postJson('/gateway/start')), 'primary'),
            running ? action(t.stop, () => void run('stop', () => postJson('/gateway/stop')), undefined) : null,
            action(t.refresh, refresh, undefined))),

        message !== null
          ? h('p', { key: 'message', style: message.kind === 'error' ? style.notice : style.success }, message.text)
          : null,

        gateway.lastError !== null && gateway.lastError !== undefined
          ? h('p', { key: 'lastError', style: style.warn }, gateway.lastError)
          : null,

        data.reads !== undefined && (data.reads.accounts != null || data.reads.models != null || data.reads.realm != null)
          ? h('p', { key: 'readErrors', style: style.warn },
              `${t.readErrors}: ${[data.reads.accounts, data.reads.models, data.reads.realm].filter(Boolean).join(' / ')}`)
          : null,

        // Gateway facts.
        h('div', { key: 'gatewayCard', style: style.card },
          h('div', { style: style.cardTitle }, t.gateway),
          h('div', { style: style.grid },
            h(Field, { key: 'endpoint', label: t.endpoint, value: gateway.baseUrl ?? '—' }),
            h(Field, { key: 'pid', label: t.pid, value: gateway.pid ?? '—' }),
            h(Field, { key: 'uptime', label: t.uptime, value: gateway.uptimeMs === null ? '—' : humanDuration(gateway.uptimeMs) }),
            // The interpreter is shown because it is resolved, not configured: on
            // a platform whose Python is named differently the probe picks one,
            // and this reading is how an operator learns which.
            h(Field, { key: 'python', label: t.pythonPath, value: gateway.pythonPath }),
            h(Field, { key: 'platform', label: t.platform, value: gateway.platform }),
            h(Field, { key: 'script', label: t.script, value: gateway.script }),
            h(Field, { key: 'accountsStore', label: t.accountStore, value: gateway.accountStore }),
            h(Field, { key: 'usageStore', label: t.usageStore, value: gateway.usageStore })),
          h('div', { style: style.rowTop },
            h('span', { style: style.fieldLabel }, t.port),
            h('input', {
              style: style.input,
              value: portDraft ?? String(settings.port),
              inputMode: 'numeric',
              onChange: (event) => setPortDraft(event.target.value),
            }),
            action(t.applyPort, () => void run('config', async () => {
              const result = await postJson('/config', { port: Number(portDraft ?? settings.port) })
              applyConfigResult(result)
              setPortDraft(null)
            }, t.saved)),
            h('label', { style: style.checkboxRow },
              h('input', {
                type: 'checkbox',
                checked: settings.autoStart === true,
                disabled: busy !== null,
                onChange: (event) => void run('config', async () => {
                  const result = await postJson('/config', { autoStart: event.target.checked })
                  applyConfigResult(result)
                }),
              }),
              t.autostart),
            h('label', { style: style.checkboxRow },
              h('input', {
                type: 'checkbox',
                checked: settings.providerSync === true,
                disabled: busy !== null,
                onChange: (event) => void run('config', async () => {
                  const result = await postJson('/config', { providerSync: event.target.checked })
                  applyConfigResult(result)
                }),
              }),
              t.autoSync)),
          h('p', { style: style.note }, t.portNote)),

        // Credential.
        h('div', { key: 'keyCard', style: style.card },
          h('div', { style: style.rowTop },
            h('span', { style: style.cardTitle }, t.key),
            h('span', { style: style.fieldValue }, settings.keyConfigured === true ? t.keySet : t.keyUnset),
            h('span', { style: { flex: 1 } }),
            action(t.generateKey, () => void run('key', async () => {
              const result = await postJson('/key', { action: 'generate' })
              if (result?.value !== undefined) setMessage({ kind: 'ok', text: t.keyOnce(result.value) })
            }), undefined),
            action(t.clearKey, () => void run('key', () => postJson('/key', { action: 'clear' }), t.saved), undefined)),
          h('p', { style: style.note }, t.keyNote)),

        // Accounts.
        h('div', { key: 'accountsCard', style: style.card },
          h('div', { style: style.rowTop },
            h('span', { style: style.cardTitle }, t.accounts),
            h('span', { style: style.fieldValue }, t.accountUsable(account.usable ?? 0, accounts.length)),
            h('span', { style: { flex: 1 } }),
            action(t.scan, () => void run('scan', async () => {
              const result = await postJson('/accounts/scan')
              setScan(result.scan ?? null)
            }), undefined),
            action(t.login, () => void run('login', async () => {
              const result = await postJson('/accounts/login/start', { realm: settings.realm === 'cn' ? 'cn' : 'intl' })
              const started = result.login ?? {}
              setLogin(started)
              // The gateway names the authorization URL `authUrl`.
              if (typeof started.authUrl === 'string') window.open(started.authUrl, '_blank', 'noopener')
              setMessage({ kind: 'ok', text: t.loginStarted })
            }), undefined)),
          h('div', { style: style.rowTop },
            action(t.refreshCredits, () => void run('credits', () => postJson('/accounts/credits'), undefined), undefined),
            settings.realm === 'cn'
              ? action(t.claimCredits, () => void run('tasks', () => postJson('/tasks/run'), t.taskClaimed), undefined)
              : null,
            settings.realm === 'cn'
              ? action(t.checkin, () => void run('checkin', () => postJson('/accounts/checkin'), t.saved), undefined)
              : null,
            action(t.enableAll, () => void run('enable-all', () => postJson('/accounts/set-all', { enabled: true }), t.saved), undefined),
            action(t.disableAll, () => void run('disable-all', () => postJson('/accounts/set-all', { enabled: false }), t.saved), undefined)),

          // The realm selector lives here, not in the gateway card, because this
          // is the list it filters: a second account in the other realm is
          // invisible until this changes.
          h('div', { style: style.rowTop },
            h('span', { style: style.fieldLabel }, t.realm),
            h('select', {
              style: style.select,
              value: settings.realm ?? '',
              disabled: busy !== null,
              onChange: (event) => void run('realm', async () => {
                const value = event.target.value === '' ? null : event.target.value
                const result = await postJson('/config', { realm: value })
                applyConfigResult(result)
              }, t.realmSwitched),
            },
              h('option', { value: '' }, t.realmDefault),
              h('option', { value: 'intl' }, t.realmIntl),
              h('option', { value: 'cn' }, t.realmCn))),
          h('p', { style: style.note }, `${t.activeRealm}: ${running ? realmLabel(data.activeRealm) : t.realmStopped}`),
          h('p', { style: style.note }, t.realmNote),
          settings.providerSync === false ? h('p', { style: style.note }, t.realmManual) : null,

          login !== null
            ? h('p', { style: style.spinner }, t.loginWait)
            : null,

          accounts.length === 0
            ? h('p', { style: style.note }, t.noAccounts)
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, accounts.map((entry) => h('div', {
                key: entry.uid,
                style: style.accountRow,
              },
                h('div', { style: style.accountMain },
                  h('span', { style: style.accountName }, entry.nickname ?? entry.uid),
                  h('span', { style: style.note },
                    [entry.realmName ?? entry.realm, entry.expiresIn === undefined ? null : t.expires(entry.expiresIn), entry.enabled === false ? t.disabled : null,
                      entry.credits?.remain === undefined ? null : t.creditBalance(entry.credits.remain),
                      entry.realm === 'cn' ? (entry.checkinClaimed === true || (entry.checkinClaimed === undefined && entry.lastCheckin)
                        ? t.checkedIn(entry.lastCheckin) : t.notCheckedIn) : null]
                      .filter(Boolean).join(' · '))),
                h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                  action(t.refreshCredits, () => void run(`credits-${entry.uid}`, () => postJson('/accounts/credits', { uid: entry.uid }), undefined), undefined),
                  entry.realm === 'cn'
                    ? action(t.checkin, () => void run(`checkin-${entry.uid}`, () => postJson('/accounts/checkin', { uid: entry.uid }), t.saved), undefined)
                    : null,
                  action(entry.enabled === false ? t.enable : t.disable,
                    () => void run(`set-${entry.uid}`, () => postJson('/accounts/set', { uid: entry.uid, enabled: entry.enabled === false }), t.saved), undefined)),
                confirmUid === entry.uid
                  ? h('div', { style: { display: 'flex', gap: '6px' } },
                      h('button', {
                        style: style.buttonDanger,
                        disabled: busy !== null,
                        onClick: () => void run('delete', async () => {
                          await postJson('/accounts/delete', { uid: entry.uid })
                          setConfirmUid(null)
                        }, t.saved),
                      }, t.confirmRemove),
                      h('button', { style: style.button, onClick: () => setConfirmUid(null) }, t.cancel))
                  : h('button', { style: style.button, disabled: busy !== null, onClick: () => setConfirmUid(entry.uid) }, t.remove)))),

          h('p', { style: style.note }, t.accountScopeNote),
          h('p', { style: style.note }, t.scanNote),

          scan !== null && Array.isArray(scan.detected) && scan.detected.length > 0
            ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, scan.detected.map((found) => h('div', {
                key: found.path,
                style: style.accountRow,
              },
                h('div', { style: style.accountMain },
                  h('span', { style: style.accountName }, found.nickname ?? found.file),
                  h('span', { style: style.note },
                    [found.realmName, found.expiresIn === undefined ? null : t.expires(found.expiresIn), found.valid === false ? found.error : null]
                      .filter(Boolean).join(' · '))),
                h('button', {
                  style: style.buttonPrimary,
                  disabled: busy !== null || found.valid === false,
                  onClick: () => void run('import', async () => {
                    await postJson('/accounts/import', { path: found.path, realm: found.realm })
                    setScan(null)
                  }, t.imported(found.nickname ?? found.file)),
                }, t.import))))
            : null),

        // Provider route.
        h('div', { key: 'providerCard', style: style.card },
          h('div', { style: style.rowTop },
            h('span', { style: style.cardTitle }, t.provider),
            h('span', { style: style.fieldValue }, provider.present === true
              ? `${t.providerPresent} · ${String(provider.modelCount ?? 0)}`
              : t.providerAbsent),
            h('span', { style: { flex: 1 } }),
            provider.present === true
              ? action(t.providerRemove, () => void run('provider', async () => {
                  await postJson('/provider/sync', { action: 'remove' })
                }, t.providerRemoved), undefined)
              : action(t.providerSync, () => void run('provider', async () => {
                  const result = await postJson('/provider/sync', {})
                  const count = result.entry?.models?.length ?? 0
                  setMessage({ kind: 'ok', text: t.providerSynced(count) })
                }, undefined), 'primary')),
          h('p', { style: style.note }, provider.present === true ? t.providerNote : t.providerNote + ' ' + (running ? '' : t.providerWaiting)),
          Array.isArray(provider.routes) && provider.routes.length > 0
            ? h('p', { style: style.mono }, provider.routes.join(', '))
            : null,
          provider.reason !== null && provider.reason !== undefined
            ? h('p', { style: style.warn }, provider.reason)
            : null),

        // Models.
        models.length > 0
          ? h('div', { key: 'modelsCard', style: style.card },
              h('div', { style: style.cardTitle }, t.models),
              h('p', { style: style.note }, `${t.modelsRealm}: ${realmLabel(data.modelsRealm)} · ${t.modelsNote(models.length)}`),
              h('table', { style: style.table },
                h('thead', null, h('tr', null,
                  h('th', { style: style.th }, 'ID'),
                  h('th', { style: style.th }, t.modelContext),
                  h('th', { style: style.th }, t.modelOutput),
                  h('th', { style: style.th }, t.modelReasoning),
                  h('th', { style: style.th }, t.modelVision))),
                h('tbody', null, models.map((model) => h('tr', { key: model.id },
                  h('td', { style: style.td }, model.id),
                  h('td', { style: style.td }, humanCount(model.context_length ?? model.max_input_tokens)),
                  h('td', { style: style.td }, humanCount(model.max_output_tokens ?? model.max_completion_tokens)),
                  h('td', { style: style.td }, model.reasoning_fixed_effort !== undefined
                    ? `${model.reasoning_fixed_effort} (fixed)`
                    : Array.isArray(model.reasoning_efforts) ? model.reasoning_efforts.join(', ') : '—'),
                  h('td', { style: style.td }, (model.input_modalities ?? model.modalities?.input ?? []).includes('image') ? '✓' : '—'))))))
            : null,

        // Log.
        h('div', { key: 'logCard', style: style.card },
          h('div', { style: style.cardTitle }, t.log),
          Array.isArray(gateway.log) && gateway.log.length > 0
            ? h('div', { style: style.log }, h('div', { style: style.mono }, gateway.log.slice(-120).map((entry) => h('div', {
                key: entry.seq,
                style: style.logLine,
              },
                h('span', { style: style.logTime }, new Date(entry.at).toLocaleTimeString()),
                h('span', { style: entry.level === 'error' ? style.logError : undefined }, entry.text)))))
            : h('p', { style: style.note }, t.logEmpty)),

        h('p', { key: 'hostHint', style: style.note }, t.hostHint),
      ]

      return h('div', { style: style.wrap }, body)
    }

    /**
     * Register the page as a settings section.
     *
     * The settings shell exposes `settings.section`; registering into it is what
     * puts this page next to 模型 and 外观. The registration is held by
     * `slots.inject` so the section appears whenever the shell is present and
     * disappears with the plugin.
     *
     * @param {object} ctx - client context carrying the slot registry.
     */
    function apply(ctx) {
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'workbuddy-gateway',
        order: 40,
        label: () => copy().nav,
      }, Section))
    }

    module.exports.name = 'dsh-plugin-workbuddy-gateway'
    module.exports.inject = ['slots']
    module.exports.apply = apply
    return module.exports
  },
})
