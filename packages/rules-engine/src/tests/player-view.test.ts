import { describe, expect, it } from 'vitest';

import type { GameEvent, GameState } from '@clocktower/shared';

import { selectPlayerView } from '../selectors/player-view.js';

const status = {
  alive: true,
  deadVoteAvailable: false,
  drunk: false,
  poisoned: false,
  protected: false,
};

function state(): GameState {
  const baseEvent = {
    gameId: 'room-7',
    occurredAt: '2026-07-27T12:00:00.000Z',
    actor: { type: 'storyteller' as const },
  };
  const events: GameEvent[] = [
    {
      ...baseEvent,
      id: 'secret-p1',
      sequence: 1,
      visibility: { scope: 'players', playerIds: ['p1'] },
      type: 'PRIVATE_INFO_GIVEN',
      playerId: 'p1',
      infoKind: 'night-result',
      summary: '你得知邻座中有 1 名邪恶玩家',
    },
    {
      ...baseEvent,
      id: 'secret-p2',
      sequence: 2,
      visibility: { scope: 'players', playerIds: ['p2'] },
      type: 'PRIVATE_INFO_GIVEN',
      playerId: 'p2',
      infoKind: 'night-result',
      summary: '绝不能发送给 p1 的秘密',
    },
    {
      ...baseEvent,
      id: 'assignment-p2',
      sequence: 3,
      visibility: { scope: 'storyteller' },
      type: 'CHARACTER_ASSIGNED',
      playerId: 'p2',
      characterId: 'imp',
    },
  ];

  return {
    id: 'room-7',
    scriptId: 'trouble-brewing',
    phase: 'nomination',
    dayNumber: 1,
    players: [
      { id: 'p1', name: '阿澈', seatIndex: 0, experience: 'regular' },
      { id: 'p2', name: 'Mina', seatIndex: 1, experience: 'regular' },
    ],
    spectators: [],
    assignments: [
      {
        playerId: 'p1',
        characterId: 'empath',
        alignment: 'good',
        status,
        reminders: ['private reminder'],
      },
      {
        playerId: 'p2',
        characterId: 'imp',
        alignment: 'evil',
        status: { ...status, poisoned: true },
        reminders: ['hidden demon reminder'],
      },
    ],
    nominations: [],
    events,
    version: 3,
    createdAt: baseEvent.occurredAt,
    updatedAt: baseEvent.occurredAt,
  };
}

describe('player view permission boundary', () => {
  it('contains own role and hint but never another player hidden state', () => {
    const view = selectPlayerView(state(), 'p1');
    const serialized = JSON.stringify(view);

    expect(view.self.characterId).toBe('empath');
    expect(view.self.alignment).toBe('good');
    expect(view.privateHints.map((hint) => hint.text)).toEqual([
      '你得知邻座中有 1 名邪恶玩家',
    ]);
    expect(view.permissions.nominate.allowed).toBe(true);

    expect(serialized).not.toContain('imp');
    expect(serialized).not.toContain('绝不能发送给 p1 的秘密');
    expect(serialized).not.toContain('hidden demon reminder');
    expect(serialized).not.toContain('poisoned');
    expect(serialized).not.toContain('assignments');
    expect(serialized).not.toContain('events');
  });

  it('keeps dead players informed and permits only an unused dead vote', () => {
    const game = state();
    game.phase = 'voting';
    game.assignments[0]!.status = {
      ...game.assignments[0]!.status,
      alive: false,
      deadVoteAvailable: true,
    };
    game.nominations = [
      {
        id: 'nom-1',
        dayNumber: 1,
        nominatorId: 'p2',
        nomineeId: 'p1',
        status: 'open',
        votes: [],
        voteCount: 0,
        executionThreshold: 1,
        reachedExecutionThreshold: false,
        createdAt: game.updatedAt,
      },
    ];

    const view = selectPlayerView(game, 'p1');
    expect(view.self.alive).toBe(false);
    expect(view.privateHints).toHaveLength(1);
    expect(view.permissions.nominate.allowed).toBe(false);
    expect(view.permissions.vote.allowed).toBe(true);

    game.assignments[0]!.status.deadVoteAvailable = false;
    expect(selectPlayerView(game, 'p1').permissions.vote.allowed).toBe(false);
  });

  it('reveals all roles only after game end', () => {
    const game = state();
    expect(selectPlayerView(game, 'p1').review).toBeUndefined();

    game.phase = 'game_over';
    const review = selectPlayerView(game, 'p1').review;
    expect(review?.roles).toHaveLength(2);
    expect(review?.roles.find((role) => role.playerId === 'p2')).toMatchObject({
      characterId: 'imp',
      alignment: 'evil',
    });
  });

  it('rejects a player that does not belong to the room', () => {
    expect(() => selectPlayerView(state(), 'intruder')).toThrow(
      'Player is not a member of this room.',
    );
  });
});
