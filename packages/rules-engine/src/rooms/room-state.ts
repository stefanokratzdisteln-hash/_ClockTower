import type {
  EventActor,
  EventVisibility,
  GameEvent,
  GameId,
  GameState,
  Player,
  PlayerExperience,
  PlayerId,
} from '@clocktower/shared';

export type RoomEventContext = {
  occurredAt?: string;
  eventId?: string;
  actor?: EventActor;
  visibility?: EventVisibility;
  correlationId?: string;
  causationId?: string;
};

export type CreateRoomInput = {
  id: GameId;
  scriptId: string;
};

export type AddPlayerInput = {
  id: PlayerId;
  name: string;
  experience?: PlayerExperience;
};

export class InvalidRoomCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRoomCommandError';
  }
}

function eventMetadata(
  state: Pick<GameState, 'id' | 'version'>,
  context: RoomEventContext,
  fallbackIdPart: string,
): Omit<GameEvent, 'type'> {
  const sequence = state.version + 1;

  return {
    id: context.eventId ?? `${state.id}:${fallbackIdPart}:${sequence}`,
    gameId: state.id,
    sequence,
    occurredAt: context.occurredAt ?? new Date().toISOString(),
    actor: context.actor ?? { type: 'storyteller' },
    visibility: context.visibility ?? { scope: 'public' },
    ...(context.correlationId === undefined
      ? {}
      : { correlationId: context.correlationId }),
    ...(context.causationId === undefined
      ? {}
      : { causationId: context.causationId }),
  };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidRoomCommandError(`${field} must not be empty`);
  }
  return normalized;
}

function requirePlayer(state: GameState, playerId: PlayerId): Player {
  const player = state.players.find(({ id }) => id === playerId);
  if (player === undefined) {
    throw new InvalidRoomCommandError(`Player not found: ${playerId}`);
  }
  return player;
}

/**
 * Applies a room event without mutating either the state or event.
 * ROOM_CREATED is the only event that can be applied without existing state.
 */
export function applyRoomEvent(
  state: GameState | undefined,
  event: GameEvent,
): GameState {
  if (state === undefined) {
    if (event.type !== 'ROOM_CREATED') {
      throw new InvalidRoomCommandError(
        'The first room event must be ROOM_CREATED',
      );
    }
    if (event.sequence !== 1) {
      throw new InvalidRoomCommandError('ROOM_CREATED must have sequence 1');
    }

    return {
      id: event.gameId,
      scriptId: event.scriptId,
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
      events: [event],
      version: event.sequence,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
    };
  }

  if (event.gameId !== state.id) {
    throw new InvalidRoomCommandError(
      `Event belongs to another room: ${event.gameId}`,
    );
  }
  if (event.sequence !== state.version + 1) {
    throw new InvalidRoomCommandError(
      `Expected event sequence ${state.version + 1}, got ${event.sequence}`,
    );
  }

  let players = state.players;

  switch (event.type) {
    case 'PLAYER_ADDED':
      if (players.some(({ id }) => id === event.playerId)) {
        throw new InvalidRoomCommandError(
          `Player already exists: ${event.playerId}`,
        );
      }
      players = [
        ...players,
        {
          id: event.playerId,
          name: event.name,
          seatIndex: event.seatIndex,
          experience: event.experience,
        },
      ];
      break;
    case 'PLAYER_NAME_CHANGED':
      requirePlayer(state, event.playerId);
      players = players.map((player) =>
        player.id === event.playerId ? { ...player, name: event.name } : player,
      );
      break;
    case 'PLAYER_REMOVED':
      requirePlayer(state, event.playerId);
      players = players
        .filter((player) => player.id !== event.playerId)
        .map((player, seatIndex) => ({ ...player, seatIndex }));
      break;
    case 'PLAYER_EXPERIENCE_CHANGED':
      requirePlayer(state, event.playerId);
      players = players.map((player) =>
        player.id === event.playerId
          ? { ...player, experience: event.experience }
          : player,
      );
      break;
    case 'PLAYER_SEATS_SET': {
      const currentIds = new Set(players.map(({ id }) => id));
      const orderedIds = new Set(event.playerIds);
      if (
        orderedIds.size !== event.playerIds.length ||
        event.playerIds.length !== players.length ||
        event.playerIds.some((id) => !currentIds.has(id))
      ) {
        throw new InvalidRoomCommandError(
          'Seat order must contain every player exactly once',
        );
      }
      const playerById = new Map(players.map((player) => [player.id, player]));
      players = event.playerIds.map((id, seatIndex) => ({
        ...playerById.get(id)!,
        seatIndex,
      }));
      break;
    }
    case 'ROOM_CREATED':
      throw new InvalidRoomCommandError('ROOM_CREATED can only occur once');
    default:
      throw new InvalidRoomCommandError(
        `Unsupported room event: ${event.type}`,
      );
  }

  return {
    ...state,
    players,
    events: [...state.events, event],
    version: event.sequence,
    updatedAt: event.occurredAt,
  };
}

export function createRoom(
  input: CreateRoomInput,
  context: RoomEventContext = {},
): GameState {
  const id = requireNonEmpty(input.id, 'Room id');
  const scriptId = requireNonEmpty(input.scriptId, 'Script id');
  const base = { id, version: 0 };
  const event: GameEvent = {
    ...eventMetadata(base, context, 'created'),
    type: 'ROOM_CREATED',
    scriptId,
  };
  return applyRoomEvent(undefined, event);
}

export function addPlayer(
  state: GameState,
  input: AddPlayerInput,
  context: RoomEventContext = {},
): GameState {
  const playerId = requireNonEmpty(input.id, 'Player id');
  if (state.players.some(({ id }) => id === playerId)) {
    throw new InvalidRoomCommandError(`Player already exists: ${playerId}`);
  }

  const event: GameEvent = {
    ...eventMetadata(state, context, 'player-added'),
    type: 'PLAYER_ADDED',
    playerId,
    name: requireNonEmpty(input.name, 'Player name'),
    seatIndex: state.players.length,
    experience: input.experience ?? 'new',
  };
  return applyRoomEvent(state, event);
}

export function changePlayerName(
  state: GameState,
  playerId: PlayerId,
  name: string,
  context: RoomEventContext = {},
): GameState {
  requirePlayer(state, playerId);
  const normalizedName = requireNonEmpty(name, 'Player name');
  if (requirePlayer(state, playerId).name === normalizedName) {
    return state;
  }

  const event: GameEvent = {
    ...eventMetadata(state, context, 'player-name'),
    type: 'PLAYER_NAME_CHANGED',
    playerId,
    name: normalizedName,
  };
  return applyRoomEvent(state, event);
}

export function removePlayer(
  state: GameState,
  playerId: PlayerId,
  context: RoomEventContext = {},
): GameState {
  if (state.phase !== 'lobby' && state.phase !== 'setup_players') {
    throw new InvalidRoomCommandError(
      'Players can only be removed before character assignment',
    );
  }
  const player = requirePlayer(state, playerId);
  const event: GameEvent = {
    ...eventMetadata(state, context, 'player-removed'),
    type: 'PLAYER_REMOVED',
    playerId,
    name: player.name,
  };
  const next = applyRoomEvent(state, event);
  return {
    ...next,
    assignments: next.assignments.filter(
      (assignment) => assignment.playerId !== playerId,
    ),
    effects: next.effects.filter((effect) => effect.playerId !== playerId),
    reminderTokens: next.reminderTokens.filter(
      (reminder) => reminder.playerId !== playerId,
    ),
  };
}

export function setPlayerExperience(
  state: GameState,
  playerId: PlayerId,
  experience: PlayerExperience,
  context: RoomEventContext = {},
): GameState {
  const player = requirePlayer(state, playerId);
  if (player.experience === experience) {
    return state;
  }

  const event: GameEvent = {
    ...eventMetadata(state, context, 'player-experience'),
    type: 'PLAYER_EXPERIENCE_CHANGED',
    playerId,
    experience,
  };
  return applyRoomEvent(state, event);
}

export function setPlayerSeatOrder(
  state: GameState,
  playerIds: readonly PlayerId[],
  context: RoomEventContext = {},
): GameState {
  const currentIds = new Set(state.players.map(({ id }) => id));
  const orderedIds = new Set(playerIds);
  if (
    orderedIds.size !== playerIds.length ||
    playerIds.length !== state.players.length ||
    playerIds.some((id) => !currentIds.has(id))
  ) {
    throw new InvalidRoomCommandError(
      'Seat order must contain every player exactly once',
    );
  }

  if (playerIds.every((id, index) => state.players[index]?.id === id)) {
    return state;
  }

  const event: GameEvent = {
    ...eventMetadata(state, context, 'player-seats'),
    type: 'PLAYER_SEATS_SET',
    playerIds: [...playerIds],
  };
  return applyRoomEvent(state, event);
}

export function replayRoomEvents(events: readonly GameEvent[]): GameState {
  if (events.length === 0) {
    throw new InvalidRoomCommandError('Cannot replay an empty event stream');
  }
  return events.reduce<GameState | undefined>(
    (state, event) => applyRoomEvent(state, event),
    undefined,
  )!;
}
