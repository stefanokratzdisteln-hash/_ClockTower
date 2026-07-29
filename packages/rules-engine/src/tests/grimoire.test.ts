import { describe, expect, it } from 'vitest';

import {
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  addPlayer,
  addReminderToken,
  addStatusEffect,
  autoAssignTroubleBrewingCharactersToGame,
  createRoom,
  prepareNightQueue,
  transitionGamePhase,
  updateNightStep,
} from '../index.js';

function assignedGame() {
  let state = createRoom({
    id: 'grimoire-test',
    scriptId: 'trouble-brewing',
  });
  for (let index = 0; index < 7; index += 1) {
    state = addPlayer(state, {
      id: `p${index + 1}`,
      name: `玩家${index + 1}`,
    });
  }
  state = transitionGamePhase(state, 'setup_players');
  state = transitionGamePhase(state, 'assign_characters');
  return autoAssignTroubleBrewingCharactersToGame(state, {
    random: () => 0.17,
  });
}

describe('full grimoire state', () => {
  it('publishes all 22 roles with original summaries and storyteller steps', () => {
    expect(TROUBLE_BREWING_ROLE_DEFINITIONS).toHaveLength(22);
    expect(
      new Set(TROUBLE_BREWING_ROLE_DEFINITIONS.map(({ id }) => id)).size,
    ).toBe(22);
    for (const role of TROUBLE_BREWING_ROLE_DEFINITIONS) {
      expect(role.name.length).toBeGreaterThan(0);
      expect(role.summary.length).toBeGreaterThan(8);
      expect(role.storytellerSteps.length).toBeGreaterThan(0);
    }
  });

  it('tracks structured effects and expires dawn effects on day transition', () => {
    let state = assignedGame();
    state = addStatusEffect(state, {
      id: 'protected',
      playerId: 'p1',
      kind: 'protected',
      label: '保护',
      sourceRoleId: 'monk',
      expiresAt: 'dawn',
    });
    state = addReminderToken(state, {
      id: 'note',
      playerId: 'p1',
      label: '说书人提醒',
      visibility: 'storyteller',
    });
    expect(state.effects).toHaveLength(1);
    expect(state.reminderTokens).toHaveLength(1);
    expect(
      state.assignments.find(({ playerId }) => playerId === 'p1')?.status
        .protected,
    ).toBe(true);

    state = transitionGamePhase(state, 'private_reveal');
    state = transitionGamePhase(state, 'first_night');
    state = transitionGamePhase(state, 'day_discussion');
    expect(state.effects).toHaveLength(0);
    expect(
      state.assignments.find(({ playerId }) => playerId === 'p1')?.status
        .protected,
    ).toBe(false);
  });

  it('creates and advances a deterministic first-night queue', () => {
    let state = assignedGame();
    state = transitionGamePhase(state, 'private_reveal');
    state = transitionGamePhase(state, 'first_night');
    state = prepareNightQueue(state);
    expect(state.nightQueue.length).toBeGreaterThan(0);
    expect(state.nightQueue[0]?.status).toBe('active');
    const first = state.nightQueue[0]!;
    state = updateNightStep(state, {
      stepId: first.id,
      status: 'completed',
      resultSummary: '已完成',
    });
    expect(state.nightQueue[0]?.status).toBe('completed');
    expect(
      state.nightQueue.slice(1).some(({ status }) => status === 'active'),
    ).toBe(true);
  });

  it('atomically records an Imp target and kills the confirmed night victim', () => {
    let state = { ...assignedGame(), phase: 'night' as const, dayNumber: 1 };
    const imp = state.assignments.find(
      ({ characterId }) => characterId === 'imp',
    )!;
    const victim = state.assignments.find(
      ({ playerId, characterId }) =>
        playerId !== imp.playerId &&
        characterId !== 'mayor' &&
        characterId !== 'soldier',
    )!;
    state = prepareNightQueue(state);
    while (
      state.nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'imp'
    ) {
      const active = state.nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      state = updateNightStep(state, {
        stepId: active.id,
        status: 'skipped',
      });
    }
    const attack = state.nightQueue.find(({ status }) => status === 'active')!;
    state = updateNightStep(state, {
      stepId: attack.id,
      status: 'completed',
      targetIds: [victim.playerId],
      deathOutcome: {
        type: 'death',
        playerId: victim.playerId,
        reason: '夜间遭到恶魔攻击',
      },
    });

    expect(
      state.assignments.find(({ playerId }) => playerId === victim.playerId)
        ?.status,
    ).toMatchObject({ alive: false, deadVoteAvailable: true });
    expect(state.events.at(-1)).toMatchObject({
      type: 'PLAYER_DIED',
      playerId: victim.playerId,
      visibility: { scope: 'public' },
    });
  });

  it('inserts and activates the Ravenkeeper immediately after a night death', () => {
    let state = { ...assignedGame(), phase: 'night' as const, dayNumber: 1 };
    const imp = state.assignments.find(
      ({ characterId }) => characterId === 'imp',
    )!;
    const ravenkeeper = state.assignments.find(
      ({ playerId }) => playerId !== imp.playerId,
    )!;
    state.assignments = state.assignments.map((assignment) =>
      assignment.playerId === ravenkeeper.playerId
        ? { ...assignment, characterId: 'ravenkeeper', alignment: 'good' }
        : assignment,
    );
    state = prepareNightQueue(state);
    while (
      state.nightQueue.find(({ status }) => status === 'active')?.characterId !==
      'imp'
    ) {
      const active = state.nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      state = updateNightStep(state, {
        stepId: active.id,
        status: 'skipped',
      });
    }
    const attack = state.nightQueue.find(({ status }) => status === 'active')!;
    state = updateNightStep(state, {
      stepId: attack.id,
      status: 'completed',
      targetIds: [ravenkeeper.playerId],
      deathOutcome: {
        type: 'death',
        playerId: ravenkeeper.playerId,
      },
    });

    expect(
      state.nightQueue.find(({ status }) => status === 'active'),
    ).toMatchObject({
      playerId: ravenkeeper.playerId,
      characterId: 'ravenkeeper',
    });
  });

  it('does not wake a later-acting character after the Imp kills them', () => {
    let state = { ...assignedGame(), phase: 'night' as const, dayNumber: 1 };
    const imp = state.assignments.find(
      ({ characterId }) => characterId === 'imp',
    )!;
    const victim = state.assignments.find(
      ({ playerId }) => playerId !== imp.playerId,
    )!;
    state.assignments = state.assignments.map((assignment) =>
      assignment.playerId === victim.playerId
        ? { ...assignment, characterId: 'fortune_teller', alignment: 'good' }
        : assignment,
    );
    state = prepareNightQueue(state);
    while (
      state.nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'imp'
    ) {
      const active = state.nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      state = updateNightStep(state, {
        stepId: active.id,
        status: 'skipped',
      });
    }
    const attack = state.nightQueue.find(({ status }) => status === 'active')!;
    state = updateNightStep(state, {
      stepId: attack.id,
      status: 'completed',
      targetIds: [victim.playerId],
      deathOutcome: { type: 'death', playerId: victim.playerId },
    });

    expect(
      state.nightQueue.find(
        ({ playerId, characterId }) =>
          playerId === victim.playerId && characterId === 'fortune_teller',
      )?.status,
    ).toBe('skipped');
    expect(
      state.nightQueue.find(({ status }) => status === 'active')?.playerId,
    ).not.toBe(victim.playerId);
  });

  it('requires the Storyteller to confirm whether an Imp attack caused a death', () => {
    let state = { ...assignedGame(), phase: 'night' as const, dayNumber: 1 };
    state = prepareNightQueue(state);
    while (
      state.nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'imp'
    ) {
      const active = state.nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      state = updateNightStep(state, {
        stepId: active.id,
        status: 'skipped',
      });
    }
    const attack = state.nightQueue.find(({ status }) => status === 'active')!;
    const victimId = state.assignments.find(
      ({ playerId }) => playerId !== attack.playerId,
    )!.playerId;

    expect(() =>
      updateNightStep(state, {
        stepId: attack.id,
        status: 'completed',
        targetIds: [victimId],
      }),
    ).toThrowError(/confirm the Imp attack outcome/);
  });
});
