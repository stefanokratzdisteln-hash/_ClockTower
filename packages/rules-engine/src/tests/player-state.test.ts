import type { Assignment, GameState } from '@clocktower/shared';
import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../game-state.js';
import {
  InvalidPlayerStateError,
  givePrivateInfo,
  setPlayerStatus,
} from '../player-state.js';

const occurredAt = '2026-07-27T10:00:00.000Z';

function stateWithPlayer(): GameState {
  const assignment: Assignment = {
    playerId: 'p1',
    characterId: 'washerwoman',
    alignment: 'good',
    status: {
      alive: true,
      drunk: false,
      poisoned: false,
      protected: false,
      deadVoteAvailable: false,
    },
    reminders: [],
  };
  return {
    ...createInitialGameState('game-state', 'trouble-brewing'),
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        seatIndex: 0,
        experience: 'new',
      },
    ],
    assignments: [assignment],
  };
}

describe('player state commands', () => {
  it.each([
    ['alive', false],
    ['drunk', true],
    ['poisoned', true],
    ['protected', true],
    ['deadVoteAvailable', true],
  ] as const)(
    'manually changes %s and records STATUS_CHANGED',
    (key, value) => {
      const next = setPlayerStatus(stateWithPlayer(), 'p1', key, value, {
        occurredAt,
      });

      expect(next.assignments[0]?.status[key]).toBe(value);
      expect(next.events.at(-1)).toMatchObject({
        type: 'STATUS_CHANGED',
        playerId: 'p1',
        statusKey: key,
        value,
        actor: { type: 'storyteller' },
        visibility: { scope: 'storyteller' },
        occurredAt,
      });
      expect(next.version).toBe(1);
    },
  );

  it('is immutable, idempotent, and rejects unknown players', () => {
    const state = stateWithPlayer();
    const unchanged = setPlayerStatus(state, 'p1', 'alive', true);
    expect(unchanged).toBe(state);
    expect(() => setPlayerStatus(state, 'missing', 'alive', false)).toThrow(
      InvalidPlayerStateError,
    );
  });

  it('records a safe private-info summary with player visibility', () => {
    const next = givePrivateInfo(
      stateWithPlayer(),
      {
        playerId: 'p1',
        infoKind: 'role_hint',
        summary: 'Shown two possible Townsfolk players.',
      },
      { occurredAt },
    );

    expect(next.events.at(-1)).toMatchObject({
      type: 'PRIVATE_INFO_GIVEN',
      playerId: 'p1',
      infoKind: 'role_hint',
      summary: 'Shown two possible Townsfolk players.',
      visibility: { scope: 'players', playerIds: ['p1'] },
    });
  });
});
