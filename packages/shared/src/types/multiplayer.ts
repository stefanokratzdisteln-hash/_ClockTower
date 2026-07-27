import type {
  CharacterId,
  GamePhase,
  GameState,
  NightDeathOutcome,
  NightStepStatus,
  PlayerExperience,
  PlayerId,
  StatusEffectExpiry,
  StatusEffectKind,
} from './game.js';

export const AI_SUGGESTION_TYPES = [
  'RULE_HINT',
  'PACE_HINT',
  'BALANCE_HINT',
  'EXPERIENCE_HINT',
  'DRAMA_HINT',
  'REVIEW_SUMMARY',
  'RISK_WARNING',
] as const;

export type AiSuggestionType = (typeof AI_SUGGESTION_TYPES)[number];

export type AiSuggestion = {
  id: string;
  type: AiSuggestionType;
  title: string;
  body: string;
  createdAt: string;
  basedOnVersion: number;
  confirmed: boolean;
  proposedAction?: StorytellerCommand;
};

/** A deliberately lossy, secret-free input shape for the AI service. */
export type PublicRoomSummary = {
  id: string;
  scriptId: string;
  phase: GamePhase;
  dayNumber: number;
  version: number;
  playerCount: number;
  aliveCount: number;
  openNomination?: { voteCount: number; executionThreshold: number };
  experiencedPlayers: number;
  newPlayers: number;
  publicEventTypes: readonly string[];
};

export type StorytellerCommand =
  | { type: 'ADD_PLAYER'; name: string; experience?: PlayerExperience }
  | { type: 'REMOVE_PLAYER'; playerId: PlayerId }
  | { type: 'RENAME_PLAYER'; playerId: PlayerId; name: string }
  | { type: 'RELEASE_PLAYER_SESSION'; playerId: PlayerId }
  | { type: 'ADD_DEMO_PLAYERS' }
  | { type: 'SET_SEATS'; playerIds: PlayerId[] }
  | { type: 'ADVANCE_PHASE'; to: GamePhase }
  | { type: 'AUTO_ASSIGN' }
  | {
      type: 'MANUAL_ASSIGN';
      assignments: Array<{ playerId: PlayerId; characterId: CharacterId }>;
    }
  | {
      type: 'CHANGE_CHARACTER';
      playerId: PlayerId;
      characterId: CharacterId;
    }
  | { type: 'SET_BLUFFS'; characterIds: CharacterId[] }
  | { type: 'CONFIRM_ALL_IDENTITIES' }
  | {
      type: 'SET_STATUS';
      playerId: PlayerId;
      key: 'alive' | 'drunk' | 'poisoned' | 'protected';
      value: boolean;
    }
  | {
      type: 'ADD_EFFECT';
      playerId: PlayerId;
      kind: StatusEffectKind;
      label: string;
      sourceRoleId?: CharacterId;
      expiresAt: StatusEffectExpiry;
    }
  | { type: 'REMOVE_EFFECT'; playerId: PlayerId; effectId: string }
  | {
      type: 'ADD_REMINDER';
      playerId: PlayerId;
      label: string;
      sourceRoleId?: CharacterId;
      visibility?: 'storyteller' | 'public';
    }
  | { type: 'REMOVE_REMINDER'; playerId: PlayerId; reminderId: string }
  | { type: 'PREPARE_NIGHT' }
  | {
      type: 'UPDATE_NIGHT_STEP';
      stepId: string;
      status: NightStepStatus;
      targetIds?: PlayerId[];
      deathOutcome?: NightDeathOutcome;
      resultSummary?: string;
      storytellerNote?: string;
    }
  | {
      type: 'SEND_PRIVATE_INFO';
      playerId: PlayerId;
      infoKind: string;
      summary: string;
    }
  | {
      type: 'SET_TIMER';
      durationSeconds: number;
      remainingSeconds?: number;
      running: boolean;
    }
  | { type: 'END_GAME'; winningAlignment: 'good' | 'evil'; reason: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | {
      type: 'CREATE_NOMINATION';
      nominatorId: PlayerId;
      nomineeId: PlayerId;
    }
  | {
      type: 'CAST_VOTE';
      nominationId: string;
      voterId: PlayerId;
      value: boolean;
    }
  | { type: 'RESOLVE_NOMINATION'; nominationId: string }
  | { type: 'EXECUTE_NOMINATION'; nominationId: string }
  | { type: 'REQUEST_AI_SUGGESTIONS' }
  | { type: 'CONFIRM_AI_SUGGESTION'; suggestionId: string }
  | { type: 'EXECUTE_CONFIRMED_AI_ACTION'; suggestionId: string };

export type PlayerCommand =
  | { type: 'CREATE_NOMINATION'; nomineeId: PlayerId }
  | { type: 'CAST_VOTE'; nominationId: string; value: boolean }
  | {
      type: 'SUBMIT_NIGHT_ACTION';
      stepId: string;
      targetIds: PlayerId[];
    };

export type RoomCommand = StorytellerCommand | PlayerCommand;

export type StorytellerSnapshot = {
  kind: 'storyteller';
  roomId: string;
  state: GameState;
  suggestions: AiSuggestion[];
  onlinePlayerIds: PlayerId[];
};

export type PlayerSnapshot = {
  kind: 'player';
  roomId: string;
  /** Kept structurally decoupled from the rules package. */
  view: unknown;
};

export type ServerMessage =
  | { type: 'SNAPSHOT'; payload: StorytellerSnapshot | PlayerSnapshot }
  | { type: 'COMMAND_ACCEPTED'; requestId: string; version: number }
  | { type: 'ERROR'; requestId?: string; code: string; message: string };

export type ClientMessage = {
  type: 'COMMAND';
  requestId: string;
  expectedVersion?: number;
  command: RoomCommand;
};

export type CreateRoomResponse = { roomId: string; token: string };
export type JoinRoomResponse = {
  roomId: string;
  playerId: string;
  token: string;
};

export type GameExport = {
  schemaVersion: 1;
  exportedAt: string;
  roomId: string;
  state: GameState;
  suggestions: AiSuggestion[];
};
