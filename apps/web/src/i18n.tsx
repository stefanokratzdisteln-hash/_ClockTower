import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'en' | 'zh';

const LANGUAGE_KEY = 'clocktower:language';
const CHINESE_PATTERN = /[\u3400-\u9fff]/;
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: 'zh', setLocale: () => undefined });

const TRANSLATIONS: Record<string, string> = {
  暗流涌动: 'Trouble Brewing',
  房间准备: 'Room Setup',
  设置座位: 'Seat Setup',
  分配身份: 'Assign Characters',
  身份确认: 'Identity Reveal',
  首夜: 'First Night',
  白天讨论: 'Day Discussion',
  提名: 'Nomination',
  投票: 'Voting',
  处决结算: 'Execution Resolution',
  夜晚: 'Night',
  游戏结束: 'Game Over',
  复盘: 'Review',
  公开复盘: 'Open Review',
  等待入座: 'Waiting for Seats',
  确认座位: 'Confirm Seats',
  身份准备中: 'Preparing Identities',
  查看身份: 'Reveal Identity',
  提名阶段: 'Nomination Phase',
  投票阶段: 'Voting Phase',
  洗衣妇: 'Washerwoman',
  图书管理员: 'Librarian',
  调查员: 'Investigator',
  厨师: 'Chef',
  共情者: 'Empath',
  占卜师: 'Fortune Teller',
  掘墓人: 'Undertaker',
  僧侣: 'Monk',
  守鸦人: 'Ravenkeeper',
  贞洁者: 'Virgin',
  猎手: 'Slayer',
  士兵: 'Soldier',
  市长: 'Mayor',
  管家: 'Butler',
  酒鬼: 'Drunk',
  隐士: 'Recluse',
  圣徒: 'Saint',
  投毒者: 'Poisoner',
  间谍: 'Spy',
  红唇女郎: 'Scarlet Woman',
  男爵: 'Baron',
  小恶魔: 'Imp',
  镇民: 'Townsfolk',
  外来者: 'Outsider',
  爪牙: 'Minion',
  恶魔: 'Demon',
  善良: 'Good',
  邪恶: 'Evil',
  善良阵营: 'Good Team',
  邪恶阵营: 'Evil Team',
  善良阵营获胜: 'Good Team Wins',
  邪恶阵营获胜: 'Evil Team Wins',
  善良获胜: 'Good Wins',
  邪恶获胜: 'Evil Wins',
  阵营获胜: 'Team Wins',
  创建多人房间: 'Create Multiplayer Room',
  '我是玩家，加入房间': 'I am a player — join room',
  房间码: 'Room Code',
  加入钟楼: 'Join the Clocktower',
  昵称: 'Display Name',
  与座位上的昵称一致: 'Use the name shown on your seat',
  '输入说书人提供的房间码与昵称。身份信息只会发送给你。':
    'Enter the room code and name provided by the Storyteller. Your identity is sent only to you.',
  安全加入房间: 'Join Room Securely',
  返回说书人端: 'Back to Storyteller',
  '钟楼 · 玩家端': 'Clocktower · Player',
  房间: 'Room',
  退出房间: 'Leave Room',
  '· 当前阶段': '· Current Phase',
  现在可以操作: 'Action Available',
  等待说书人: 'Waiting for Storyteller',
  等待说书人分配: 'Waiting for assignment',
  身份尚未揭示: 'Identity not yet revealed',
  座位: 'Seat',
  '● 存活': '● Alive',
  '† 死亡': '† Dead',
  存活: 'Alive',
  死亡: 'Dead',
  'EVIL TEAM · 仅你可见': 'EVIL TEAM · PRIVATE',
  安全伪装: 'Safe Bluffs',
  恶魔伪装身份: 'Demon Bluffs',
  无: 'None',
  '当前唤醒 ·': 'Currently Awake ·',
  选择夜间目标: 'Choose Night Targets',
  '查看完整魔典后，确认已阅读并通知说书人。':
    'Review the full Grimoire, then confirm you have finished.',
  '你无需选择目标。说书人确认结果后，会私密显示在下方提示中。':
    'No target is required. The Storyteller’s result will appear privately below.',
  间谍魔典: 'Spy Grimoire',
  说书人的魔典: "Storyteller's Grimoire",
  仅本次唤醒可见: 'Visible only during this wake-up',
  '以下是当前魔典中的身份与状态。请勿让其他玩家看到屏幕。':
    'These are the current identities and states. Do not let other players see this screen.',
  无状态标记: 'No status markers',
  '已私密提交，说书人端已收到。':
    'Submitted privately. The Storyteller has received it.',
  确认已查看并通知说书人: 'Confirm Review',
  私密提交给说书人: 'Submit Privately',
  重新提交给说书人: 'Resubmit to Storyteller',
  发起提名: 'Make a Nomination',
  '选择一名仍然存活的玩家。提名提交后不可撤回。':
    'Choose a living player. A submitted nomination cannot be withdrawn.',
  选择被提名人: 'Choose a nominee',
  确认提名: 'Confirm Nomination',
  是否投给: 'Vote for',
  当前候选人: 'current nominee',
  举手赞成: 'Vote Yes',
  不举手: 'Do Not Vote',
  当前无需操作: 'No Action Required',
  只对你可见的提示: 'Private Information',
  '尚无私密提示。说书人发送后会显示在这里。':
    'No private information yet. Messages from the Storyteller will appear here.',
  身份公开复盘: 'Open Identity Review',
  '等待说书人开启复盘…': 'Waiting for the Storyteller to open the review…',
  进入复盘: 'Open Review',
  说书人确认善良阵营获胜: 'Storyteller confirmed a Good victory',
  说书人确认邪恶阵营获胜: 'Storyteller confirmed an Evil victory',
  由说书人确认善良阵营获胜: 'Good victory confirmed by the Storyteller',
  由说书人确认邪恶阵营获胜: 'Evil victory confirmed by the Storyteller',
  实时同步: 'Live Sync',
  正在重连: 'Reconnecting',
  连接中: 'Connecting',
  复制玩家链接: 'Copy Player Link',
  说书人确认: 'Storyteller Confirmation',
  魔典工具: 'Grimoire Tools',
  '魔典 M': 'Grimoire M',
  '角色能力表 R': 'Characters R',
  '夜晚顺序 N': 'Night Order N',
  开始: 'Start',
  暂停: 'Pause',
  重置: 'Reset',
  撤销: 'Undo',
  重做: 'Redo',
  显示身份: 'Show Identities',
  '隐藏身份 H': 'Hide Identities H',
  开启动画: 'Enable Animations',
  关闭动画: 'Disable Animations',
  导出: 'Export',
  导入: 'Import',
  '全屏 F': 'Fullscreen F',
  玩家加入地址: 'Player Join URL',
  玩家加入房间二维码: 'Player room QR code',
  '扫描二维码，或手动输入房间码与昵称加入。':
    'Scan the QR code, or enter the room code and name manually.',
  玩家与座位: 'Players & Seats',
  存活且有能力时: 'While alive and sober',
  手动添加玩家: 'Add Player Manually',
  输入玩家昵称: 'Enter player name',
  添加: 'Add',
  改名: 'Rename',
  新的玩家昵称: 'New player name',
  前移座位: 'Move Seat Forward',
  后移座位: 'Move Seat Back',
  移除: 'Remove',
  自动分配身份: 'Auto-assign Characters',
  提交手动分配: 'Submit Manual Assignments',
  选择角色: 'Choose character',
  为酒鬼选择一个不在场镇民伪装:
    'Choose an out-of-play Townsfolk character for the Drunk',
  未分配: 'Unassigned',
  当前身份: 'Current Identity',
  玩家认为自己是: 'Player believes they are',
  以为是: 'believes they are',
  自定义提醒: 'Custom Reminder',
  私密发送: 'Send Privately',
  发送给该玩家的私密信息: 'Private information for this player',
  标记死亡: 'Mark Dead',
  恢复存活: 'Restore Life',
  保留死亡票: 'Dead Vote Available',
  死亡投票权已使用: 'Dead Vote Used',
  中毒: 'Poisoned',
  醉酒: 'Drunk',
  受保护: 'Protected',
  保护: 'Protection',
  红鲱鱼: 'Red Herring',
  误登记: 'Might Register Falsely',
  继承恶魔: 'Demon Successor',
  解除设备绑定: 'Unbind Device',
  '解除该座位的设备绑定？': 'Unbind the device from this seat?',
  等待玩家通过手机加入: 'Waiting for players to join by phone',
  被提名人: 'Nominee',
  提名人: 'Nominator',
  当前没有进行中的投票: 'No vote is currently in progress',
  当前不是提名阶段: 'It is not currently the nomination phase',
  结算投票: 'Resolve Vote',
  '结算投票（未选择视为未举手）': 'Resolve Vote (missing votes count as no)',
  继续本日提名: 'Continue Nominations',
  今日处决: "Today's Execution",
  确认处决: 'Confirm Execution',
  '确认执行处决？规则引擎将再次校验。':
    'Execute this player? The rules engine will validate the action again.',
  无人死亡: 'No Death',
  夜间死亡: 'Night Death',
  宣布黎明: 'Announce Dawn',
  '宣布黎明，进入白天': 'Announce Dawn and Begin the Day',
  '跳过 CG，进入白天': 'Skip CG and Begin the Day',
  黎明将至: 'Dawn Approaches',
  点击画面或按空格播放下一幕:
    'Click the image or press Space for the next scene',
  正在载入黎明序列: 'Loading dawn sequence',
  黎明剧情动画: 'Dawn cinematic',
  场景转场动画: 'Scene transition',
  跳过动画: 'Skip Animation',
  游戏日志: 'Game Log',
  条: 'events',
  下一步: 'Next',
  角色能力表: 'Character Reference',
  搜索角色或能力: 'Search characters or abilities',
  全部类型: 'All Types',
  首夜顺序: 'First Night Order',
  其他夜: 'Other Nights',
  夜晚工作台: 'Night Workbench',
  生成本夜队列: 'Generate Night Queue',
  进入首夜或夜晚后可执行队列: 'Enter First Night or Night to run the queue',
  '进入首夜或夜晚后可执行队列。当前显示完整参考顺序。':
    'Enter First Night or Night to run the queue. The complete reference order is shown.',
  本夜流程已完成: 'Night sequence complete',
  当前阵营建议: 'Current Alignment Suggestion',
  选择一名存活玩家: 'Choose a living player',
  选择一名存活爪牙: 'Choose a living Minion',
  选择一个合法目标: 'Choose one legal target',
  确认一个合法目标: 'Confirm one legal target',
  确认两个合法目标: 'Confirm two legal targets',
  跳过: 'Skip',
  完成并唤醒下一位: 'Complete & Wake Next',
  说书人备注: 'Storyteller Notes',
  '说书人备注（不会自动发送给玩家）':
    'Storyteller notes (not sent to the player)',
  '必填：发送给该玩家的夜间结果': 'Required: night result sent to this player',
  玩家已提交: 'Player Submitted',
  玩家已提交目标: 'Player submitted targets',
  '玩家已提交目标，等待说书人确认。':
    'Targets submitted; waiting for Storyteller confirmation.',
  '玩家端选择已同步到这里，请核对后完成本步骤。':
    'The player selection is synced here. Verify it before completing this step.',
  '玩家端确认已阅读完整魔典，正在等待你完成并唤醒下一位。':
    'The player has reviewed the Grimoire and is waiting for you to complete this step.',
  选择展示给玩家的信息: 'Choose the information shown to the player',
  第一排: 'First row',
  第二排: 'Second row',
  '第一排：选择一名': 'First row: choose one',
  '第二排：从所有玩家中选择干扰项':
    'Second row: choose a decoy from all players',
  '第一排确定真实角色，第二排选择干扰玩家':
    'The first row sets the true character; the second selects a decoy player',
  不能与第一排选择同一名玩家:
    'Cannot be the same player selected in the first row',
  本局没有: 'None in play',
  本局没有外来者: 'There are no Outsiders in play',
  '图书管理员信息：本局没有外来者。':
    'Librarian information: no Outsiders are in play.',
  相邻邪恶玩家配对数量: 'Adjacent evil player pairs',
  选择告知厨师的配对数量: 'Choose the pair count shown to the Chef',
  厨师玩家将收到: 'The Chef will receive',
  当前魔典按真实阵营计算: 'Current true-alignment calculation',
  '如厨师醉酒、中毒，或你决定让间谍、隐士进行不同登记，可选择其他数字。':
    'Choose another number if the Chef is drunk or poisoned, or if the Spy or Recluse should register differently.',
  '完成上方选择后，这里会生成私密信息预览。':
    'Complete the choices above to preview the private information.',
  '选择数字后，这里会生成私密信息预览。':
    'Choose a number to preview the private information.',
  玩家将收到: 'The player will receive',
  黎明死亡结果: 'Dawn Death Result',
  转移死亡: 'Redirect Death',
  转移给: 'Redirect to',
  小恶魔自刀后的新恶魔: 'New Demon after Imp self-kill',
  说书人确认本夜无人死亡: 'Storyteller confirms no death tonight',
  '市长受到恶魔攻击：请明确选择市长死亡、转移给另一名玩家，或无人死亡。':
    'The Mayor was attacked: choose the Mayor’s death, redirect it, or choose no death.',
  '规则建议：本次攻击应无人死亡。目标可能受到保护，或相关能力因醉酒/中毒失效。':
    'Rules suggestion: this attack should cause no death. The target may be protected, or an ability may be drunk or poisoned.',
  生成当前建议: 'Generate Suggestions',
  '生成建议后，会在这里逐页显示。':
    'Generated suggestions will appear here page by page.',
  暂无待确认内容: 'Nothing awaiting confirmation',
  确认本页建议: 'Confirm This Suggestion',
  '← 上一页': '← Previous',
  '下一页 →': 'Next →',
  '建议不会自动修改游戏，也不会直接发送给玩家；只有说书人确认后才可执行。':
    'Suggestions never modify the game or message players automatically. The Storyteller must confirm them.',
  游戏复盘: 'Game Review',
  最终身份: 'Final Identities',
  公开时间线: 'Public Timeline',
  声音: 'Sound',
  静音: 'Muted',
  关闭房间音乐: 'Turn Room Music Off',
  打开房间音乐: 'Turn Room Music On',
  请求失败: 'Request failed',
  导出失败: 'Export failed',
  释放房间失败: 'Failed to release room',
  '会话已失效，请重新加入。': 'Session expired. Please join again.',
  '说书人会话尚未建立。': 'Storyteller session has not been established.',
  '连接尚未恢复，请稍后再试。':
    'The connection has not recovered. Please try again shortly.',
  在线: 'Online',
  未连接: 'Disconnected',
  举手: 'Yes',
  未举手: 'No',
  票: 'votes',
  当前: 'Current',
  已选择: 'Selected',
  已使用: 'Used',
  已触发: 'Triggered',
  已由说书人确认: 'Confirmed by Storyteller',
  已撤销上一操作: 'Last action undone',
  已重做操作: 'Action redone',
  玩家已提交夜间行动: 'Player submitted a night action',
  玩家座位顺序已更新: 'Player seating order updated',
  房间已创建: 'Room created',
  正在载入: 'Loading',
  名玩家: 'players',
  '号 ·': ' ·',
  '（已死亡）': ' (dead)',
  '本局没有外来者。': 'There are no Outsiders in play.',
  '以为自己是一个不在场镇民，但实际上没有该能力。':
    'Believes they are an out-of-play Townsfolk character, but has no such ability.',
  '首夜得知两名玩家中有一名是指定镇民。':
    'On the first night, learn that one of two players is a specific Townsfolk character.',
  '首夜得知两名玩家中有一名是指定外来者，或得知没有外来者。':
    'On the first night, learn that one of two players is a specific Outsider, or that none are in play.',
  '首夜得知两名玩家中有一名是指定爪牙。':
    'On the first night, learn that one of two players is a specific Minion.',
  '首夜得知相邻邪恶玩家的配对数量。':
    'On the first night, learn how many pairs of evil players are adjacent.',
  '每夜得知两侧最近存活邻座中邪恶玩家的数量。':
    'Each night, learn how many of your two nearest living neighbors are evil.',
  '每夜选择两名玩家，得知其中是否存在恶魔；一名善良玩家会被当作恶魔。':
    'Each night, choose two players and learn whether either is a Demon. One good player registers as a Demon.',
  '除首夜外，得知当天死于处决玩家的角色。':
    'Each night except the first, learn the character of the player executed today.',
  '除首夜外选择另一名玩家，使其当夜免受恶魔攻击。':
    'Each night except the first, choose another player: they are safe from the Demon tonight.',
  '若在夜晚死亡，可选择一名玩家并得知其角色。':
    'If you die at night, choose a player and learn their character.',
  '首次被镇民提名时，提名者可能立即被处决。':
    'The first time you are nominated by a Townsfolk, the nominator may be executed immediately.',
  '每局一次，白天公开选择一名玩家；若目标是恶魔，目标死亡。':
    'Once per game during the day, publicly choose a player: if they are the Demon, they die.',
  '存活且有能力时，不会因恶魔攻击死亡。':
    'While alive and able, you cannot die from a Demon attack.',
  '可能转移夜间死亡；三人存活且白天无人被处决时可能使善良获胜。':
    'A night death may be redirected. With three alive and no execution, Good may win.',
  '每夜选择主人，白天只能在主人投票时投票。':
    'Each night, choose a master. Tomorrow, you may vote only when they vote.',
  '可能被当作邪恶角色或恶魔，即使已经死亡。':
    'You may register as evil or as a Demon, even while dead.',
  '若死于处决，邪恶阵营获胜。': 'If you die by execution, Evil wins.',
  '每夜选择一名玩家，使其能力失效至次日黄昏。':
    'Each night, choose a player: their ability is poisoned until dusk.',
  '每夜查看魔典，并可能被当作善良镇民。':
    'Each night, view the Grimoire. You might register as a good Townsfolk.',
  '五名或更多玩家存活时，恶魔死亡可能令其成为新的恶魔。':
    'If five or more players are alive and the Demon dies, you may become the Demon.',
  '设置时增加两名外来者并减少两名镇民。':
    'During setup, add two Outsiders and remove two Townsfolk.',
  '除首夜外选择一名玩家死亡；选择自己时可能由爪牙继承恶魔身份。':
    'Each night except the first, choose a player: they die. Choosing yourself may pass the Demon to a Minion.',
  是: 'Yes',
  否: 'No',
  对: 'pairs',
  白天: 'Day',
  玩家: 'Player',
  '玩家。': 'player.',
  主人: 'Master',
  得知: 'Learns',
  查看魔典: 'View Grimoire',
  身份已隐藏: 'Identity Hidden',
  等待身份: 'Waiting for Identity',
  已设置恶魔伪装角色: 'Demon bluffs set',
  '补足至 7 人测试阵容': 'Fill to a 7-player test setup',
  房间现场: 'Live Room',
  服务端权威: 'Server Authoritative',
  确认全员已查看身份: 'Confirm everyone has viewed their identity',
  请选择不在场镇民: 'Choose an out-of-play Townsfolk character',
  关闭说书人确认: 'Close Storyteller Confirmation',
  通过规则引擎执行: 'Executed by the rules engine',
  间谍已查看魔典并提交: 'Spy reviewed and submitted the Grimoire',
  请选择说书人裁定: 'Choose the Storyteller ruling',
  该玩家的角色将作为展示角色:
    "This player's character will be the character shown",
  夜间遭到恶魔攻击: 'Attacked by the Demon at night',
  '确认善良阵营获胜并结束游戏？': 'Confirm a Good victory and end the game?',
  '确认邪恶阵营获胜并结束游戏？': 'Confirm an Evil victory and end the game?',
  你仍保留一次死亡投票权: 'You still have one dead vote',
  你的死亡投票权已使用: 'Your dead vote has been used',
  等待说书人信息: 'Waiting for Storyteller information',
  选择一个在场镇民和一个干扰玩家:
    'Choose an in-play Townsfolk and a decoy player',
  向洗衣妇展示两名玩家及该镇民角色:
    'Show the Washerwoman two players and the Townsfolk character',
  选择一个在场外来者和一个干扰玩家:
    'Choose an in-play Outsider and a decoy player',
  没有外来者时给出零信息: 'Give zero information when no Outsider is in play',
  选择一个在场爪牙和一个干扰玩家: 'Choose an in-play Minion and a decoy player',
  向调查员展示两名玩家及该爪牙角色:
    'Show the Investigator two players and the Minion character',
  按环形座位统计相邻邪恶配对:
    'Count adjacent evil pairs around the seating circle',
  考虑可被误登记的角色后给出数字:
    'Give a number after considering characters that may misregister',
  寻找两侧最近的存活玩家: 'Find the nearest living player on each side',
  考虑误登记与失能后给出数字:
    'Give a number after considering misregistration and malfunction',
  按恶魔与红鲱鱼标记给出是或否:
    'Answer yes or no based on the Demon and Red Herring',
  确认当天是否有人死于处决: 'Confirm whether anyone died by execution today',
  '展示其角色；失能时可给出错误角色':
    'Show their character; false information may be given if malfunctioning',
  让僧侣选择一名其他存活玩家: 'Have the Monk choose another living player',
  放置保护标记并在黎明移除: 'Place a protection marker and remove it at dawn',
  仅在当夜死亡时唤醒: 'Wake only if they died that night',
  '记录目标并展示角色；失能时可给出错误角色':
    'Record the target and show a character; false information may be given if malfunctioning',
  首次被提名时检查提名者登记:
    'Check the nominator registration on the first nomination',
  若触发则立即结算提名者处决:
    'If triggered, immediately resolve the nominator’s execution',
  确认能力尚未使用: 'Confirm the ability has not been used',
  记录公开目标并处理恶魔登记:
    'Record the public target and resolve Demon registration',
  恶魔选择士兵时检查失能状态:
    'Check malfunction state when the Demon chooses the Soldier',
  若能力有效则不标记死亡: 'Do not mark dead if the ability works',
  恶魔攻击时可选择合法的死亡转移:
    'A legal death redirect may be chosen during a Demon attack',
  三人局无处决时确认是否触发胜利:
    'With three players and no execution, confirm whether victory triggers',
  让管家选择一名其他玩家: 'Have the Butler choose another player',
  投票时提示主人限制: 'Enforce the Master restriction when voting',
  按该角色流程唤醒并提供可控信息:
    'Wake according to this character’s procedure and provide controlled information',
  每次被能力检测时决定本次登记:
    'Choose how this character registers each time an ability detects them',
  记录裁量理由以便复盘: 'Record the ruling reason for review',
  处决结算时检查角色与失能:
    'Check the character and malfunction during execution resolution',
  触发时由说书人确认游戏结束:
    'The Storyteller confirms game over when this triggers',
  移除旧中毒并放置持续至黄昏的新效果:
    'Remove the old poison and apply a new effect lasting until dusk',
  确保私密展示完整魔典: 'Ensure the full Grimoire is shown privately',
  能力检测时由说书人决定本次登记:
    'The Storyteller chooses this registration when an ability checks it',
  恶魔死亡时计算存活人数: 'Count living players when the Demon dies',
  若条件成立则更换角色与阵营并继续游戏:
    'If the condition is met, change character and alignment and continue play',
  分配角色时应用人数修正:
    'Apply player-count setup modifications during assignment',
  确认角色构成仍与总人数一致:
    'Confirm the character setup still matches the player count',
  处理保护士兵与裁量死亡:
    'Resolve protection, Soldier, and discretionary deaths',
  '处理保护、士兵与裁量死亡':
    'Resolve protection, Soldier, and discretionary deaths',
  自杀时检查是否可传位: 'Check whether succession is possible on self-kill',
  死亡玩家不能发起提名: 'Dead players cannot nominate',
  你已完成本轮投票: 'You have completed this vote',
  等待你的主人先投赞成票: 'Waiting for your Master to vote yes first',
  加入房间: 'joined the room',
  离开房间: 'left the room',
  已连接: 'connected',
  修改了昵称: 'changed their name',
  更新了经验等级: 'updated their experience level',
  移至: 'moved to',
  号座位: 'seat',
  已分配身份: 'characters assigned',
  的身份已调整为: "'s identity changed to",
  已向: 'sent to',
  '发送私密信息：': 'private information:',
  投票结算: 'Vote resolved',
  被处决: 'was executed',
  的: "'s",
  状态变为: 'status changed to',
  '添加状态：': 'added status:',
  移除状态: 'removed status',
  '添加提醒：': 'added reminder:',
  移除提醒: 'removed reminder',
  第: 'Day ',
  '夜行动队列已生成（': 'night action queue generated (',
  '步）': ' steps)',
  '夜晚步骤更新：': 'Night step updated:',
  计时器已更新: 'Timer updated',
  黎明剧情第: 'Dawn scene ',
  幕: '',
  '信息：': ' information:',
  号: '',
  中有一位是: ' includes one ',
  '厨师信息：相邻邪恶玩家共有': 'Chef information: adjacent evil players form ',
  阵营: 'Team',
  请选择: 'Choose ',
  '名玩家。你的选择只会发送给说书人。':
    ' players. Your choice is sent only to the Storyteller.',
  阵营获胜结局: 'team victory ending',
  '结局 CG': 'ending CG',
  规则检查: 'Rules Check',
  当前票数: 'Current vote count',
  '；请在结算前确认所有有效票已同步。':
    '; confirm all valid votes are synced before resolving.',
  当前阶段为: 'Current phase:',
  '，所有实际操作仍须通过规则引擎校验。':
    '. All actions still require rules-engine validation.',
  节奏建议: 'Pacing Suggestion',
  '讨论已经展开，可在玩家观点开始重复时开放提名。':
    'Discussion is underway. Open nominations when player arguments begin to repeat.',
  '在推进阶段前，留出一次清晰的口头确认。':
    'Allow one clear verbal confirmation before advancing the phase.',
  平衡观察: 'Balance Note',
  '名玩家存活；避免用额外提示补偿单一阵营。':
    ' players are alive; avoid compensating either team with extra hints.',
  体验照顾: 'Player Experience',
  房间内有: 'There are ',
  '名新玩家，建议在操作前复述一次公开流程。':
    ' new players; restate the public procedure before acting.',
  '玩家较熟悉流程，可以减少重复说明。':
    'The players know the procedure; repeated explanations can be reduced.',
  戏剧节拍: 'Dramatic Beat',
  '公布结果前停顿片刻，并先复述公开票型；不要添加未确认的私密信息。':
    'Pause before announcing the result and restate the public vote. Do not add unconfirmed private information.',
  复盘线索: 'Review Notes',
  已记录: 'Recorded ',
  '个公开事件节点，可在结束后按阶段复盘关键转折。':
    ' public events; review key turns by phase after the game.',
  风险提醒: 'Risk Warning',
  '存在未关闭的提名；推进阶段前先完成投票与结算。':
    'A nomination remains open. Finish voting and resolution before advancing.',
  '未发现待结算提名。仍请在危险操作前由说书人确认。':
    'No unresolved nomination found. The Storyteller should still confirm risky actions.',
  消息格式无效: 'Invalid message format',
  操作失败: 'Action failed',
  房间码不能为空: 'Room code is required',
  该房间码已存在: 'This room code already exists',
  昵称不能为空: 'A display name is required',
  '该座位已绑定设备，请使用原设备重连。':
    'This seat is bound to another device. Reconnect from the original device.',
  '游戏已开始，只能恢复已有座位。':
    'The game has started. Only existing seats may reconnect.',
  会话无效或已过期: 'Session is invalid or expired',
  只有说书人可以释放房间: 'Only the Storyteller can release the room',
  房间已由说书人释放: 'The Storyteller released the room',
  状态已更新: 'State updated',
  '），请基于最新状态重试。': '); retry using the latest state.',
  只有说书人可以导出游戏: 'Only the Storyteller can export the game',
  只有说书人可以导入游戏: 'Only the Storyteller can import a game',
  '导入文件版本、剧本或房间码不匹配。':
    'The imported version, script, or room code does not match.',
  座位绑定已由说书人解除: 'The Storyteller unbound this seat',
  '请先为酒鬼选择一个不在场镇民身份。':
    'Choose an out-of-play Townsfolk character for the Drunk first.',
  '请先完成或跳过本夜全部行动，再进入白天。':
    'Complete or skip every night action before beginning the day.',
  酒鬼伪装身份: 'Drunk perceived character',
  '酒鬼只能以一个不在场的镇民身份示人。':
    'The Drunk must appear as an out-of-play Townsfolk character.',
  你的身份是: 'Your character is',
  身份已由说书人确认: 'Identity confirmed by the Storyteller',
  '你已确认邪恶同伴：': 'Your confirmed evil teammates:',
  当前没有需要展示的邪恶同伴: 'No evil teammates need to be shown',
  '不在场角色：': 'Out-of-play characters:',
  夜间结果: 'Night Result',
  撤销与重做必须从顶层命令执行:
    'Undo and redo must be executed as top-level commands',
  建议不存在: 'Suggestion not found',
  必须先由说书人确认该建议:
    'The Storyteller must confirm this suggestion first',
  'AI 建议不能调用 AI 控制命令。':
    'AI suggestions cannot invoke AI control commands.',
  说书人命令不受支持: 'Unsupported Storyteller command',
  当前没有等待你提交的夜间行动:
    'No night action is currently awaiting your submission',
  玩家无权执行该操作: 'The player is not allowed to perform this action',
  房间不存在: 'Room not found',
  没有可以撤销的操作: 'There is no action to undo',
  没有可以重做的操作: 'There is no action to redo',
};

const REPLACEMENTS = Object.entries(TRANSLATIONS).sort(
  ([left], [right]) => right.length - left.length,
);

export function translateText(value: string) {
  if (!CHINESE_PATTERN.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  const source = value.trim();
  const exact = TRANSLATIONS[source];
  if (exact) return `${leading}${exact}${trailing}`;

  let result = source;
  for (const [chinese, english] of REPLACEMENTS) {
    result = result.split(chinese).join(english);
  }
  return `${leading}${result}${trailing}`;
}

function translateTree(
  root: ParentNode,
  originalText: Map<Text, string>,
  originalAttributes: Map<Element, Map<string, string>>,
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const text = current as Text;
    const parent = text.parentElement;
    if (
      parent &&
      !['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName) &&
      CHINESE_PATTERN.test(text.data)
    ) {
      originalText.set(text, text.data);
      text.data = translateText(text.data);
    }
    current = walker.nextNode();
  }

  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll('*')]
      : [...root.querySelectorAll('*')];
  for (const element of elements) {
    for (const attribute of ['alt', 'aria-label', 'placeholder', 'title']) {
      const value = element.getAttribute(attribute);
      if (!value || !CHINESE_PATTERN.test(value)) continue;
      const attributes =
        originalAttributes.get(element) ?? new Map<string, string>();
      attributes.set(attribute, value);
      originalAttributes.set(element, attributes);
      element.setAttribute(attribute, translateText(value));
    }
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(
    () => (localStorage.getItem(LANGUAGE_KEY) as Locale | null) ?? 'zh',
  );
  const originalText = useRef(new Map<Text, string>());
  const originalAttributes = useRef(new Map<Element, Map<string, string>>());

  const setLocale = (nextLocale: Locale) => {
    localStorage.setItem(LANGUAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === LANGUAGE_KEY &&
        (event.newValue === 'en' || event.newValue === 'zh')
      ) {
        setLocaleState(event.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    const textRecords = originalText.current;
    const attributeRecords = originalAttributes.current;

    if (locale === 'zh') {
      for (const [node, value] of textRecords) {
        if (node.isConnected) node.data = value;
      }
      for (const [element, attributes] of attributeRecords) {
        if (!element.isConnected) continue;
        for (const [name, value] of attributes) {
          element.setAttribute(name, value);
        }
      }
      textRecords.clear();
      attributeRecords.clear();
      return;
    }

    const observerOptions: MutationObserverInit = {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['alt', 'aria-label', 'placeholder', 'title'],
    };
    let scheduledFrame = 0;
    const observer = new MutationObserver(() => {
      if (scheduledFrame) return;
      scheduledFrame = window.requestAnimationFrame(() => {
        scheduledFrame = 0;
        observer.disconnect();
        translateTree(document.body, textRecords, attributeRecords);
        observer.observe(document.body, observerOptions);
      });
    });

    translateTree(document.body, textRecords, attributeRecords);
    observer.observe(document.body, observerOptions);

    const nativeConfirm = window.confirm.bind(window);
    window.confirm = (message?: string) =>
      nativeConfirm(translateText(message ?? ''));

    return () => {
      observer.disconnect();
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
      window.confirm = nativeConfirm;
    };
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="language-toggle" aria-label="Language">
      <button
        type="button"
        className={locale === 'en' ? 'active' : ''}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
      <span>|</span>
      <button
        type="button"
        className={locale === 'zh' ? 'active' : ''}
        aria-pressed={locale === 'zh'}
        onClick={() => setLocale('zh')}
      >
        ZH
      </button>
    </div>
  );
}
