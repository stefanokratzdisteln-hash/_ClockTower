export { createInitialGameState } from './game-state.js';
export {
  InvalidPlayerStateError,
  givePrivateInfo,
  setPlayerStatus,
} from './player-state.js';
export type {
  GivePrivateInfoInput,
  StateChangeContext,
} from './player-state.js';
export {
  calculateNightOrder,
  getCurrentNightActor,
  getNightOrder,
  nightKindForPhase,
} from './selectors/night-order.js';
export type {
  NightCharacterConfig,
  NightKind,
  NightOrderEntry,
  NightOrderOptions,
} from './selectors/night-order.js';
export {
  PlayerViewPermissionError,
  selectPlayerView,
} from './selectors/player-view.js';
export type {
  PlayerActionPermission,
  PlayerPrivateHint,
  PlayerPublicReference,
  PlayerReview,
  PlayerView,
} from './selectors/player-view.js';
export {
  getLegalNightTargets,
  validateNightAction,
} from './validators/action-validator.js';
export type { NightActionValidation } from './validators/action-validator.js';
export {
  InvalidPhaseTransitionError,
  LEGAL_PHASE_TRANSITIONS,
  isLegalPhaseTransition,
  transitionGamePhase,
  validatePhaseTransition,
} from './phases/phase-machine.js';
export {
  InvalidRoomCommandError,
  addPlayer,
  applyRoomEvent,
  changePlayerName,
  createRoom,
  replayRoomEvents,
  removePlayer,
  setPlayerExperience,
  setPlayerSeatOrder,
} from './rooms/room-state.js';
export type {
  AddPlayerInput,
  CreateRoomInput,
  RoomEventContext,
} from './rooms/room-state.js';
export type {
  PhaseTransitionContext,
  PhaseTransitionValidation,
} from './phases/phase-machine.js';
export {
  InvalidDayActionError,
  castVote,
  createNomination,
  determineWinner,
  executeNomination,
  resolveNomination,
} from './phases/day.js';
export type {
  CastVoteInput,
  CreateNominationInput,
  DayActionContext,
  WinResult,
} from './phases/day.js';
export {
  InvalidCharacterAssignmentError,
  MAX_TROUBLE_BREWING_PLAYERS,
  MIN_TROUBLE_BREWING_PLAYERS,
  TROUBLE_BREWING_ROLES,
  TROUBLE_BREWING_SCRIPT_ID,
  assignTroubleBrewingCharactersManually,
  autoAssignTroubleBrewingCharacters,
  autoAssignTroubleBrewingCharactersToGame,
  getTroubleBrewingDistribution,
  getTroubleBrewingRole,
  validateTroubleBrewingAssignments,
} from './scripts/trouble-brewing.js';
export {
  InvalidGrimoireActionError,
  addReminderToken,
  addStatusEffect,
  changeAssignedCharacter,
  endGame,
  manuallyAssignTroubleBrewingCharactersToGame,
  prepareNightQueue,
  removeReminderToken,
  removeStatusEffect,
  setDemonBluffs,
  setGameTimer,
  updateNightStep,
} from './grimoire-state.js';
export {
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  getTroubleBrewingRoleDefinition,
} from './scripts/role-definitions.js';
export type {
  AssignmentValidationError,
  AssignmentValidationErrorCode,
  AssignmentValidationResult,
  AssignmentContext,
  AutoAssignmentOptions,
  CharacterAssignmentInput,
  RoleDistribution,
  TroubleBrewingAbilityModel,
  TroubleBrewingAbilityTiming,
  TroubleBrewingRole,
} from './scripts/trouble-brewing.js';
export type {
  GameEvent,
  GamePhase,
  GameState,
  PlayerStatus,
  StatusEffect,
  ReminderToken,
  NightStep,
  TimerState,
  Player,
  PlayerExperience,
  Spectator,
} from '@clocktower/shared';
