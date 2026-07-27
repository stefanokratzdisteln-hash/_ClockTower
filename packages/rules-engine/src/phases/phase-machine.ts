import type {
  EventActor,
  EventVisibility,
  GameEvent,
  GamePhase,
  GameState,
} from '@clocktower/shared';

/**
 * The normal phase flow. `game_over` is also reachable from active play
 * phases because a win condition can be met during the day or night.
 */
export const LEGAL_PHASE_TRANSITIONS = {
  lobby: ['setup_players'],
  setup_players: ['assign_characters'],
  assign_characters: ['private_reveal'],
  private_reveal: ['first_night'],
  first_night: ['day_discussion', 'game_over'],
  day_discussion: ['nomination', 'game_over'],
  nomination: ['voting', 'game_over'],
  voting: ['nomination', 'execution_resolution', 'game_over'],
  execution_resolution: ['nomination', 'night', 'game_over'],
  night: ['day_discussion', 'game_over'],
  game_over: ['review'],
  review: [],
} as const satisfies Readonly<Record<GamePhase, readonly GamePhase[]>>;

export type PhaseTransitionValidation =
  | { valid: true }
  | {
      valid: false;
      error: string;
      from: GamePhase;
      to: GamePhase;
    };

export type PhaseTransitionContext = {
  occurredAt?: string;
  eventId?: string;
  actor?: EventActor;
  visibility?: EventVisibility;
  correlationId?: string;
  causationId?: string;
};

export class InvalidPhaseTransitionError extends Error {
  readonly from: GamePhase;
  readonly to: GamePhase;

  constructor(from: GamePhase, to: GamePhase) {
    super(`Illegal game phase transition: ${from} -> ${to}`);
    this.name = 'InvalidPhaseTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function isLegalPhaseTransition(
  from: GamePhase,
  to: GamePhase,
): boolean {
  const destinations: readonly GamePhase[] = LEGAL_PHASE_TRANSITIONS[from];
  return destinations.includes(to);
}

export function validatePhaseTransition(
  from: GamePhase,
  to: GamePhase,
): PhaseTransitionValidation {
  if (isLegalPhaseTransition(from, to)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Illegal game phase transition: ${from} -> ${to}`,
    from,
    to,
  };
}

/**
 * Applies one phase transition without mutating the input state.
 *
 * Every successful transition appends exactly one PHASE_ADVANCED event and
 * advances the state's version to that event's sequence number.
 */
export function transitionGamePhase(
  state: GameState,
  to: GamePhase,
  context: PhaseTransitionContext = {},
): GameState {
  const validation = validatePhaseTransition(state.phase, to);

  if (!validation.valid) {
    throw new InvalidPhaseTransitionError(validation.from, validation.to);
  }

  const sequence = state.version + 1;
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const event: GameEvent = {
    id: context.eventId ?? `${state.id}:phase:${sequence}`,
    gameId: state.id,
    sequence,
    occurredAt,
    actor: context.actor ?? { type: 'rules_engine' },
    visibility: context.visibility ?? { scope: 'public' },
    ...(context.correlationId === undefined
      ? {}
      : { correlationId: context.correlationId }),
    ...(context.causationId === undefined
      ? {}
      : { causationId: context.causationId }),
    type: 'PHASE_ADVANCED',
    from: state.phase,
    to,
  };

  const startsNewDay =
    to === 'day_discussion' &&
    (state.phase === 'first_night' || state.phase === 'night');

  const expiry =
    to === 'day_discussion'
      ? new Set(['dawn', 'end_of_night'])
      : to === 'night'
        ? new Set(['dusk', 'end_of_day'])
        : new Set<string>();
  const effects = state.effects.filter(
    (effect) => !expiry.has(effect.expiresAt),
  );
  const assignments = state.assignments.map((assignment) => {
    const ownEffects = effects.filter(
      (effect) => effect.playerId === assignment.playerId,
    );
    return {
      ...assignment,
      effects: ownEffects,
      status: {
        ...assignment.status,
        drunk: ownEffects.some(({ kind }) => kind === 'drunk'),
        poisoned: ownEffects.some(({ kind }) => kind === 'poisoned'),
        protected: ownEffects.some(({ kind }) => kind === 'protected'),
      },
    };
  });

  return {
    ...state,
    phase: to,
    dayNumber: startsNewDay ? state.dayNumber + 1 : state.dayNumber,
    effects,
    assignments,
    nightQueue: to === 'first_night' || to === 'night' ? state.nightQueue : [],
    timer: {
      ...state.timer,
      mode: to === 'first_night' || to === 'night' ? 'night' : 'day',
      running: false,
    },
    events: [...state.events, event],
    version: sequence,
    updatedAt: occurredAt,
  };
}
