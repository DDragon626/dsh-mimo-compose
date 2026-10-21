# dsh-mimo-compose

DSH 的 **MiMo Compose 模式**：把 MiMo-Code 的 `compose-next` 工作流移植成一个可选择的 Agent preset，并补上 DSH 缺失的 git worktree 能力。

选中这个模式即进入工作流；不选，任何会话都看不到它——没有自动分级、没有隐式触发。

## 组成

| 部件 | 路径 | 作用 |
|---|---|---|
| 模式声明 | `cordis.patch.yml` | 以 `insert` 新增 `preset-mimo-compose`（order 5），挂载 persona / 工具 / 技能 / 工作树 |
| 技能 | `skills/compose-next/` | `SKILL.md`（7801 字符）+ 4 个 `references/`，全部低于 DSH 8192 字符的结果裁剪阈值 |
| 技能提供者 | `src/skills.js` | preset 作用域内的 `ctx.skills` provider，只向本模式暴露 `skills/` |
| 工作树工具 | `src/worktree.js` | `worktree_create` / `list` / `info` / `remove`，工作树固定在 `<repo>/.worktrees/` |

## 安装

### 从 GitHub（可移植，推荐给其他机器）

```powershell
dsh plugin --profile web add github:DDragon626/dsh-mimo-compose
```

`dsh plugin add` 会同时完成三件事：写入 `dependencies`、执行 pnpm 安装、把包名追加进 `dsh.profile.bundles`。**装完需要重启一次 `dsh web`**——bundle 的 patch 行在启动时装配。

> ⚠️ 实测坑：`dsh plugin add` 重写 `dsh.profile.bundles` 时可能丢掉列表里已有的条目，进而让 `dump-config` 报 `entry "…" not found`。装完请务必跑下面的校验，发现丢失就手工补回。

## 校验

```powershell
# 组合树应包含 preset-mimo-compose，且没有任何 "not found"
dsh --profile web --dump-config | Select-String "preset-|not found"
```

会话级验证：用 `cross_session_spawn agent_preset=mimo-compose` 派生会话，让它加载 `compose-next` 并确认四个 `worktree_*` 工具存在。

隔离验证：在 standard 模式会话里加载 `compose-next` 应当失败——技能只在 mimo-compose 作用域可见。

## 卸载 / 回滚

```powershell
dsh plugin --profile web remove dsh-mimo-compose
```

若手工改过 profile，可从 `cordis.patch.yml.bak-*`、`package.json.bak-*` 还原。

## 设计取舍

- **为什么是 preset 而不是全局技能**：`ctx.skills` 按 scope 分层，preset 内注册只对该模式生效；挂全局会污染每个会话的技能目录。
- **为什么没有"简单/复杂"分级检查点**：上游 MiMo-Code 新版已删除它，改为显式触发；本移植用"模式选择"承担同一职责，不与上游分叉。
- **为什么技能要拆 references**：标准 preset 的 `tool-result-pruner` 在 8192 字符处裁剪，单个大 SKILL.md 会被截成头尾两段。
- **为什么工具用裸 JSON Schema 注册**：profile 的 `node_modules` 里没有 `@deepseek-ai/dsh-tools`，无法 import `defineTool`。
- **为什么 worktree 要 `repo` 参数**：会话可以固定在同一个工作区（它本身不一定是 git 仓库），仓库位于子目录时用 `repo` 指定即可，不必为每个仓库另开工作区。

## 上游

- 工作流语义来自 [MiMo-Code `compose-next`](https://github.com/XiaomiMiMo/MiMo-Code/blob/main/packages/cli/src/skill/builtin/.bundle/compose-next/SKILL.md)（MIT）。
- 未照搬的对象：`packages/opencode/src/skill/compose/bundle/*`（6 月快照，上游已删除该路径）、原生 `workflow` 运行时（84KB，DSH 已有 `workflow` 工具）。
