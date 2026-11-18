# ADR-0012 移除脚手架期 CI workflow

> 状态：已接受（CI 决定被 0023 取代） · 日期：2026-11-01 · 级别：L3

## 决定

删除 `.github/workflows/ci.yml`：该 workflow 自脚手架期存在但从未运行（无 git 远端，verification.md 一直标注待落地）。质量门禁由本地提交门禁（husky/commit-msg + lint-staged，ADR-0011）与收口人工验证承担；architecture.md 工具链规则 2 的"CI 必须执行"同步改为提交门禁与收口表述。

## 被否决的选项

保留 workflow 等待远端：从未运行的配置会与门禁演进脱节（如 commitlint、权限矩阵等新门禁均不在其中），重引时按现状重写更可靠。

## 后果

verification.md 移除 ci.yml 条目；远端 CI 缺位期间，全仓 lint/typecheck/test/build 依赖本地执行与收口自查；未来引入远端 CI 时新建 workflow 并回补本决定为"已取代"。
