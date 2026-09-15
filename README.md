# dsh-plugin-workbuddy-gateway

把 WorkBuddy（[www.workbuddy.ai](https://www.workbuddy.ai) 国际版 / codebuddy.cn 国内版）的**订阅额度**
接进 DSH，并且在**设置页**里管理它。

中文 | [English](README.en.md)

---

## 先读这一段：前置条件与适用范围

**这不是官方集成。** 它依赖的网关走的是 WorkBuddy 订阅端的内部接口，不是官方 API。
使用前请自行确认这符合你所在地区的条款与法律。作者与 WorkBuddy / 腾讯无任何关系。

| 需要 | 说明 |
|---|---|
| **DSH** 带 `web` profile | 本插件针对 `@deepseek-ai/dsh-*` `0.1.5-rc.2` 开发与验证 |
| **Node** ≥ 20.19 | 宿主半只用 Node 内置模块 |
| **Python** ≥ 3.9 | 网关是 Python，仅用标准库（本机在 3.13 上实测） |
| **WorkBuddy 账号** | 国际版或国内版订阅；浏览器 OAuth 授权，或从桌面端已存的凭证导入 |
| 平台 | 主要在 Windows 上验证。路径与进程管理是跨平台的，但未在 macOS / Linux 上实测 |

**它依赖 DSH 的非公开内部接口**：`settings.installSection`、`settings.mutate`、
`webServer.register`、`credentials.*`、客户端 `settings.section` 槽位。
DSH 改动这些会让插件失效 —— 见 [`CONTRIBUTING.md`](CONTRIBUTING.md#harness-coupling)。

---

## 它解决什么

WorkBuddy 不提供官方 OpenAI 兼容 API：额度绑在订阅账号上，只能通过 OAuth 凭证访问内部接口。
所以要用它，本机必须常驻一个**反代网关**把订阅协议翻译成 OpenAI 协议。

在这之前，那意味着一个需要手动双击、手动记住端口、出问题只能翻黑窗口日志的 `.bat` 文件。
这个插件把那套东西变成 DSH 的一部分：网关进程由插件托管，账号、模型、日志和模型路由都在设置页里。

**它做什么**

- 托管网关进程：启动、就绪检测、日志环形缓冲、退出、随 DSH 关闭而关闭
- 管理账号：扫描本机桌面端凭证并导入、浏览器 OAuth 授权、移除
- 维护 `llm-pi-ai` 模型路由：把网关实际提供的模型写进 DSH，模型选择器里就能选
- 端口、Python 解释器、网关目录、随 DSH 启动、自动维护路由 —— 都在设置页里改

**它不做什么**

- 不修改 DSH 核心，不碰你其他的模型提供方
- 不提供任何账号或额度

## 界面

**设置 → WorkBuddy**：

| 区块 | 内容 |
|---|---|
| 状态栏 | 运行状态、接口地址、启动 / 停止 / 重启 / 刷新 |
| 网关 | 接口地址、PID、已运行时长、启动脚本、账号目录、用量目录；端口、随 DSH 启动、自动维护路由 |
| 接口密钥 | 生成 / 清除，存在 DSH 凭据库里（`WORKBUDDY_API_KEY`），不进 `settings.yaml` |
| 账号 | 当前区域可用数、**区域切换（国际版 / 国内版）**、扫描桌面端凭证、导入、移除、浏览器授权登录（轮询直到授权完成） |
| 模型路由 | 是否已写入、当前所有路由、写入 / 移除 |
| 模型 | 网关提供的模型清单：上下文、最大输出、推理档位、是否支持图片 |
| 网关日志 | 最近 120 行，错误行标红 |

## 安装

**bundle 装法（推荐）** —— 包名进 `dsh.profile.bundles`，**需要重启 dsh 才生效**：

```jsonc
// $DSH_HOME/profiles/web/package.json
"dependencies": {
  "dsh-plugin-workbuddy-gateway": "link:C:/Users/lz/OneDrive/Desktop/dsh-test/dsh-plugin-workbuddy-gateway"
},
"dsh": { "profile": { "bundles": [ /* … */ "dsh-plugin-workbuddy-gateway" ] } }
```

```powershell
pnpm --dir $env:USERPROFILE\.dsh\profiles\web install
```

⚠️ **不要**再在 `cordis.patch.yml` 里写一条 `insert`：bundle 层已经插过一次，同 id 插两次会让 dsh
起不来（`duplicate loader entry id: workbuddy-gateway`）。装法二选一。

## 运行时状态放在哪

网关是第三方 Python 程序，它的可变状态**不写在插件目录里**（插件是 `link:` 安装的，等于直接指向源码）：

| 内容 | 位置 | 怎么定的 |
|---|---|---|
| 账号凭证 | `$DSH_HOME/workbuddy/accounts/` | `ACCOUNTS_DIR` 环境变量 |
| 用量记录 | `$DSH_HOME/workbuddy/usage/` | `WB_PROXY_USAGE_DIR` 环境变量 |
| 网关代码 | 插件内 `vendor/workbuddy-gateway/` | 内置，自包含 |

## 设计上的几个要点

**为什么端口默认 18088 而不是上游的 8788**
本机 Windows 把 TCP 8703–9302 保留给了 Hyper-V/WSL 动态端口，绑在这个区间里直接
`WinError 10013`。18088 在所有保留区间之外。

**为什么就绪靠读日志而不是等固定秒数**
网关在开始服务时才会打印 `listening : http://…`。固定 sleep 会在慢启动时报"运行中"、
在快启动时白等；只有那一行是诚实的信号。

**为什么写模型路由用 `settings.mutate` 而不是改 `settings.yaml`**
`llm-pi-ai.providers` 是 pi-ai 适配器的命名空间。整段写入会**替换整个 `providers` 映射** ——
也就是删掉用户其他的提供方。改用路径级 `mutate`（`providers.<id>` 一个 key），
既只动自己那一条，又走 DSH 自己的写入器和文件锁。
**副产品：这个插件完全不解析 YAML。**

**为什么插件自带一个"晚退出"保护**
重启会杀掉旧进程再起新进程，而旧进程的 `exit` 事件可能在新进程装好**之后**才到达。
如果退出处理无条件清空记账，就会把活着的子进程 PID 抹掉。所以退出处理绑定子进程身份。

**为什么要等凭证服务**
插件挂载的时刻，`ctx.get('credentials')` 可能还是空的 —— 凭证服务比插件晚激活。
最初的实现把它当成"没有密钥"，于是网关**不带鉴权**就启动了（本机任意程序都能白用你的额度）。
现在有两道防护：有界等待（最多 10 秒），以及等不到时**拒绝启动**并在日志里说明原因。
不启动比偷偷裸奔好。

**为什么 `running` 必须是 Gateway 上的真 getter**
它一度只作为快照对象的一个字段存在，于是 `gateway.running` 是 `undefined`，
而 HTTP 读取路径正是用它决定"能不能调网关" —— 结果**账号和模型永远读回空**，
但状态徽章却显示"运行中"。测试当时只断言了 `snapshot().running`，所以没抓到。
现在有一条测试直接断言这个 getter 在四种状态下都返回布尔值。

**为什么失败也要写进日志**
"没启动"可以是三种完全不同的原因（自动启动关了、等不到凭证、启动失败），
只写进 dsh 控制台的话，设置页只会看到一个安静的红点。插件的日志环形缓冲因此也记录
这些决策，页面上直接能看到是哪一种。

**为什么账号和模型都是分区域的，以及"可用数"为什么必须自己算**
网关把账号池按区域隔离：`/accounts` 的**列表按 realm 过滤**，但它回的 `usable` 字段是
`count_ready()` —— **跨所有区域**计数。直接把两个数摆在页面上就会出现
"可用 2 / 共 1" 这种自相矛盾的读数（本机两个区各一个账号时正好这样）。
现在两个数字都从同一个列表推导，且请求显式带上区域。这也是区域切换放在**账号卡片**里的
原因：它是这个列表的过滤条件，另一个区的账号在切换前是不可见的。

**为什么有些模型没有推理档位菜单**
模型选择器的菜单显示的是模型**声明**的档位，而网关对每个模型的声明并不一样：

| 网关给的信息 | 含义 | 插件写进路由 |
|---|---|---|
| `reasoning_efforts: [low, high, …]`（≥2 个） | 调用方可以选 | 声明这些档位 → **有菜单** |
| `reasoning_efforts: [high]`（只有 1 个） | 只有一个档位，选了也没得选 | 不声明 → 无菜单 |
| `reasoning_fixed_effort: medium` | 档位写死，不允许调用方选 | 不声明 → 无菜单 |
| 两个字段都没有 | 网关没暴露思考控制 | 不声明 → 无菜单 |

所以「不能切换推理程度」有三种完全不同的原因，而**默认模型 `deepseek-v4.1-flash`
属于第二种**：网关给它的是 `reasoning_fixed_effort: high` + `always_reasoning: true`，
它一直在以 high 推理，只是不允许你改。想要能切的档位就用 `gpt-6-astra`、
`gpt-5.6-*`、`glm-5.3` 这些。

单档位那一类（`hy4-preview`、`hy4-preview-f`）插件刻意**不声明**档位：菜单会严格只列出
声明的档位，写一个只有一个选项的档位等于给用户一个点了也没用的控件。

自测：`node scripts/reasoning-report.mjs`（对着运行中的网关打印每个模型的实际结论）。

## 测试

```powershell
cd C:\Users\lz\OneDrive\Desktop\dsh-test\dsh-plugin-workbuddy-gateway
npm test          # 46 个离线测试：状态机、设置规范化、路由、提供方路由
npm run preflight # 验证 Node 能 spawn Python 并流式读输出
```

对**真实 settings 服务**的集成验证（需要 DSH 仓库；在临时文件上跑，不碰你的配置）：

```powershell
cd D:\developer\deepseek-harness
node --import tsx/esm C:\Users\lz\OneDrive\Desktop\dsh-test\dsh-plugin-workbuddy-gateway\scripts\verify-provider-route.mjs
```

它验证单元测试验不到的那件事：DSH 自己的写入器接受对 `llm-pi-ai` 的路径级 `mutate`，
**兄弟路由和无关段落都原样保留**。

## 排障

```powershell
# 插件自检（需要 dsh 正在运行）
Invoke-RestMethod http://127.0.0.1:3080/dsh-workbuddy-gateway/api/v1/health | ConvertTo-Json -Depth 6

# 网关本体
Invoke-RestMethod http://127.0.0.1:18088/health | ConvertTo-Json -Depth 4
```

| 现象 | 原因 / 处理 |
|---|---|
| 设置页没有 WorkBuddy | host 半只在挂载时导入一次：**重启 dsh**。刚改过 client 半只需刷新页面。 |
| 启动失败、日志有 `argparse` | `gatewayDir` 指错了目录，或内置 `vendor/` 被删。设置页会显示实际用的脚本路径。 |
| 启动失败、日志有 `WinError 10013` | 端口落在保留区间，改端口（默认 18088 是安全的）。 |
| 模型路由写入报 "不是已注册的命名空间" | pi-ai 适配器还没加载完。刷新页面重试即可，状态每次轮询都会重读。 |
| 模型选择器里没有模型 | 先"写入模型路由"，再刷新页面。路由是页面加载时下发的。 |

## 卸载

1. 设置页里先「移除模型路由」
2. 从 profile 的 `dsh.profile.bundles` 删掉包名，并 `pnpm remove dsh-plugin-workbuddy-gateway`
3. 重启 dsh
4. 可选：删掉 `$DSH_HOME/workbuddy/` 与凭据库里的 `WORKBUDDY_API_KEY`

## 风险

网关走的是订阅端内部接口，**不是官方 API**。被风控检测存在封号风险，且大概率不符合
WorkBuddy 服务条款 —— 由使用者自行权衡。本插件只是把这套已知的社区方案托管起来，
不改变它的性质。

## 致谢

网关实现来自 [ardeyouxipianyi/workbuddy2api-intl](https://github.com/ardeyouxipianyi/workbuddy2api-intl)
（MIT），已内置在 `vendor/workbuddy-gateway/`，许可证随附、未作修改。升级上游时替换该目录内容即可。
第三方代码的完整说明见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

插件机制参考了另外两个 DSH 社区插件（仅参考集成方式，未包含其代码）：
`dsh-plugin-archived-sessions` 的 `settings.section` 挂载方式，
以及 `dsh-plugin-codex-monitor` 的 host 路由 + client 页面形态与同源守卫约定。

## 许可证

本插件代码为 **MIT**，见 [`LICENSE`](LICENSE)。
内置网关是另一份独立的 MIT 代码，见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。

## 参与贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。摘要：

```powershell
npm test                          # 67 个离线测试（不需要 DSH、Python、网络）
npm run preflight                 # 验证本机 spawn + 管道 stdio 可用
node scripts/check-package.mjs    # 发布前自检：文件清单、版本一致性、无硬编码绝对路径
npm run report:reasoning          # 对着运行中的网关打印每个模型的推理档位结论
```

集成脚本需要一个 DSH 检出（在 DSH 仓库里跑）：

```powershell
node --import tsx/esm <本插件>\scripts\verify-settings-section.mjs
node --import tsx/esm <本插件>\scripts\verify-provider-route.mjs
```


插件机制参考了本机另外两个插件：`dsh-plugin-archived-sessions`（设置页 `settings.section` 挂载）
与 `dsh-plugin-codex-monitor`（host 路由 + client 页面 + 同源守卫）。
