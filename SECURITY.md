# Security Policy / 安全政策

[English](#english) | [简体中文](#简体中文)

---

## English

### Supported Versions

ClockTower — Trouble Brewing is currently a pre-release project. Security fixes
are normally applied only to the latest version on the `main` branch.

| Version | Supported |
| ------- | --------- |
| Latest commit on `main` | ✅ |
| Older commits | ❌ |
| Unofficial forks or modified versions | ❌ |

### Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub Issues,
Discussions, pull requests, or other public channels.

To report a vulnerability privately, open the repository's
**Security and quality → Advisories** page and click
**Report a vulnerability**, or use the following link:

https://github.com/stefanokratzdisteln-hash/_ClockTower/security/advisories/new

If private vulnerability reporting is unavailable, you may open a public Issue
asking the maintainer for a private contact method. Do not include any
vulnerability details in that Issue.

### Information to Include

Please include as much of the following information as possible:

- A clear description of the vulnerability
- The potential security impact
- Steps required to reproduce the problem
- The affected version, branch, or commit
- Your operating system and browser
- Relevant server and client configuration
- Proof-of-concept code, screenshots, logs, or recordings
- Any suggested mitigation or fix
- Whether the vulnerability has been disclosed elsewhere

Please remove passwords, access tokens, private room information, personal data,
and other unrelated sensitive information from your report.

### Examples of Security Vulnerabilities

Relevant security issues may include, but are not limited to:

- Unauthorized access to a game room
- Bypassing room, player, or storyteller permissions
- Impersonating another player or the storyteller
- Exposure of secret roles or hidden game information
- Crafted WebSocket messages that manipulate or crash the server
- Cross-site scripting, code injection, or command injection
- Unauthorized modification of game state
- Exposure of credentials, tokens, personal data, or private room information
- Vulnerable dependencies that can be exploited through this project

Normal game bugs, rule disagreements, visual problems, and feature requests
should be reported through regular GitHub Issues unless they have a meaningful
security impact.

### Responsible Testing

When investigating a possible vulnerability:

- Test only systems and game rooms that you own or have permission to test
- Do not access, modify, or delete another person's data
- Do not intentionally disrupt active games or services
- Do not perform denial-of-service attacks
- Do not use social engineering, phishing, or physical attacks
- Stop testing if you encounter sensitive or personal information
- Give the maintainer reasonable time to investigate and fix the problem before
  public disclosure

### Response Process

We aim to:

1. Acknowledge the report within 7 days
2. Review and assess the report within 14 days
3. Request additional information when necessary
4. Keep the reporter informed about significant progress
5. Prepare and test a fix when the vulnerability is confirmed
6. Coordinate public disclosure after a fix or mitigation is available

These time frames are targets rather than guarantees. Response times may depend
on the complexity and severity of the vulnerability.

If the report is accepted, we will provide information about the planned
remediation where appropriate. If the report is declined, we will try to explain
the reason.

### Coordinated Disclosure

Please do not publicly disclose an unpatched vulnerability before a fix or
mitigation has been prepared.

The maintainer and reporter should coordinate a reasonable disclosure date.
Once the issue has been resolved, a GitHub Security Advisory may be published
with details about the impact, affected versions, and fix.

Reporter credit may be included in the advisory or release notes unless the
reporter prefers to remain anonymous.

### Security Updates

Security fixes will normally be applied to the latest version on the `main`
branch. Older commits, archived versions, unofficial builds, and third-party
forks may not receive security updates.

Users should update to the latest trusted version after a security fix is
released.

### Security Rewards

This project currently does not operate a paid bug bounty program.

Responsible security reports are appreciated, and reporters may be acknowledged
in security advisories or release notes, subject to their preference.

---

## 简体中文

### 受支持的版本

ClockTower — Trouble Brewing 目前仍处于预发布阶段。安全修复通常只会应用于
`main` 分支上的最新版本。

| 版本 | 是否支持 |
| ---- | -------- |
| `main` 分支的最新提交 | ✅ |
| 较早的提交 | ❌ |
| 非官方分支或修改版本 | ❌ |

### 报告安全漏洞

请不要通过公开的 GitHub Issues、Discussions、Pull Requests 或其他公开渠道
报告安全漏洞。

如需私下报告漏洞，请进入仓库的
**Security and quality → Advisories** 页面，然后点击
**Report a vulnerability**，也可以直接使用以下链接：

https://github.com/stefanokratzdisteln-hash/_ClockTower/security/advisories/new

如果私密漏洞报告功能暂时不可用，可以创建一个公开 Issue，询问维护者应当通过
什么私密方式取得联系。但是，请勿在该 Issue 中包含任何漏洞细节。

### 报告中应包含的信息

请尽量提供以下信息：

- 漏洞的清晰描述
- 漏洞可能造成的安全影响
- 重现问题所需的步骤
- 受影响的版本、分支或提交
- 您使用的操作系统和浏览器
- 相关的服务器与客户端配置
- 概念验证代码、截图、日志或录像
- 建议的缓解措施或修复方法
- 该漏洞是否已在其他地方公开

请从报告中删除密码、访问令牌、私人房间信息、个人数据以及其他与漏洞无关的
敏感信息。

### 安全漏洞示例

相关的安全问题包括但不限于：

- 未经授权进入游戏房间
- 绕过房间、玩家或说书人的权限限制
- 冒充其他玩家或说书人
- 泄露秘密角色或隐藏的游戏信息
- 使用特制的 WebSocket 消息操纵游戏或导致服务器崩溃
- 跨站脚本、代码注入或命令注入
- 未经授权修改游戏状态
- 泄露凭据、令牌、个人数据或私人房间信息
- 可以通过本项目利用的第三方依赖漏洞

普通游戏错误、规则分歧、界面显示问题和功能建议，应当通过普通 GitHub Issue
报告，除非它们会造成实质性的安全影响。

### 负责任的安全测试

调查潜在漏洞时，请遵守以下要求：

- 只测试您自己拥有或已获得明确授权的系统和游戏房间
- 不要访问、修改或删除他人的数据
- 不要故意干扰正在进行的游戏或服务
- 不要进行拒绝服务攻击
- 不要进行社会工程、网络钓鱼或物理攻击
- 如果发现敏感信息或个人数据，请立即停止测试
- 在公开漏洞之前，给予维护者合理的调查和修复时间

### 处理流程

我们将尽力：

1. 在7天内确认收到报告
2. 在14天内完成初步审查和评估
3. 必要时向报告者请求更多信息
4. 向报告者通报重要进展
5. 在确认漏洞后准备并测试修复方案
6. 在修复或缓解措施可用后协调公开披露

以上时间是处理目标，而不是绝对保证。实际响应时间可能取决于漏洞的复杂程度
和严重程度。

如果报告被接受，我们会在适当情况下提供计划中的修复信息。如果报告未被接受，
我们会尽量说明原因。

### 协调披露

在修复或缓解措施准备完成之前，请不要公开尚未修复的漏洞。

维护者和报告者应当共同商定合理的公开日期。问题解决后，可以发布 GitHub
Security Advisory，说明漏洞影响、受影响版本和修复方法。

除非报告者希望保持匿名，否则可以在安全公告或发行说明中感谢报告者。

### 安全更新

安全修复通常只会应用于 `main` 分支上的最新版本。较早的提交、已归档版本、
非官方构建和第三方分支可能不会获得安全更新。

安全修复发布后，建议用户升级到最新的可信版本。

### 安全奖励

本项目目前没有提供付费漏洞奖励计划。

我们感谢负责任的安全漏洞报告。经报告者同意，可以在安全公告或发行说明中
公开致谢。
