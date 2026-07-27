import type { CharacterId, RoleDefinition } from '@clocktower/shared';

import {
  TROUBLE_BREWING_ROLES,
  type TroubleBrewingRole,
} from './trouble-brewing.js';

type RoleCopy = Pick<
  RoleDefinition,
  'name' | 'summary' | 'storytellerSteps' | 'reminderLabels'
>;

const COPY: Record<CharacterId, RoleCopy> = {
  washerwoman: {
    name: '洗衣妇',
    summary: '首夜得知两名玩家中有一名是指定镇民。',
    storytellerSteps: [
      '选择一个在场镇民和一个干扰玩家',
      '向洗衣妇展示两名玩家及该镇民角色',
    ],
    reminderLabels: ['得知'],
  },
  librarian: {
    name: '图书管理员',
    summary: '首夜得知两名玩家中有一名是指定外来者，或得知没有外来者。',
    storytellerSteps: [
      '选择一个在场外来者和一个干扰玩家',
      '没有外来者时给出零信息',
    ],
    reminderLabels: ['得知'],
  },
  investigator: {
    name: '调查员',
    summary: '首夜得知两名玩家中有一名是指定爪牙。',
    storytellerSteps: [
      '选择一个在场爪牙和一个干扰玩家',
      '向调查员展示两名玩家及该爪牙角色',
    ],
    reminderLabels: ['得知'],
  },
  chef: {
    name: '厨师',
    summary: '首夜得知相邻邪恶玩家的配对数量。',
    storytellerSteps: [
      '按环形座位统计相邻邪恶配对',
      '考虑可被误登记的角色后给出数字',
    ],
    reminderLabels: [],
  },
  empath: {
    name: '共情者',
    summary: '每夜得知两侧最近存活邻座中邪恶玩家的数量。',
    storytellerSteps: ['寻找两侧最近的存活玩家', '考虑误登记与失能后给出数字'],
    reminderLabels: [],
  },
  fortune_teller: {
    name: '占卜师',
    summary:
      '每夜选择两名玩家，得知其中是否存在恶魔；一名善良玩家会被当作恶魔。',
    storytellerSteps: ['确认两个合法目标', '按恶魔与红鲱鱼标记给出是或否'],
    reminderLabels: ['红鲱鱼'],
  },
  undertaker: {
    name: '掘墓人',
    summary: '除首夜外，得知当天死于处决玩家的角色。',
    storytellerSteps: [
      '确认当天是否有人死于处决',
      '展示其角色；失能时可给出错误角色',
    ],
    reminderLabels: ['今日处决'],
  },
  monk: {
    name: '僧侣',
    summary: '除首夜外选择另一名玩家，使其当夜免受恶魔攻击。',
    storytellerSteps: [
      '让僧侣选择一名其他存活玩家',
      '放置保护标记并在黎明移除',
    ],
    reminderLabels: ['保护'],
  },
  ravenkeeper: {
    name: '守鸦人',
    summary: '若在夜晚死亡，可选择一名玩家并得知其角色。',
    storytellerSteps: [
      '仅在当夜死亡时唤醒',
      '记录目标并展示角色；失能时可给出错误角色',
    ],
    reminderLabels: ['夜间死亡'],
  },
  virgin: {
    name: '贞洁者',
    summary: '首次被镇民提名时，提名者可能立即被处决。',
    storytellerSteps: [
      '首次被提名时检查提名者登记',
      '若触发则立即结算提名者处决',
    ],
    reminderLabels: ['已触发'],
  },
  slayer: {
    name: '猎手',
    summary: '每局一次，白天公开选择一名玩家；若目标是恶魔，目标死亡。',
    storytellerSteps: ['确认能力尚未使用', '记录公开目标并处理恶魔登记'],
    reminderLabels: ['已使用'],
  },
  soldier: {
    name: '士兵',
    summary: '存活且有能力时，不会因恶魔攻击死亡。',
    storytellerSteps: ['恶魔选择士兵时检查失能状态', '若能力有效则不标记死亡'],
    reminderLabels: [],
  },
  mayor: {
    name: '市长',
    summary: '可能转移夜间死亡；三人存活且白天无人被处决时可能使善良获胜。',
    storytellerSteps: [
      '恶魔攻击时可选择合法的死亡转移',
      '三人局无处决时确认是否触发胜利',
    ],
    reminderLabels: ['转移死亡'],
  },
  butler: {
    name: '管家',
    summary: '每夜选择主人，白天只能在主人投票时投票。',
    storytellerSteps: ['让管家选择一名其他玩家', '投票时提示主人限制'],
    reminderLabels: ['主人'],
  },
  drunk: {
    name: '酒鬼',
    summary: '以为自己是一个不在场镇民，但实际上没有该能力。',
    storytellerSteps: [
      '为酒鬼选择一个不在场镇民伪装',
      '按该角色流程唤醒并提供可控信息',
    ],
    reminderLabels: ['以为是'],
  },
  recluse: {
    name: '隐士',
    summary: '可能被当作邪恶角色或恶魔，即使已经死亡。',
    storytellerSteps: ['每次被能力检测时决定本次登记', '记录裁量理由以便复盘'],
    reminderLabels: ['误登记'],
  },
  saint: {
    name: '圣徒',
    summary: '若死于处决，邪恶阵营获胜。',
    storytellerSteps: [
      '处决结算时检查角色与失能',
      '触发时由说书人确认游戏结束',
    ],
    reminderLabels: [],
  },
  poisoner: {
    name: '投毒者',
    summary: '每夜选择一名玩家，使其能力失效至次日黄昏。',
    storytellerSteps: [
      '选择一名存活玩家',
      '移除旧中毒并放置持续至黄昏的新效果',
    ],
    reminderLabels: ['中毒'],
  },
  spy: {
    name: '间谍',
    summary: '每夜查看魔典，并可能被当作善良镇民。',
    storytellerSteps: [
      '确保私密展示完整魔典',
      '能力检测时由说书人决定本次登记',
    ],
    reminderLabels: ['误登记'],
  },
  scarlet_woman: {
    name: '红唇女郎',
    summary: '五名或更多玩家存活时，恶魔死亡可能令其成为新的恶魔。',
    storytellerSteps: [
      '恶魔死亡时计算存活人数',
      '若条件成立则更换角色与阵营并继续游戏',
    ],
    reminderLabels: ['继承恶魔'],
  },
  baron: {
    name: '男爵',
    summary: '设置时增加两名外来者并减少两名镇民。',
    storytellerSteps: ['分配角色时应用人数修正', '确认角色构成仍与总人数一致'],
    reminderLabels: [],
  },
  imp: {
    name: '小恶魔',
    summary: '除首夜外选择一名玩家死亡；选择自己时可能由爪牙继承恶魔身份。',
    storytellerSteps: [
      '确认一个合法目标',
      '处理保护、士兵与裁量死亡',
      '自杀时检查是否可传位',
    ],
    reminderLabels: ['死亡'],
  },
};

export const TROUBLE_BREWING_ROLE_DEFINITIONS: readonly RoleDefinition[] =
  TROUBLE_BREWING_ROLES.map((role: TroubleBrewingRole) => ({
    ...role,
    ...COPY[role.id],
  }));

const DEFINITIONS_BY_ID = new Map(
  TROUBLE_BREWING_ROLE_DEFINITIONS.map((role) => [role.id, role]),
);

export function getTroubleBrewingRoleDefinition(
  characterId: CharacterId,
): RoleDefinition | undefined {
  return DEFINITIONS_BY_ID.get(characterId);
}
