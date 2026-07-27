import type {
  EventActor,
  EventVisibility,
  GameEvent,
  GameEventPayload,
  GameState,
  PlayerId,
  PlayerStatus,
} from '@clocktower/shared';

export type StateChangeContext = {
  occurredAt?: string;
  eventId?: string;
  actor?: EventActor;
  visibility?: EventVisibility;
  correlationId?: string;
  causationId?: string;
};

export type GivePrivateInfoInput = {
  playerId: PlayerId;
  infoKind: string;
  /** A safe summary for the audit trail, not the complete private message. */
  summary: string;
};

export class InvalidPlayerStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPlayerStateError';
  }
}

function requireAssignment(state: GameState, playerId: PlayerId) {
  const assignment = state.assignments.find(
    (candidate) => candidate.playerId === playerId,
  );
  if (assignment === undefined) {
    throw new InvalidPlayerStateError(`Unknown assigned player: ${playerId}.`);
  }
  return assignment;
}

function nonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidPlayerStateError(`${field} must not be empty.`);
  }
  return normalized;
}

function appendEvent(
  state: GameState,
  payload: GameEventPayload,
  context: StateChangeContext,
  defaultVisibility: EventVisibility,
): GameState {
  const sequence = state.version + 1;
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const event: GameEvent = {
    id: context.eventId ?? `${state.id}:state:${sequence}`,
    gameId: state.id,
    sequence,
    occurredAt,
    actor: context.actor ?? { type: 'storyteller' },
    visibility: context.visibility ?? defaultVisibility,
    ...(context.correlationId === undefined
      ? {}
      : { correlationId: context.correlationId }),
    ...(context.causationId === undefined
      ? {}
      : { causationId: context.causationId }),
    ...payload,
  } as GameEvent;

  return {
    ...state,
    events: [...state.events, event],
    version: sequence,
    updatedAt: occurredAt,
  };
}

/**
 * Manually changes one status flag. The operation is immutable and idempotent:
 * setting an already-equal value returns the original state and emits no event.
 */
export function setPlayerStatus<K extends keyof PlayerStatus>(
  state: GameState,
  playerId: PlayerId,
  statusKey: K,
  value: PlayerStatus[K],
  context: StateChangeContext = {},
): GameState {
  const assignment = requireAssignment(state, playerId);
  if (assignment.status[statusKey] === value) {
    return state;
  }

  const next = {
    ...state,
    assignments: state.assignments.map((candidate) =>
      candidate.playerId === playerId
        ? {
            ...candidate,
            status: { ...candidate.status, [statusKey]: value },
          }
        : candidate,
    ),
  };

  return appendEvent(
    next,
    { type: 'STATUS_CHANGED', playerId, statusKey, value },
    context,
    { scope: 'storyteller' },
  );
}

/**
 * Records only a safe summary of information already delivered to a player.
 * Player-scoped visibility is the secure default.
 */
export function givePrivateInfo(
  state: GameState,
  input: GivePrivateInfoInput,
  context: StateChangeContext = {},
): GameState {
  requireAssignment(state, input.playerId);
  const infoKind = nonEmpty(input.infoKind, 'Info kind');
  const summary = nonEmpty(input.summary, 'Private information summary');

  return appendEvent(
    state,
    {
      type: 'PRIVATE_INFO_GIVEN',
      playerId: input.playerId,
      infoKind,
      summary,
    },
    context,
    { scope: 'players', playerIds: [input.playerId] },
  );
}
