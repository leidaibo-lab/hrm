# ADR-0025 项目 skills 流程归并

> 状态：已接受 · 日期：2026-11-08 · 级别：L3

## 决定

依据用户移除现有两个项目 skills 的指令，将 create-module 的模块实施顺序和 closeout 的收口审查步骤归入 process/workflow；删除两个 SKILL.md 和空目录，移除 AGENTS、index、authorization 的引用。规范、执行流程、验证命令分别由 conventions、process、reference/verification 唯一维护。

## 被否决的选项

- 保留 skills 镜像 docs：同一流程有多个入口，更新容易分叉。
- 只删除文件而丢失步骤：会遗漏模块接入与 L2/L3 audit，所以先归并再删除。

## 后果与回滚

现行文档篇数保持不变；不影响机器门禁和宿主提供的通用 skills。旧 SKILL.md 仍可从 Git 历史恢复；恢复前必须重新确认职责，禁止长期维护两份流程。原规范各自的强制约束和实际验证要求继续生效。
