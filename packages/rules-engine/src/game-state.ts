import type { GameId, GameState } from '@clocktower/shared';

export function createInitialGameState(
  id: GameId,
  scriptId: string,
  now = new Date().toISOString(),
): GameState {
  return {
    id,
    scriptId,
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
    createdAt: now,
    updatedAt: now,
  };
}
