import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../game-state.js';

describe('createInitialGameState', () => {
  it('creates an empty game in the lobby phase', () => {
    const state = createInitialGameState(
      'game-1',
      'trouble-brewing',
      '2026-07-27T00:00:00.000Z',
    );

    expect(state).toEqual({
      id: 'game-1',
      scriptId: 'trouble-brewing',
      phase: 'lobby',
      dayNumber: 0,
      players: [],
      spectators: [],
      assignments: [],
      nominations: [],
      effects: [],
      reminderTokens: [],
      demonBluffs: [],
      nightQueue: [],
      timer: {
        mode: 'day',
        durationSeconds: 600,
        remainingSeconds: 600,
        running: false,
      },
      historyCursor: 0,
      events: [],
      version: 0,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
    });
  });
});
