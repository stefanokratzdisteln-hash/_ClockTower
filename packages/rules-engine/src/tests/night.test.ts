import type { Assignment, GamePhase, GameState } from '@clocktower/shared';
import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../game-state.js';
import {
  calculateNightOrder,
  getCurrentNightActor,
  getNightOrder,
} from '../selectors/night-order.js';
import { selectPlayerView } from '../selectors/player-view.js';
import { TROUBLE_BREWING_ROLES } from '../scripts/trouble-brewing.js';
import {
  getLegalNightTargets,
  validateNightAction,
} from '../validators/action-validator.js';

function assignment(
  playerId: string,
  characterId: string,
  alive = true,
): Assignment {
  return {
    playerId,
    characterId,
    alignment:
      characterId === 'imp' || characterId === 'poisoner' ? 'evil' : 'good',
    status: {
      alive,
      drunk: false,
      poisoned: false,
      protected: false,
      deadVoteAvailable: !alive,
    },
    reminders: [],
  };
}

function nightState(phase: GamePhase): GameState {
  const roles = ['fortune_teller', 'imp', 'poisoner', 'monk', 'ravenkeeper'];
  return {
    ...createInitialGameState('game-night', 'trouble-brewing'),
    phase,
    players: roles.map((_, seatIndex) => ({
      id: `p${seatIndex + 1}`,
      name: `Player ${seatIndex + 1}`,
      seatIndex,
      experience: 'regular',
    })),
    assignments: roles.map((role, index) =>
      assignment(`p${index + 1}`, role, role !== 'ravenkeeper'),
    ),
  };
}

describe('night order', () => {
  it('uses first-night configuration and returns the next unfinished actor', () => {
    const state = nightState('first_night');

    expect(getNightOrder(state).map(({ characterId }) => characterId)).toEqual([
      'poisoner',
      'fortune_teller',
    ]);
    expect(getCurrentNightActor(state)?.characterId).toBe('poisoner');
    expect(getCurrentNightActor(state, ['p3'])?.characterId).toBe(
      'fortune_teller',
    );
  });

  it('uses other-night configuration and supports conditional wakeups', () => {
    const state = nightState('night');

    expect(getNightOrder(state).map(({ characterId }) => characterId)).toEqual([
      'poisoner',
      'monk',
      'imp',
      'fortune_teller',
    ]);
    expect(
      getNightOrder(state, { diedTonightPlayerIds: ['p5'] }).map(
        ({ characterId }) => characterId,
      ),
    ).toEqual(['poisoner', 'monk', 'imp', 'ravenkeeper', 'fortune_teller']);
  });

  it('sorts equal configured order by seat', () => {
    const state = nightState('first_night');
    const sameOrder = TROUBLE_BREWING_ROLES.map((role) =>
      role.id === 'fortune_teller' || role.id === 'poisoner'
        ? { ...role, firstNightOrder: 10 }
        : role,
    );
    expect(
      calculateNightOrder(state, sameOrder, 'firstNight').map(
        ({ playerId }) => playerId,
      ),
    ).toEqual(['p1', 'p3']);
  });

  it('matches the complete Trouble Brewing wake order without waking passive roles', () => {
    const state = createInitialGameState('all-roles', 'trouble-brewing');
    state.players = TROUBLE_BREWING_ROLES.map((role, seatIndex) => ({
      id: `all-${role.id}`,
      name: role.id,
      seatIndex,
      experience: 'regular',
    }));
    state.assignments = TROUBLE_BREWING_ROLES.map((role) =>
      assignment(`all-${role.id}`, role.id),
    );

    state.phase = 'first_night';
    expect(getNightOrder(state).map(({ characterId }) => characterId)).toEqual([
      'poisoner',
      'washerwoman',
      'librarian',
      'investigator',
      'chef',
      'empath',
      'fortune_teller',
      'butler',
      'spy',
    ]);

    state.phase = 'night';
    expect(getNightOrder(state).map(({ characterId }) => characterId)).toEqual([
      'poisoner',
      'monk',
      'imp',
      'undertaker',
      'empath',
      'fortune_teller',
      'butler',
      'spy',
    ]);
    expect(
      getNightOrder(state, {
        diedTonightPlayerIds: ['all-ravenkeeper'],
      }).map(({ characterId }) => characterId),
    ).toEqual([
      'poisoner',
      'monk',
      'imp',
      'ravenkeeper',
      'undertaker',
      'empath',
      'fortune_teller',
      'butler',
      'spy',
    ]);
  });

  it('wakes the Drunk as their configured out-of-play Townsfolk role', () => {
    const state = nightState('first_night');
    state.assignments[0] = {
      ...state.assignments[0]!,
      characterId: 'drunk',
      effects: [
        {
          id: 'drunk-belief',
          playerId: 'p1',
          kind: 'custom',
          label: '酒鬼伪装身份',
          sourceRoleId: 'fortune_teller',
          expiresAt: 'manual',
          createdAt: state.createdAt,
        },
      ],
    };

    expect(
      getNightOrder(state).find(({ playerId }) => playerId === 'p1'),
    ).toMatchObject({
      playerId: 'p1',
      characterId: 'fortune_teller',
    });
    expect(selectPlayerView(state, 'p1').self).toMatchObject({
      characterId: 'fortune_teller',
      alignment: 'good',
    });
    expect(validateNightAction(state, 'p1', ['p1', 'p2'])).toEqual({
      valid: true,
    });
  });
});

describe('night action validation', () => {
  it('calculates targets from abilityModel constraints', () => {
    const state = nightState('night');
    expect(getLegalNightTargets(state, 'p4')).toEqual([
      'p1',
      'p2',
      'p3',
      'p5',
    ]);
    expect(validateNightAction(state, 'p4', ['p1'])).toEqual({ valid: true });
    expect(validateNightAction(state, 'p4', ['p5'])).toEqual({ valid: true });
    expect(validateNightAction(state, 'p4', ['p4']).valid).toBe(false);
    expect(validateNightAction(state, 'p1', ['p2', 'p3'])).toEqual({
      valid: true,
    });
    expect(validateNightAction(state, 'p1', ['p1', 'p5'])).toEqual({
      valid: true,
    });
    expect(validateNightAction(state, 'p1', ['p2']).valid).toBe(false);
  });

  it('rejects duplicate, missing, and out-of-phase targets', () => {
    const state = nightState('night');
    expect(validateNightAction(state, 'p1', ['p2', 'p2']).valid).toBe(false);
    expect(validateNightAction(state, 'p3', []).valid).toBe(false);
    expect(validateNightAction(state, 'p3', ['p5']).valid).toBe(true);
    expect(
      validateNightAction({ ...state, phase: 'day_discussion' }, 'p3', ['p1'])
        .valid,
    ).toBe(false);
  });

  it('only enables conditional actors when their wake condition is supplied', () => {
    const state = nightState('night');
    expect(getLegalNightTargets(state, 'p5')).toEqual([]);
    expect(
      validateNightAction(state, 'p5', ['p1'], {
        diedTonightPlayerIds: ['p5'],
      }),
    ).toEqual({ valid: true });
  });
});
