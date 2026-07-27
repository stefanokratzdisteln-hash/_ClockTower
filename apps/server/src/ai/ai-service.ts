import type {
  AiSuggestion,
  AiSuggestionType,
  PublicRoomSummary,
} from '@clocktower/shared';

import { buildStorytellerSuggestionPrompt } from './storyteller-prompt.js';

const COPY: Record<
  AiSuggestionType,
  [string, (s: PublicRoomSummary) => string]
> = {
  RULE_HINT: [
    '规则检查',
    (s) =>
      s.openNomination
        ? `当前票数 ${s.openNomination.voteCount}/${s.openNomination.executionThreshold}；请在结算前确认所有有效票已同步。`
        : `当前阶段为 ${s.phase}，所有实际操作仍须通过规则引擎校验。`,
  ],
  PACE_HINT: [
    '节奏建议',
    (s) =>
      s.phase === 'day_discussion'
        ? '讨论已经展开，可在玩家观点开始重复时开放提名。'
        : '在推进阶段前，留出一次清晰的口头确认。',
  ],
  BALANCE_HINT: [
    '平衡观察',
    (s) =>
      `当前 ${s.aliveCount}/${s.playerCount} 名玩家存活；避免用额外提示补偿单一阵营。`,
  ],
  EXPERIENCE_HINT: [
    '体验照顾',
    (s) =>
      s.newPlayers > 0
        ? `房间内有 ${s.newPlayers} 名新玩家，建议在操作前复述一次公开流程。`
        : '玩家较熟悉流程，可以减少重复说明。',
  ],
  DRAMA_HINT: [
    '戏剧节拍',
    () => '公布结果前停顿片刻，并先复述公开票型；不要添加未确认的私密信息。',
  ],
  REVIEW_SUMMARY: [
    '复盘线索',
    (s) =>
      `已记录 ${s.publicEventTypes.length} 个公开事件节点，可在结束后按阶段复盘关键转折。`,
  ],
  RISK_WARNING: [
    '风险提醒',
    (s) =>
      s.openNomination
        ? '存在未关闭的提名；推进阶段前先完成投票与结算。'
        : '未发现待结算提名。仍请在危险操作前由说书人确认。',
  ],
};

/**
 * This boundary intentionally accepts no GameState and has no room-service
 * reference. An external model adapter can replace this deterministic MVP
 * implementation without gaining write access.
 */
export class ReadOnlyAiService {
  /**
   * Produces the exact prompt boundary for a future external model adapter.
   * The current MVP remains deterministic and does not make a network call.
   */
  buildPrompt(summary: Readonly<PublicRoomSummary>): string {
    return buildStorytellerSuggestionPrompt(summary);
  }

  suggest(summary: Readonly<PublicRoomSummary>): AiSuggestion[] {
    const input = Object.freeze({
      ...summary,
      publicEventTypes: Object.freeze([...summary.publicEventTypes]),
    });
    const now = new Date().toISOString();
    const nextPhase: Partial<
      Record<PublicRoomSummary['phase'], PublicRoomSummary['phase']>
    > = {
      lobby: 'setup_players',
      setup_players: 'assign_characters',
      assign_characters: 'private_reveal',
      private_reveal: 'first_night',
      first_night: 'day_discussion',
      day_discussion: 'nomination',
      nomination: 'voting',
      voting: 'execution_resolution',
      execution_resolution: 'night',
      night: 'day_discussion',
      game_over: 'review',
    };
    return (Object.keys(COPY) as AiSuggestionType[]).map((type, index) => {
      const [title, render] = COPY[type];
      const proposedPhase =
        type === 'PACE_HINT' ? nextPhase[input.phase] : undefined;
      return {
        id: `${input.id}:ai:${input.version}:${index + 1}`,
        type,
        title,
        body: render(input),
        createdAt: now,
        basedOnVersion: input.version,
        confirmed: false,
        ...(proposedPhase
          ? {
              proposedAction: {
                type: 'ADVANCE_PHASE' as const,
                to: proposedPhase,
              },
            }
          : {}),
      };
    });
  }
}
