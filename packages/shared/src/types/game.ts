export type PlayerId = string;
export type CharacterId = string;
export type GameId = string;

export type Alignment = 'good' | 'evil';

export type PlayerStatus = {
  alive: boolean;
  deadVoteAvailable: boolean;
  drunk: boolean;
  poisoned: boolean;
  protected: boolean;
};

export type StatusEffectKind =
  | 'drunk'
  | 'poisoned'
  | 'protected'
  | 'ability_used'
  | 'red_herring'
  | 'master'
  | 'custom';

export type StatusEffectExpiry =
  'dawn' | 'dusk' | 'end_of_day' | 'end_of_night' | 'manual';

export type StatusEffect = {
  id: string;
  playerId: PlayerId;
  kind: StatusEffectKind;
  label: string;
  sourceRoleId?: CharacterId;
  sourcePlayerId?: PlayerId;
  expiresAt: StatusEffectExpiry;
  createdAt: string;
};

export type ReminderToken = {
  id: string;
  playerId: PlayerId;
  label: string;
  sourceRoleId?: CharacterId;
  visibility: 'storyteller' | 'public';
  createdAt: string;
};

export type BluffRole = {
  characterId: CharacterId;
  revealed: boolean;
};

export type NightStepStatus = 'pending' | 'active' | 'completed' | 'skipped';

export type NightDeathOutcome =
  | {
      type: 'death';
      playerId: PlayerId;
      /** Required when the Imp kills itself and a living Minion can inherit. */
      newDemonPlayerId?: PlayerId;
      reason?: string;
    }
  | { type: 'no_death'; reason: string };

export type NightStep = {
  id: string;
  nightNumber: number;
  playerId: PlayerId;
  characterId: CharacterId;
  order: number;
  status: NightStepStatus;
  targetIds: PlayerId[];
  deathOutcome?: NightDeathOutcome;
  resultSummary?: string;
  storytellerNote?: string;
  startedAt?: string;
  completedAt?: string;
};

export type TimerState = {
  mode: 'day' | 'night';
  durationSeconds: number;
  remainingSeconds: number;
  running: boolean;
  startedAt?: string;
};

export type GameResult = {
  winningAlignment: Alignment;
  reason: string;
  endedAt: string;
};

export type AssetSlot = {
  id: string;
  kind: 'background' | 'overlay' | 'token' | 'icon' | 'animation' | 'poster';
  path: string;
  mobilePath?: string;
  width: number;
  height: number;
  optional: true;
};

export type AssetManifest = Readonly<Record<string, AssetSlot>>;

export type PlayerExperience = 'new' | 'regular' | 'expert';

export type Player = {
  id: PlayerId;
  name: string;
  seatIndex: number;
  experience: PlayerExperience;
};

/**
 * Spectators can observe a room but do not occupy a seat. The MVP only
 * exposes this data; joining or editing spectators is intentionally outside
 * the room command API for now.
 */
export type Spectator = {
  id: string;
  name: string;
};

export type CharacterType = 'townsfolk' | 'outsider' | 'minion' | 'demon';

/**
 * Script-defined ability data. Rules packages should validate and narrow this
 * object before using it.
 */
export type AbilityModel = Readonly<Record<string, unknown>>;

export type Character = {
  id: CharacterId;
  scriptId: string;
  type: CharacterType;
  alignment: Alignment;
  firstNightOrder?: number;
  otherNightOrder?: number;
  abilityModel: AbilityModel;
};

export type RoleDefinition = {
  id: CharacterId;
  scriptId: string;
  type: CharacterType;
  alignment: Alignment;
  firstNightOrder: number | null;
  otherNightOrder: number | null;
  abilityModel: AbilityModel;
  name: string;
  summary: string;
  storytellerSteps: readonly string[];
  reminderLabels: readonly string[];
};

export type Assignment = {
  playerId: PlayerId;
  characterId: CharacterId;
  alignment: Alignment;
  status: PlayerStatus;
  /** Structured effects are authoritative; status remains as a compatibility view. */
  effects: StatusEffect[];
  reminders: string[];
};

export type GamePhase =
  | 'lobby'
  | 'setup_players'
  | 'assign_characters'
  | 'private_reveal'
  | 'first_night'
  | 'day_discussion'
  | 'nomination'
  | 'voting'
  | 'execution_resolution'
  | 'night'
  | 'game_over'
  | 'review';

export type Vote = {
  voterId: PlayerId;
  value: boolean;
  /** One-based order in which this vote was recorded. */
  order: number;
  castAt: string;
};

export type NominationStatus = 'open' | 'resolved' | 'cancelled';

export type Nomination = {
  id: string;
  dayNumber: number;
  nominatorId: PlayerId;
  nomineeId: PlayerId;
  status: NominationStatus;
  votes: Vote[];
  voteCount: number;
  executionThreshold: number;
  reachedExecutionThreshold: boolean;
  createdAt: string;
  resolvedAt?: string;
};

export type EventActor =
  | { type: 'system' | 'rules_engine' | 'storyteller' }
  | { type: 'player'; playerId: PlayerId };

export type EventVisibility =
  | { scope: 'public' }
  | { scope: 'storyteller' }
  | { scope: 'players'; playerIds: PlayerId[] };

export type GameEventMetadata = {
  /** Stable identifier used for idempotency and audit trails. */
  id: string;
  gameId: GameId;
  /** Monotonically increasing position in this game's event stream. */
  sequence: number;
  occurredAt: string;
  actor: EventActor;
  visibility: EventVisibility;
  /** Groups events produced by one command. */
  correlationId?: string;
  /** Identifies the event that caused this event. */
  causationId?: string;
};

export type GameEventPayload =
  | { type: 'ROOM_CREATED'; scriptId: string }
  | {
      type: 'PLAYER_ADDED';
      playerId: PlayerId;
      name: string;
      seatIndex: number;
      experience: PlayerExperience;
    }
  | { type: 'PLAYER_REMOVED'; playerId: PlayerId; name: string }
  | { type: 'PLAYER_NAME_CHANGED'; playerId: PlayerId; name: string }
  | {
      type: 'PLAYER_EXPERIENCE_CHANGED';
      playerId: PlayerId;
      experience: PlayerExperience;
    }
  | { type: 'PLAYER_SEATS_SET'; playerIds: PlayerId[] }
  | { type: 'PLAYER_JOINED'; playerId: PlayerId; name: string }
  | { type: 'SEAT_CHANGED'; playerId: PlayerId; seatIndex: number }
  | {
      type: 'CHARACTER_ASSIGNED';
      playerId: PlayerId;
      characterId: CharacterId;
    }
  | {
      type: 'CHARACTER_CHANGED';
      playerId: PlayerId;
      fromCharacterId: CharacterId;
      toCharacterId: CharacterId;
    }
  | { type: 'PHASE_ADVANCED'; from: GamePhase; to: GamePhase }
  | { type: 'PLAYER_DIED'; playerId: PlayerId; reason: string }
  | { type: 'PLAYER_EXECUTED'; playerId: PlayerId }
  | {
      type: 'STATUS_CHANGED';
      playerId: PlayerId;
      statusKey: keyof PlayerStatus;
      value: boolean;
    }
  | { type: 'EFFECT_ADDED'; effect: StatusEffect }
  | { type: 'EFFECT_REMOVED'; playerId: PlayerId; effectId: string }
  | { type: 'REMINDER_ADDED'; reminder: ReminderToken }
  | { type: 'REMINDER_REMOVED'; playerId: PlayerId; reminderId: string }
  | {
      type: 'NIGHT_QUEUE_PREPARED';
      nightNumber: number;
      stepCount: number;
    }
  | {
      type: 'NIGHT_STEP_UPDATED';
      stepId: string;
      status: NightStepStatus;
      targetIds: PlayerId[];
      deathOutcome?: NightDeathOutcome;
      resultSummary?: string;
    }
  | { type: 'BLUFFS_SET'; characterIds: CharacterId[] }
  | { type: 'TIMER_UPDATED'; timer: TimerState }
  | {
      type: 'HISTORY_RESTORED';
      direction: 'undo' | 'redo';
      restoredVersion: number;
    }
  | {
      type: 'NOMINATION_CREATED';
      nominationId: string;
      nominatorId: PlayerId;
      nomineeId: PlayerId;
    }
  | {
      type: 'VOTE_CAST';
      nominationId: string;
      voterId: PlayerId;
      nomineeId: PlayerId;
      value: boolean;
      order: number;
    }
  | {
      type: 'NOMINATION_RESOLVED';
      nominationId: string;
      nomineeId: PlayerId;
      voteCount: number;
      executionThreshold: number;
      reachedExecutionThreshold: boolean;
    }
  | {
      type: 'PRIVATE_INFO_GIVEN';
      playerId: PlayerId;
      infoKind: string;
      /** Storyteller-safe audit summary; never store the full secret payload. */
      summary: string;
      /** @deprecated Use summary. Kept for older event consumers. */
      redactedText?: string;
    }
  | { type: 'GAME_ENDED'; winningAlignment: Alignment; reason: string };

export type GameEvent = GameEventMetadata & GameEventPayload;

export type GameState = {
  id: GameId;
  scriptId: string;
  phase: GamePhase;
  dayNumber: number;
  players: Player[];
  /** Read-only observer data in the MVP; observers never occupy seats. */
  spectators: readonly Spectator[];
  assignments: Assignment[];
  nominations: Nomination[];
  effects: StatusEffect[];
  reminderTokens: ReminderToken[];
  demonBluffs: BluffRole[];
  nightQueue: NightStep[];
  timer: TimerState;
  result?: GameResult;
  /** Command-batch cursor used by persisted undo/redo. */
  historyCursor: number;
  events: GameEvent[];
  /** Last applied event sequence; also supports optimistic concurrency checks. */
  version: number;
  createdAt: string;
  updatedAt: string;
};
