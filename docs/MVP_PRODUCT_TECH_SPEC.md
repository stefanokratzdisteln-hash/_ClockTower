# 血染钟楼《暗流涌动》Web/PWA 原型产品与技术文档

版本：0.1  
日期：2026-07-27  
定位：说书人辅助工具，不是替代说书人的自动主持系统

## 1. 项目目标

本项目先以《血染钟楼：暗流涌动》为原型范围，开发一个 Web/PWA 工具，帮助说书人完整、稳定、优雅地主持一局游戏。

第一版的目标不是做“全自动 AI 说书人”，而是做：

- 规则绝对可靠的游戏流程系统
- 高审美、高效率的说书人魔典
- 玩家端私密信息与互动界面
- 实时同步的房间与状态管理
- AI 说书人参谋，用于读桌、控节奏、体验提醒和合法建议
- 可复盘、可测试、可扩展到其他剧本的底层架构

核心原则：

> 规则引擎负责“什么是合法的”；说书人负责“在合法范围内怎么讲得精彩”；AI 负责“提出建议与风险提示”。

## 2. 法务与素材边界

《血染钟楼》相关角色、规则文本、图片、图标、剧本名、角色名等属于 The Pandemonium Institute 的知识产权。开发时需要遵守以下边界：

- 内部原型可以使用本地配置和临时占位素材。
- 公开发布前必须确认授权、社区政策和商业使用限制。
- 不直接复制官方规则书长文本、角色说明全文或官方图像素材到代码仓库。
- 角色能力可以用内部结构化规则表达，不把官方描述文本作为产品内容分发。
- UI 中优先使用原创图形、抽象符号和自有文案。
- 若未来商业化，应准备授权申请或改造成原创社交推理规则框架。

## 3. 第一版 MVP 范围

### 3.1 必须包含

- 创建房间
- 选择《暗流涌动》规则包
- 添加玩家
- 设置座位顺序
- 设置玩家经验标签，例如新手、熟手、需要照顾
- 生成或手动分配身份
- 说书人魔典视图
- 玩家端身份查看
- 首夜流程引导
- 白天讨论计时
- 提名流程
- 投票流程
- 处决流程
- 夜晚行动流程
- 死亡、存活、醉酒、中毒、保护等状态记录
- 合法动作校验
- 胜负条件检测
- 游戏事件时间线
- 复盘视图
- AI 说书人建议面板

### 3.2 第一版不做

- 官方账号体系
- 商业支付
- 排位或积分系统
- 全自动语音识别主持
- 复杂 3D 场景
- 多剧本编辑器
- 公开素材库
- 替代说书人进行最终裁决

## 4. 用户角色

### 4.1 说书人

拥有全局视野和最终控制权。

说书人需要：

- 快速建立房间
- 管理玩家与座位
- 查看完整角色与状态
- 按阶段推进游戏
- 看到每一步的合法选项
- 收到 AI 建议，但不被 AI 强制
- 修改状态时有确认与撤销
- 复盘时能解释每个关键节点

### 4.2 玩家

只看到自己应该知道的信息。

玩家需要：

- 加入房间
- 查看自己的身份和阵营
- 接收说书人的夜晚私密提示
- 在提名和投票阶段参与操作
- 死亡后仍能看到可参与的信息
- 游戏结束后查看复盘

### 4.3 旁观者

可选角色。第一版建议只支持只读旁观。

## 5. 产品页面结构

### 5.1 说书人端

1. 房间设置页
   - 房间名
   - 玩家人数
   - 剧本选择
   - 公开/私密开关
   - 邀请链接或二维码

2. 玩家与座位页
   - 环形座位
   - 拖拽排序
   - 玩家标签
   - 缺席、旁观、旅行者预留

3. 身份分配页
   - 自动分配
   - 手动分配
   - 阵营结构检查
   - 邪恶玩家互认信息检查

4. 魔典页
   - 环形座位视图
   - 每名玩家身份、阵营、生死、状态
   - 状态标记：死亡、醉酒、中毒、保护、已用能力、临时备注
   - 夜晚顺序侧栏
   - 当前阶段操作面板
   - AI 建议面板

5. 白天流程页
   - 日数
   - 讨论计时
   - 发言活跃度
   - 提名入口
   - 当前公开死亡信息

6. 提名与投票页
   - 提名者
   - 被提名者
   - 投票顺序
   - 票数记录
   - 是否达到处决门槛
   - 当日最高票记录

7. 夜晚流程页
   - 当前该唤醒谁
   - 可执行动作
   - 合法目标
   - 推荐信息
   - 需要说书人手动确认的节点

8. 复盘页
   - 角色分布
   - 每日处决
   - 每夜死亡
   - 关键状态变化
   - AI 生成复盘草稿

### 5.2 玩家端

1. 加入房间页
   - 昵称
   - 加入码
   - 座位确认

2. 身份页
   - 个人身份
   - 阵营
   - 私密信息
   - 当前生死状态

3. 游戏中页
   - 当前阶段
   - 是否可操作
   - 提名按钮
   - 投票按钮
   - 私密提示

4. 复盘页
   - 全局身份公开
   - 时间线
   - 胜负原因

## 6. 游戏流程状态机

核心状态：

```text
LOBBY
SETUP_PLAYERS
ASSIGN_CHARACTERS
PRIVATE_REVEAL
FIRST_NIGHT
DAY_DISCUSSION
NOMINATION
VOTING
EXECUTION_RESOLUTION
NIGHT
GAME_OVER
REVIEW
```

主要流转：

```text
LOBBY
 -> SETUP_PLAYERS
 -> ASSIGN_CHARACTERS
 -> PRIVATE_REVEAL
 -> FIRST_NIGHT
 -> DAY_DISCUSSION
 -> NOMINATION
 -> VOTING
 -> EXECUTION_RESOLUTION
 -> NIGHT
 -> DAY_DISCUSSION
 -> ...
 -> GAME_OVER
 -> REVIEW
```

任何状态变化必须满足：

- 当前阶段允许该动作
- 操作者权限正确
- 目标合法
- 规则包允许
- 会产生事件记录
- 可被复盘解释

## 7. 规则引擎设计

### 7.1 规则引擎职责

规则引擎只负责确定性逻辑：

- 根据玩家人数计算角色类别分布
- 校验身份分配是否合法
- 计算夜晚顺序
- 计算当前阶段可执行动作
- 判断能力目标是否合法
- 处理死亡、生还、醉酒、中毒、保护等状态
- 判断胜负条件
- 生成合法信息候选
- 记录事件

规则引擎不负责：

- 决定说书人“应该”给什么误导
- 替说书人做最终戏剧性选择
- 根据玩家情绪改变规则
- 直接调用大模型

### 7.2 建议技术形式

使用 TypeScript 纯逻辑包：

```text
packages/rules-engine
  src/
    game-state.ts
    actions.ts
    events.ts
    scripts/
      trouble-brewing.ts
    phases/
      setup.ts
      day.ts
      night.ts
      nomination.ts
      voting.ts
    validators/
      action-validator.ts
      setup-validator.ts
    selectors/
      legal-actions.ts
      night-order.ts
      win-condition.ts
    tests/
```

### 7.3 数据模型草案

```ts
type PlayerId = string;
type CharacterId = string;
type GameId = string;

type Alignment = 'good' | 'evil';
type PlayerStatus = {
  alive: boolean;
  deadVoteAvailable: boolean;
  drunk: boolean;
  poisoned: boolean;
  protected: boolean;
};

type Player = {
  id: PlayerId;
  name: string;
  seatIndex: number;
  experience: 'new' | 'regular' | 'expert';
};

type Character = {
  id: CharacterId;
  scriptId: string;
  type: 'townsfolk' | 'outsider' | 'minion' | 'demon';
  alignment: Alignment;
  firstNightOrder?: number;
  otherNightOrder?: number;
  abilityModel: AbilityModel;
};

type Assignment = {
  playerId: PlayerId;
  characterId: CharacterId;
  alignment: Alignment;
  status: PlayerStatus;
  reminders: string[];
};

type GamePhase =
  | 'lobby'
  | 'setup_players'
  | 'assign_characters'
  | 'private_reveal'
  | 'first_night'
  | 'day_discussion'
  | 'nomination'
  | 'voting'
  | 'execution_resolution'
  | 'night'
  | 'game_over'
  | 'review';

type GameState = {
  id: GameId;
  scriptId: string;
  phase: GamePhase;
  dayNumber: number;
  players: Player[];
  assignments: Assignment[];
  nominations: Nomination[];
  events: GameEvent[];
};
```

### 7.4 事件溯源

建议所有状态变化都写成事件：

```ts
type GameEvent =
  | { type: 'PLAYER_JOINED'; playerId: PlayerId; name: string }
  | { type: 'SEAT_CHANGED'; playerId: PlayerId; seatIndex: number }
  | { type: 'CHARACTER_ASSIGNED'; playerId: PlayerId; characterId: CharacterId }
  | { type: 'PHASE_ADVANCED'; from: GamePhase; to: GamePhase }
  | { type: 'PLAYER_DIED'; playerId: PlayerId; reason: string }
  | { type: 'PLAYER_EXECUTED'; playerId: PlayerId }
  | {
      type: 'STATUS_CHANGED';
      playerId: PlayerId;
      statusKey: keyof PlayerStatus;
      value: boolean;
    }
  | { type: 'NOMINATION_CREATED'; nominatorId: PlayerId; nomineeId: PlayerId }
  | {
      type: 'VOTE_CAST';
      voterId: PlayerId;
      nomineeId: PlayerId;
      value: boolean;
    }
  | {
      type: 'PRIVATE_INFO_GIVEN';
      playerId: PlayerId;
      infoKind: string;
      redactedText?: string;
    }
  | { type: 'GAME_ENDED'; winningAlignment: Alignment; reason: string };
```

好处：

- 可以撤销和重放
- 可以复盘
- 可以调试规则错误
- 可以训练和评估 AI 说书人建议
- 多端同步更稳定

## 8. AI 说书人参谋

### 8.1 AI 的定位

AI 是 Copilot，不是裁判。

AI 可以：

- 分析局势
- 提醒节奏
- 提醒玩家体验风险
- 提供合法信息候选
- 给出平衡建议
- 生成复盘草稿
- 解释某个建议的理由

AI 不可以：

- 绕过规则引擎
- 直接修改游戏状态
- 私自决定胜负
- 给玩家发送未确认信息
- 为了戏剧性制造非法结果

### 8.2 实时读桌指标

系统应记录并量化：

- 当前日数
- 游戏总时长
- 每个白天讨论时长
- 每个玩家发言次数或手动活跃度
- 每个玩家被提名次数
- 每个玩家得票数
- 每个玩家被怀疑强度
- 阵营胜率估计
- 善良信息闭环程度
- 邪恶存活与操作空间
- 新手参与度
- 死亡玩家参与度
- 夜晚等待时间
- 说书人操作停顿时间

第一版可以先用手动输入和操作数据估算，不强依赖语音识别。

### 8.3 AI 建议类型

```text
RULE_HINT
PACE_HINT
BALANCE_HINT
EXPERIENCE_HINT
DRAMA_HINT
REVIEW_SUMMARY
RISK_WARNING
```

示例：

```text
PACE_HINT:
今天白天讨论已经超过 12 分钟，且只有 4 名玩家参与过核心讨论。建议开启提名窗口，或点名邀请沉默的新手玩家表达一次当前怀疑对象。
```

```text
BALANCE_HINT:
善良阵营已经形成两个强信息链。如果今晚需要给某名信息角色反馈，建议优先选择仍合法但不会直接确认恶魔身份的信息。
```

```text
RISK_WARNING:
当前建议可能让某名玩家直接排除 3 个候选恶魔。若希望保留悬念，请检查是否存在更温和的合法反馈。
```

### 8.4 AI 评分模型

可以为每局生成说书人辅助评分：

| 维度       | 分值 | 说明                                 |
| ---------- | ---- | ------------------------------------ |
| 规则准确性 | 0-20 | 是否出现非法流程、错误状态、错误胜负 |
| 信息质量   | 0-15 | 信息是否合法、有用、不过早终结悬念   |
| 平衡控制   | 0-15 | 是否让双方都有操作空间               |
| 节奏管理   | 0-15 | 是否拖沓、过快、等待过久             |
| 玩家体验   | 0-15 | 新手、死亡玩家、沉默玩家是否被照顾   |
| 戏剧性     | 0-10 | 是否产生自然转折与紧张感             |
| 复盘质量   | 0-10 | 是否能解释关键节点                   |

总分 100。

硬性扣分：

- 规则错误影响胜负：-20 至 -50
- 泄露隐藏信息：-20 至 -50
- AI 未经确认直接给玩家关键私密信息：-30
- 新手整局无有效参与：-10

## 9. UI/UX 原则

### 9.1 总体风格

推荐风格：克制、戏剧、清晰、桌面工具感。

避免：

- 过度奇幻
- 大面积纯黑导致信息难读
- 一屏太多装饰
- 卡片套卡片
- 用营销页结构包装工具

### 9.2 说书人魔典

魔典是核心界面，必须做到：

- 一眼看到座位关系
- 一眼看到生死状态
- 一眼看到当前夜晚该处理谁
- 状态修改不超过两步
- 危险操作有确认
- 所有 AI 建议都能看到理由
- 所有私密信息发送前可预览

推荐布局：

```text
+----------------------------------------------------+
| 顶部：房间、阶段、日数、计时、胜负风险             |
+----------------------+-----------------------------+
| 环形座位魔典         | 当前阶段操作面板            |
|                      | 夜晚顺序 / 提名 / 投票      |
|                      |                             |
|                      | AI 说书人建议               |
+----------------------+-----------------------------+
| 底部：事件时间线、撤销、备注                       |
+----------------------------------------------------+
```

### 9.3 玩家端

玩家端要极简：

- 当前身份
- 当前阶段
- 可做的事
- 私密提示
- 投票与提名

避免给玩家过多系统信息，防止破坏桌游体验。

## 10. 技术栈建议

### 10.1 推荐方案

```text
前端：React + TypeScript + Vite
UI：Radix UI / shadcn 风格组件 + 自定义主题
状态：Zustand 或 Redux Toolkit
规则引擎：TypeScript workspace package
后端：Node.js + NestJS 或 Fastify
实时同步：WebSocket
数据库：PostgreSQL
缓存/房间状态：Redis
AI 服务：独立 service，调用大模型 API
测试：Vitest + Playwright
部署：Docker + HTTPS
```

### 10.2 为什么不是 Unity

Unity 的优势是 3D、实时渲染、复杂动画和沉浸式场景。但本项目第一阶段最重要的是：

- 规则正确
- 信息权限正确
- 多端同步稳定
- UI 操作高效
- 快速迭代

这些都是 Web 技术更擅长的领域。Unity 可以作为未来沉浸式客户端，但不适合作为 MVP 起点。

### 10.3 微信小程序位置

微信小程序适合作为后续入口：

- 扫码加入房间
- 玩家端身份查看
- 投票与提名
- 简化版说书人端

但第一版不建议直接小程序优先，因为复杂魔典 UI、实时状态调试、AI 面板、跨端适配都会增加约束。

## 11. 目录结构建议

```text
apps/
  web/
    src/
      pages/
      components/
      features/
      stores/
      styles/
  server/
    src/
      rooms/
      gateway/
      auth/
      ai/
packages/
  rules-engine/
    src/
      scripts/
      phases/
      validators/
      selectors/
      events/
      tests/
  shared/
    src/
      types/
      constants/
docs/
  MVP_PRODUCT_TECH_SPEC.md
```

## 12. 开发里程碑

### Milestone 1：规则引擎骨架

目标：可以在无 UI 的情况下跑完一局抽象流程。

交付：

- 玩家模型
- 身份分配模型
- 阶段状态机
- 事件系统
- 基础胜负判断
- 单元测试

### Milestone 2：说书人本地魔典

目标：单机浏览器里，能完整记录一局。

交付：

- 房间创建
- 玩家座位
- 身份分配
- 魔典 UI
- 白天、提名、投票、夜晚流程
- 本地事件时间线

### Milestone 3：多人实时同步

目标：玩家可以用手机加入房间。

交付：

- WebSocket 房间
- 玩家端身份页
- 私密信息同步
- 投票同步
- 重连恢复

### Milestone 4：AI 说书人参谋

目标：AI 能基于当前局势给说书人建议。

交付：

- AI 输入摘要器
- 建议生成
- 风险提示
- 说书人确认机制
- 复盘摘要

### Milestone 5：体验打磨

目标：接近真实桌游主持体验。

交付：

- 动效
- 响应式布局
- PWA 离线缓存
- 键盘快捷操作
- 移动端优化
- 可视化复盘

## 13. 测试策略

必须测试：

- 玩家人数对应角色类别分布
- 身份分配合法性
- 夜晚顺序
- 状态叠加：醉酒、中毒、保护、死亡
- 提名与投票门槛
- 死亡玩家投票
- 恶魔死亡与胜负判断
- 剩余两名玩家的胜负判断
- 事件重放后状态一致
- 玩家权限隔离
- AI 建议不能直接改变状态

建议使用：

- Vitest：规则引擎单元测试
- Playwright：端到端流程测试
- Snapshot：关键局面状态快照
- Property-based testing：随机身份分配与事件重放

## 14. 第一批开发任务

建议从这些任务开始：

1. 初始化 monorepo
2. 创建 `packages/rules-engine`
3. 定义 `GameState`、`Player`、`Character`、`GameEvent`
4. 实现阶段状态机
5. 实现玩家人数与角色类别分布校验
6. 实现基础胜负判断
7. 创建 `apps/web`
8. 做说书人魔典静态原型
9. 接入本地规则引擎
10. 补第一批单元测试

## 15. 当前最高风险

- 官方 IP 授权风险
- 规则细节遗漏导致信任崩塌
- AI 建议越权，破坏公平性
- 说书人 UI 信息过载
- 玩家端泄露隐藏信息
- 实时同步和撤销逻辑复杂

应对策略：

- 规则引擎先行
- 所有状态变化事件化
- AI 只读状态，输出建议，不写状态
- 权限系统独立测试
- UI 先服务说书人效率，再追求气氛

## 16. 推荐决策

第一阶段采用：

```text
Web/PWA 自研原型
+ TypeScript 规则引擎
+ WebSocket 后端同步
+ AI 说书人参谋
```

暂不使用 Unity。微信小程序作为后续分发渠道评估，不作为核心原型起点。

最终目标是做出一个“说书人愿意开局时真的打开”的工具，而不是一个看起来很完整但主持时碍手碍脚的软件。
