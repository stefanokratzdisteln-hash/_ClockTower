import { describe, expect, it } from 'vitest';

import {
  addPlayer,
  autoAssignTroubleBrewingCharactersToGame,
  castVote,
  createNomination,
  createRoom,
  executeNomination,
  getTroubleBrewingRole,
  resolveNomination,
  transitionGamePhase,
} from '../index.js';

describe('storyteller grimoire MVP flow', () => {
  it('runs room → players → assignment → first night → day → nomination → vote → execution → night', () => {
    let game = createRoom({ id: 'flow-room', scriptId: 'trouble-brewing' });
    for (let index = 0; index < 7; index += 1) {
      game = addPlayer(game, {
        id: `player-${index + 1}`,
        name: `Player ${index + 1}`,
      });
    }

    game = transitionGamePhase(game, 'setup_players');
    game = transitionGamePhase(game, 'assign_characters');
    game = autoAssignTroubleBrewingCharactersToGame(
      game,
      { random: () => 0.42 },
      { occurredAt: '2026-07-27T12:00:00.000Z' },
    );
    expect(game.assignments).toHaveLength(7);
    expect(
      game.events.filter(({ type }) => type === 'CHARACTER_ASSIGNED'),
    ).toHaveLength(7);

    game = transitionGamePhase(game, 'private_reveal');
    game = transitionGamePhase(game, 'first_night');
    game = transitionGamePhase(game, 'day_discussion');
    expect(game.dayNumber).toBe(1);
    game = transitionGamePhase(game, 'nomination');

    const nominee = game.assignments.find(
      ({ characterId }) => getTroubleBrewingRole(characterId)?.type !== 'demon',
    )!;
    const nominator = game.assignments.find(
      ({ playerId }) => playerId !== nominee.playerId,
    )!;
    game = createNomination(game, {
      nominationId: 'day-1-nomination',
      nominatorId: nominator.playerId,
      nomineeId: nominee.playerId,
    });
    game = transitionGamePhase(game, 'voting');

    for (const player of game.players) {
      game = castVote(game, {
        nominationId: 'day-1-nomination',
        voterId: player.id,
        value: true,
      });
    }
    game = resolveNomination(game, 'day-1-nomination');
    game = transitionGamePhase(game, 'execution_resolution');
    game = executeNomination(game, 'day-1-nomination');
    expect(
      game.assignments.find(({ playerId }) => playerId === nominee.playerId)
        ?.status.alive,
    ).toBe(false);

    game = transitionGamePhase(game, 'night');
    expect(game.phase).toBe('night');
  });
});
