# 《暗流涌动》说书人提示词资料说明

更新日期：2026-07-27

## 目的

本仓库没有保存官方网页全文、图片或角色美术。`apps/server/src/ai/storyteller-prompt.ts`
是根据公开资料整理的内部开发提示词，内容采用结构化转述，用于约束未来的只读 AI
说书人参谋。

当前 `ReadOnlyAiService` 仍是确定性实现，并不会调用外部模型。未来接入模型时，应使用
`buildPrompt(summary)` 生成提示词，并继续只传递删减后的公开房间摘要。

## 查阅来源

- 官方 How to Play：https://bloodontheclocktower.com/pages/how-to-play
- 官方 Wiki 的 Trouble Brewing 页面：https://wiki.bloodontheclocktower.com/Trouble_Brewing
- 官方 Wiki 的 Setup 页面：https://wiki.bloodontheclocktower.com/Setup
- 官方 Wiki 中 22 个 Trouble Brewing 角色的独立页面
- 官方 Legal & Terms of Use：https://bloodontheclocktower.com/pages/terms-of-use

## 法务边界

TPI 的公开条款允许制作个人用途的电子工具，但限制未经许可公开分享或分发包含其角色、
规则或其他知识产权的数字工具。本文件和提示词不能被理解为官方授权。公开部署、分发或
商业化前，应取得 The Pandemonium Institute 的明确许可，并重新审查产品中的名称、规则、
翻译和视觉资产。

## 使用原则

- 官方资料只作为事实核对来源，不自动同步网页，也不复制长篇原文。
- 规则引擎是唯一裁判；AI 只生成建议。
- AI 只接收公开摘要，不接收完整魔典或玩家秘密。
- 夜间行动必须由确定性状态机执行、校验并记录。
- 所有私密信息必须经过说书人确认后才能发送。
