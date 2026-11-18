# ADR-0061 agentic 策略时间窗

> 状态：已接受 · 日期：2026-11-16 · 级别：L2

## 决定

补齐有效权限公式的「时间窗」一项，配置来源为当前 Policy 的 `rules.permissionWindow`：

- **形状**：`{ start: 'HH:mm', end: 'HH:mm', timezone: IANA, days?: 1..7[] }`；`days` 1=周一、7=周日，缺省每天；`end < start` 表示跨夜。
- **判定**：按策略时区把 `now` 换算为本地日与分钟，生成当日（或跨夜）的 `from/to` 边界；`now < from` → `window_not_started`，`now > to` → `window_expired`，星期不在 `days` 内按未开始拒绝。
- **作用面**：内部令牌的 `runs:start`、`reports:append`、`artifacts:write` 三个动作；每次判定读取当前策略，窗口缺省不限。
- **失败方式**：配置存在但时钟/时区/结构非法时 fail closed（给未来起点，拒绝当前请求），不静默放行。
- **不改变**：策略版本、Mandate 与工具级权限公式；时间窗只收紧内部执行写入。

## 被否决的选项

- **绝对起止时间**：策略长期有效，绝对窗口需要频繁发版，且无法表达「工作日 9–19 点」。
- **只按 UTC**：业务在 Asia/Shanghai，按 UTC 会错 8 小时。
- **非法配置放行**：安全默认拒绝；API schema 已限制形状，历史脏数据仍 fail closed。
- **在 Web 单独做开关**：时间窗是策略版本的一部分，必须与 `policy:configure` 一起审计。

## 验证

2026-11-16：`policy.entity.spec` 覆盖窗口内、过期、星期过滤、跨夜、非法配置与缺省；`internal-runtime.service.spec` 覆盖窗外写入被 403 拒绝；API 全量单测、typecheck、lint、docs/rules 检查通过。未做真实 IAM 角色与生产时区切换联调。

## 后果与回滚

- 配置窗口后，窗口外所有内部执行写入被拒；已有运行中的 Assignment 不受影响，恢复后需在窗口内继续。
- 跨夜与 DST 边界按当前偏移推算，极端 DST 跳变可能偏差一小时；中国时区无 DST，影响可忽略。
- 回滚：删除 `permissionWindow` 规则或移除 `readPermissionWindow` 调用即恢复不限；已写策略版本保留。
