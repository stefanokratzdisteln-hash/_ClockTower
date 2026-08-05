import type { Assignment, GamePhase, GameState } from '@clocktower/shared';
import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../game-state.js';
import {
  InvalidDayActionError,
  castVote,
  createNomination,
  determineWinner,
  executeNomination,
  resolveNomination,
} from '../phases/day.js';

const timestamp = '2026-07-27T03:00:00.000Z';

function assignment(
  playerId: string,
  characterId: string,
  alive = true,
  deadVoteAvailable = false,
): Assignment {
  return {
    playerId,
    characterId,
    alignment: characterId === 'imp' ? 'evil' : 'good',
    status: {
      alive,
      deadVoteAvailable,
      drunk: false,
      poisoned: false,
      protected: false,
    },
    effects: [],
    reminders: [],
  };
}

function stateIn(phase: GamePhase): GameState {
  const players = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id, seatIndex) => ({
    id,
    name: id,
    seatIndex,
    experience: 'regular' as const,
  }));
  return {
    ...createInitialGameState('game-1', 'trouble-brewing', timestamp),
    phase,
    dayNumber: 1,
    players,
    assignments: [
      assignment('p1', 'imp'),
      assignment('p2', 'washerwoman'),
      assignment('p3', 'chef'),
      assignment('p4', 'empath'),
      assignment('p5', 'soldier'),
    ],
  };
}

function nominatedVotingState(nomineeId = 'p2'): GameState {
  const nomination = createNomination(
    stateIn('nomination'),
    { nominationId: 'nom-1', nominatorId: 'p1', nomineeId },
    { occurredAt: timestamp },
  );
  return { ...nomination, phase: 'voting' };
}

describe('day nominations and voting', () => {
  it('only creates nominations during nomination and emits an event', () => {
    const next = createNomination(
      stateIn('nomination'),
      { nominationId: 'nom-1', nominatorId: 'p1', nomineeId: 'p2' },
      { occurredAt: timestamp },
    );

    expect(next.nominations[0]).toMatchObject({
      id: 'nom-1',
      voteCount: 0,
      executionThreshold: 3,
      reachedExecutionThreshold: false,
    });
    expect(next.events.at(-1)).toMatchObject({
      type: 'NOMINATION_CREATED',
      nominationId: 'nom-1',
    });
    expect(() =>
      createNomination(stateIn('day_discussion'), {
        nominationId: 'bad',
        nominatorId: 'p1',
        nomineeId: 'p2',
      }),
    ).toThrow(InvalidDayActionError);
  });

  it('ends the game for a healthy Saint executed by the town', () => {
    let state = nominatedVotingState('p2');
    state = {
      ...state,
      assignments: state.assignments.map((candidate) =>
        candidate.playerId === 'p2'
          ? { ...candidate, characterId: 'saint' }
          : candidate,
      ),
    };
    for (const voterId of ['p1', 'p3', 'p4']) {
      state = castVote(state, {
        nominationId: 'nom-1',
        voterId,
        value: true,
      });
    }
    state = resolveNomination(state, 'nom-1');
    state = executeNomination(
      { ...state, phase: 'execution_resolution' },
      'nom-1',
    );
    expect(state.phase).toBe('game_over');
    expect(state.events.at(-1)).toMatchObject({
      type: 'GAME_ENDED',
      winningAlignment: 'evil',
    });
    expect(state.result).toMatchObject({
      winningAlignment: 'evil',
      reason: 'The Saint died by execution.',
    });
  });

  it('promotes a healthy Scarlet Woman when the Demon dies with five alive', () => {
    let state = nominatedVotingState('p1');
    state = {
      ...state,
      assignments: state.assignments.map((candidate) =>
        candidate.playerId === 'p2'
          ? {
              ...candidate,
              characterId: 'scarlet_woman',
              alignment: 'evil',
            }
          : candidate,
      ),
    };
    for (const voterId of ['p2', 'p3', 'p4']) {
      state = castVote(state, {
        nominationId: 'nom-1',
        voterId,
        value: true,
      });
    }
    state = resolveNomination(state, 'nom-1');
    state = executeNomination(
      { ...state, phase: 'execution_resolution' },
      'nom-1',
    );
    expect(
      state.assignments.find(({ playerId }) => playerId === 'p2')?.characterId,
    ).toBe('imp');
    expect(state.phase).toBe('execution_resolution');
  });

  it('only accepts voting-phase votes and records order, count and threshold', () => {
    let state = nominatedVotingState();
    state = castVote(
      state,
      { nominationId: 'nom-1', voterId: 'p3', value: true },
      { occurredAt: timestamp },
    );
    state = castVote(
      state,
      { nominationId: 'nom-1', voterId: 'p1', value: false },
      { occurredAt: timestamp },
    );
    state = castVote(
      state,
      { nominationId: 'nom-1', voterId: 'p4', value: true },
      { occurredAt: timestamp },
    );
    state = castVote(
      state,
      { nominationId: 'nom-1', voterId: 'p5', value: true },
      { occurredAt: timestamp },
    );

    expect(state.nominations[0]).toMatchObject({
      voteCount: 3,
      executionThreshold: 3,
      reachedExecutionThreshold: true,
    });
    expect(state.nominations[0]?.votes).toEqual([
      { voterId: 'p3', value: true, order: 1, castAt: timestamp },
      { voterId: 'p1', value: false, order: 2, castAt: timestamp },
      { voterId: 'p4', value: true, order: 3, castAt: timestamp },
      { voterId: 'p5', value: true, order: 4, castAt: timestamp },
    ]);
    expect(
      state.events.filter(({ type }) => type === 'VOTE_CAST'),
    ).toHaveLength(4);
    expect(() =>
      castVote(
        { ...state, phase: 'nomination' },
        { nominationId: 'nom-1', voterId: 'p2', value: true },
      ),
    ).toThrow(InvalidDayActionError);
    expect(() =>
      castVote(state, {
        nominationId: 'nom-1',
        voterId: 'p3',
        value: true,
      }),
    ).toThrow(InvalidDayActionError);
  });

  it('resolves a partial ballot and treats players without a record as not voting', () => {
    let state = nominatedVotingState();
    state = castVote(state, {
      nominationId: 'nom-1',
      voterId: 'p1',
      value: true,
    });

    const resolved = resolveNomination(state, 'nom-1', {
      occurredAt: timestamp,
    });

    expect(resolved.nominations[0]).toMatchObject({
      status: 'resolved',
      voteCount: 1,
      reachedExecutionThreshold: false,
    });
    expect(resolved.nominations[0]?.votes).toHaveLength(1);
  });

  it('allows one affirmative dead vote, consumes it, and emits both events', () => {
    let state = nominatedVotingState();
    state = {
      ...state,
      assignments: state.assignments.map((candidate) =>
        candidate.playerId === 'p3'
          ? assignment('p3', 'chef', false, true)
          : candidate,
      ),
    };

    state = castVote(
      state,
      { nominationId: 'nom-1', voterId: 'p3', value: true },
      { occurredAt: timestamp },
    );

    expect(
      state.assignments.find(({ playerId }) => playerId === 'p3')?.status
        .deadVoteAvailable,
    ).toBe(false);
    expect(state.events.slice(-2).map(({ type }) => type)).toEqual([
      'VOTE_CAST',
      'STATUS_CHANGED',
    ]);

    const anotherNomination = {
      ...state,
      nominations: state.nominations.map((candidate) => ({
        ...candidate,
        id: 'nom-2',
        votes: [],
      })),
    };
    expect(() =>
      castVote(anotherNomination, {
        nominationId: 'nom-2',
        voterId: 'p3',
        value: true,
      }),
    ).toThrow(/no dead vote/i);
  });
});

describe('execution and basic win conditions', () => {
  function executableState(nomineeId: string): GameState {
    let state = nominatedVotingState(nomineeId);
    for (const voterId of ['p1', 'p2', 'p3']) {
      state = castVote(state, {
        nominationId: 'nom-1',
        voterId,
        value: true,
      });
    }
    state = resolveNomination(state, 'nom-1', { occurredAt: timestamp });
    return { ...state, phase: 'execution_resolution' };
  }

  it('executes a threshold-reaching nominee and grants a dead vote', () => {
    const next = executeNomination(executableState('p2'), 'nom-1', {
      occurredAt: timestamp,
    });

    expect(
      next.assignments.find(({ playerId }) => playerId === 'p2')?.status,
    ).toMatchObject({ alive: false, deadVoteAvailable: true });
    expect(next.events.at(-1)).toMatchObject({
      type: 'PLAYER_EXECUTED',
      playerId: 'p2',
    });
  });

  it('declares good victory when the Demon is executed', () => {
    const next = executeNomination(executableState('p1'), 'nom-1', {
      occurredAt: timestamp,
    });

    expect(next.phase).toBe('game_over');
    expect(next.events.slice(-2).map(({ type }) => type)).toEqual([
      'PLAYER_EXECUTED',
      'GAME_ENDED',
    ]);
    expect(next.events.at(-1)).toMatchObject({
      winningAlignment: 'good',
      reason: 'The Demon is dead.',
    });
    expect(next.result).toEqual({
      winningAlignment: 'good',
      reason: 'The Demon is dead.',
      endedAt: timestamp,
    });
  });

  it('declares evil victory at two living players and prioritizes Demon death', () => {
    const base = stateIn('execution_resolution');
    const twoAlive = {
      ...base,
      assignments: base.assignments.map((candidate, index) => ({
        ...candidate,
        status: { ...candidate.status, alive: index < 2 },
      })),
    };
    expect(determineWinner(twoAlive)).toEqual({
      winningAlignment: 'evil',
      reason: 'Two or fewer players remain alive.',
    });

    const demonAlsoDead = {
      ...twoAlive,
      assignments: twoAlive.assignments.map((candidate) =>
        candidate.characterId === 'imp'
          ? { ...candidate, status: { ...candidate.status, alive: false } }
          : candidate,
      ),
    };
    expect(determineWinner(demonAlsoDead)?.winningAlignment).toBe('good');
  });

  it('rejects unresolved, under-threshold, and wrong-phase executions', () => {
    const voting = nominatedVotingState();
    expect(() => executeNomination(voting, 'nom-1')).toThrow(
      InvalidDayActionError,
    );

    const underThreshold = {
      ...resolveNomination(voting, 'nom-1'),
      phase: 'execution_resolution' as const,
    };
    expect(() => executeNomination(underThreshold, 'nom-1')).toThrow(
      /threshold/i,
    );
  });
});
