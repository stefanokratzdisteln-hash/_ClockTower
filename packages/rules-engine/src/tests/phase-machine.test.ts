import { describe, expect, it } from 'vitest';

import { createInitialGameState } from '../game-state.js';
import {
  InvalidPhaseTransitionError,
  isLegalPhaseTransition,
  transitionGamePhase,
  validatePhaseTransition,
} from '../phases/phase-machine.js';

const timestamp = '2026-07-27T01:00:00.000Z';

describe('phase state machine', () => {
  it('supports the complete setup and first-day flow', () => {
    const initial = createInitialGameState(
      'game-1',
      'trouble-brewing',
      '2026-07-27T00:00:00.000Z',
    );

    const phases = [
      'setup_players',
      'assign_characters',
      'private_reveal',
      'first_night',
      'day_discussion',
      'nomination',
      'voting',
      'execution_resolution',
      'night',
      'day_discussion',
    ] as const;

    const final = phases.reduce(
      (state, phase, index) =>
        transitionGamePhase(state, phase, {
          occurredAt: timestamp,
          eventId: `event-${index + 1}`,
        }),
      initial,
    );

    expect(final.phase).toBe('day_discussion');
    expect(final.dayNumber).toBe(2);
    expect(final.version).toBe(phases.length);
    expect(final.events).toHaveLength(phases.length);
    expect(final.events.map((event) => event.type)).toEqual(
      phases.map(() => 'PHASE_ADVANCED'),
    );
    expect(final.events.map((event) => event.sequence)).toEqual(
      phases.map((_, index) => index + 1),
    );
  });

  it('records every successful state change as a phase event', () => {
    const initial = createInitialGameState(
      'game-1',
      'trouble-brewing',
      '2026-07-27T00:00:00.000Z',
    );

    const next = transitionGamePhase(initial, 'setup_players', {
      occurredAt: timestamp,
      eventId: 'phase-event-1',
      correlationId: 'command-1',
    });

    expect(next).not.toBe(initial);
    expect(initial.phase).toBe('lobby');
    expect(initial.events).toEqual([]);
    expect(next.events).toEqual([
      {
        id: 'phase-event-1',
        gameId: 'game-1',
        sequence: 1,
        occurredAt: timestamp,
        actor: { type: 'rules_engine' },
        visibility: { scope: 'public' },
        correlationId: 'command-1',
        type: 'PHASE_ADVANCED',
        from: 'lobby',
        to: 'setup_players',
      },
    ]);
    expect(next.version).toBe(1);
    expect(next.updatedAt).toBe(timestamp);
  });

  it('allows active play to end and review to follow game over', () => {
    const dayState = {
      ...createInitialGameState('game-1', 'trouble-brewing', timestamp),
      phase: 'day_discussion' as const,
      dayNumber: 1,
    };

    const gameOver = transitionGamePhase(dayState, 'game_over', {
      occurredAt: timestamp,
    });
    const review = transitionGamePhase(gameOver, 'review', {
      occurredAt: timestamp,
    });

    expect(gameOver.phase).toBe('game_over');
    expect(review.phase).toBe('review');
    expect(review.events).toHaveLength(2);
  });

  it('rejects skipped, backward, repeated, and post-review transitions', () => {
    expect(isLegalPhaseTransition('lobby', 'private_reveal')).toBe(false);
    expect(validatePhaseTransition('voting', 'nomination')).toEqual({
      valid: true,
    });

    for (const [from, to] of [
      ['lobby', 'assign_characters'],
      ['night', 'night'],
      ['review', 'lobby'],
    ] as const) {
      const state = {
        ...createInitialGameState('game-1', 'trouble-brewing', timestamp),
        phase: from,
      };

      expect(() => transitionGamePhase(state, to)).toThrow(
        InvalidPhaseTransitionError,
      );
      expect(state.events).toEqual([]);
      expect(state.version).toBe(0);
    }
  });
});
