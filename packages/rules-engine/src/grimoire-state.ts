import type {
  CharacterId,
  EventVisibility,
  GameEvent,
  GameEventPayload,
  GameState,
  NightStepStatus,
  NightDeathOutcome,
  PlayerId,
  ReminderToken,
  StatusEffect,
  StatusEffectExpiry,
  StatusEffectKind,
  TimerState,
} from '@clocktower/shared';

import { getNightOrder } from './selectors/night-order.js';
import { validateNightAction } from './validators/action-validator.js';
import { determineWinner } from './phases/day.js';
import {
  assignTroubleBrewingCharactersManually,
  getTroubleBrewingRole,
  type CharacterAssignmentInput,
} from './scripts/trouble-brewing.js';

export type GrimoireContext = {
  occurredAt?: string;
  correlationId?: string;
  visibility?: EventVisibility;
};

export class InvalidGrimoireActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGrimoireActionError';
  }
}

function requireAssignment(state: GameState, playerId: PlayerId) {
  const assignment = state.assignments.find(
    (candidate) => candidate.playerId === playerId,
  );
  if (!assignment) {
    throw new InvalidGrimoireActionError(
      `Unknown assigned player: ${playerId}`,
    );
  }
  return assignment;
}

function appendEvent(
  state: GameState,
  payload: GameEventPayload,
  context: GrimoireContext = {},
): GameState {
  const sequence = state.version + 1;
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const event = {
    id: `${state.id}:grimoire:${sequence}`,
    gameId: state.id,
    sequence,
    occurredAt,
    actor: { type: 'storyteller' },
    visibility: context.visibility ?? { scope: 'storyteller' },
    ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    ...payload,
  } as GameEvent;
  return {
    ...state,
    events: [...state.events, event],
    version: sequence,
    updatedAt: occurredAt,
  };
}

export function manuallyAssignTroubleBrewingCharactersToGame(
  state: GameState,
  inputs: readonly CharacterAssignmentInput[],
  context: GrimoireContext = {},
): GameState {
  if (state.phase !== 'assign_characters') {
    throw new InvalidGrimoireActionError(
      'Manual assignment is only available during character assignment.',
    );
  }
  const assignments = assignTroubleBrewingCharactersManually(
    state.players.map(({ id }) => id),
    inputs,
  );
  let next = { ...state, assignments };
  for (const assignment of assignments) {
    next = appendEvent(
      next,
      {
        type: 'CHARACTER_ASSIGNED',
        playerId: assignment.playerId,
        characterId: assignment.characterId,
      },
      context,
    );
  }
  return next;
}

export function setDemonBluffs(
  state: GameState,
  characterIds: readonly CharacterId[],
  context: GrimoireContext = {},
): GameState {
  if (characterIds.length !== 3 || new Set(characterIds).size !== 3) {
    throw new InvalidGrimoireActionError(
      'Exactly three distinct demon bluffs are required.',
    );
  }
  for (const id of characterIds) {
    if (!getTroubleBrewingRole(id)) {
      throw new InvalidGrimoireActionError(
        `Unknown Trouble Brewing role: ${id}`,
      );
    }
    if (state.assignments.some(({ characterId }) => characterId === id)) {
      throw new InvalidGrimoireActionError(
        `Demon bluff must not be in play: ${id}`,
      );
    }
  }
  return appendEvent(
    {
      ...state,
      demonBluffs: characterIds.map((characterId) => ({
        characterId,
        revealed: false,
      })),
    },
    { type: 'BLUFFS_SET', characterIds: [...characterIds] },
    context,
  );
}

export function changeAssignedCharacter(
  state: GameState,
  playerId: PlayerId,
  characterId: CharacterId,
  context: GrimoireContext = {},
): GameState {
  const assignment = requireAssignment(state, playerId);
  const role = getTroubleBrewingRole(characterId);
  if (!role) {
    throw new InvalidGrimoireActionError(
      `Unknown Trouble Brewing role: ${characterId}`,
    );
  }
  if (assignment.characterId === characterId) return state;
  const next: GameState = {
    ...state,
    assignments: state.assignments.map((candidate) =>
      candidate.playerId === playerId
        ? {
            ...candidate,
            characterId,
            alignment: role.alignment,
          }
        : candidate,
    ),
  };
  return appendEvent(
    next,
    {
      type: 'CHARACTER_CHANGED',
      playerId,
      fromCharacterId: assignment.characterId,
      toCharacterId: characterId,
    },
    context,
  );
}

export function addStatusEffect(
  state: GameState,
  input: {
    id: string;
    playerId: PlayerId;
    kind: StatusEffectKind;
    label: string;
    sourceRoleId?: CharacterId;
    expiresAt: StatusEffectExpiry;
  },
  context: GrimoireContext = {},
): GameState {
  const assignment = requireAssignment(state, input.playerId);
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const effect: StatusEffect = {
    ...input,
    label: input.label.trim() || input.kind,
    createdAt: occurredAt,
  };
  const effects = [
    ...state.effects.filter(
      (candidate) =>
        !(
          candidate.playerId === input.playerId &&
          candidate.kind === input.kind &&
          candidate.sourceRoleId === input.sourceRoleId
        ),
    ),
    effect,
  ];
  const statusPatch =
    input.kind === 'drunk' ||
    input.kind === 'poisoned' ||
    input.kind === 'protected'
      ? { [input.kind]: true }
      : {};
  const next = {
    ...state,
    effects,
    assignments: state.assignments.map((candidate) =>
      candidate.playerId === input.playerId
        ? {
            ...candidate,
            effects: [
              ...candidate.effects.filter(
                (existing) =>
                  !(
                    existing.kind === effect.kind &&
                    existing.sourceRoleId === effect.sourceRoleId
                  ),
              ),
              effect,
            ],
            status: { ...assignment.status, ...statusPatch },
          }
        : candidate,
    ),
  };
  return appendEvent(
    next,
    { type: 'EFFECT_ADDED', effect },
    {
      ...context,
      occurredAt,
    },
  );
}

export function removeStatusEffect(
  state: GameState,
  playerId: PlayerId,
  effectId: string,
  context: GrimoireContext = {},
): GameState {
  requireAssignment(state, playerId);
  const removed = state.effects.find(
    (effect) => effect.playerId === playerId && effect.id === effectId,
  );
  if (!removed) return state;
  const remaining = state.effects.filter((effect) => effect.id !== effectId);
  const stillActive = remaining.some(
    (effect) => effect.playerId === playerId && effect.kind === removed.kind,
  );
  const statusPatch =
    removed.kind === 'drunk' ||
    removed.kind === 'poisoned' ||
    removed.kind === 'protected'
      ? { [removed.kind]: stillActive }
      : {};
  const next = {
    ...state,
    effects: remaining,
    assignments: state.assignments.map((assignment) =>
      assignment.playerId === playerId
        ? {
            ...assignment,
            effects: assignment.effects.filter(
              (effect) => effect.id !== effectId,
            ),
            status: { ...assignment.status, ...statusPatch },
          }
        : assignment,
    ),
  };
  return appendEvent(
    next,
    { type: 'EFFECT_REMOVED', playerId, effectId },
    context,
  );
}

export function addReminderToken(
  state: GameState,
  reminder: Omit<ReminderToken, 'createdAt'>,
  context: GrimoireContext = {},
): GameState {
  requireAssignment(state, reminder.playerId);
  const token: ReminderToken = {
    ...reminder,
    label: reminder.label.trim(),
    createdAt: context.occurredAt ?? new Date().toISOString(),
  };
  if (!token.label) {
    throw new InvalidGrimoireActionError('Reminder label must not be empty.');
  }
  const next = {
    ...state,
    reminderTokens: [...state.reminderTokens, token],
    assignments: state.assignments.map((assignment) =>
      assignment.playerId === reminder.playerId
        ? {
            ...assignment,
            reminders: [...assignment.reminders, token.label],
          }
        : assignment,
    ),
  };
  return appendEvent(
    next,
    { type: 'REMINDER_ADDED', reminder: token },
    context,
  );
}

export function removeReminderToken(
  state: GameState,
  playerId: PlayerId,
  reminderId: string,
  context: GrimoireContext = {},
): GameState {
  const reminder = state.reminderTokens.find(
    (candidate) =>
      candidate.playerId === playerId && candidate.id === reminderId,
  );
  if (!reminder) return state;
  const next = {
    ...state,
    reminderTokens: state.reminderTokens.filter(
      (candidate) => candidate.id !== reminderId,
    ),
    assignments: state.assignments.map((assignment) =>
      assignment.playerId === playerId
        ? {
            ...assignment,
            reminders: assignment.reminders.filter(
              (label) => label !== reminder.label,
            ),
          }
        : assignment,
    ),
  };
  return appendEvent(
    next,
    { type: 'REMINDER_REMOVED', playerId, reminderId },
    context,
  );
}

export function prepareNightQueue(
  state: GameState,
  context: GrimoireContext = {},
): GameState {
  const entries = getNightOrder(state);
  if (!entries.length) {
    throw new InvalidGrimoireActionError(
      'Night queue is only available during a configured night phase.',
    );
  }
  const nightNumber = state.phase === 'first_night' ? 1 : state.dayNumber + 1;
  const next: GameState = {
    ...state,
    nightQueue: entries.map((entry, index) => ({
      id: `${state.id}:night:${nightNumber}:${index + 1}`,
      nightNumber,
      ...entry,
      status: index === 0 ? 'active' : 'pending',
      targetIds: [],
    })),
  };
  return appendEvent(
    next,
    {
      type: 'NIGHT_QUEUE_PREPARED',
      nightNumber,
      stepCount: entries.length,
    },
    context,
  );
}

export function updateNightStep(
  state: GameState,
  input: {
    stepId: string;
    status: NightStepStatus;
    targetIds?: PlayerId[];
    deathOutcome?: NightDeathOutcome;
    resultSummary?: string;
    storytellerNote?: string;
  },
  context: GrimoireContext = {},
): GameState {
  const current = state.nightQueue.find(({ id }) => id === input.stepId);
  if (!current) {
    throw new InvalidGrimoireActionError(`Unknown night step: ${input.stepId}`);
  }
  if (input.targetIds && input.targetIds.length > 0) {
    const validation = validateNightAction(
      state,
      current.playerId,
      input.targetIds,
    );
    if (!validation.valid) {
      throw new InvalidGrimoireActionError(validation.errors.join(' '));
    }
  }
  if (
    current.characterId === 'imp' &&
    input.status === 'completed' &&
    !input.deathOutcome
  ) {
    throw new InvalidGrimoireActionError(
      'The Storyteller must confirm the Imp attack outcome.',
    );
  }
  const now = context.occurredAt ?? new Date().toISOString();
  let queue = state.nightQueue.map((step) =>
    step.id === input.stepId
      ? {
          ...step,
          status: input.status,
          targetIds: input.targetIds ?? step.targetIds,
          ...(input.deathOutcome === undefined
            ? {}
            : { deathOutcome: input.deathOutcome }),
          ...(input.resultSummary === undefined
            ? {}
            : { resultSummary: input.resultSummary }),
          ...(input.storytellerNote === undefined
            ? {}
            : { storytellerNote: input.storytellerNote }),
          ...(input.status === 'active' && !step.startedAt
            ? { startedAt: now }
            : {}),
          ...(input.status === 'completed' || input.status === 'skipped'
            ? { completedAt: now }
            : {}),
        }
      : step,
  );
  if (input.status === 'completed' || input.status === 'skipped') {
    const nextIndex = queue.findIndex(({ status }) => status === 'pending');
    if (nextIndex >= 0) {
      queue = queue.map((step, index) =>
        index === nextIndex
          ? { ...step, status: 'active' as const, startedAt: now }
          : step,
      );
    }
  }
  let next = appendEvent(
    { ...state, nightQueue: queue },
    {
      type: 'NIGHT_STEP_UPDATED',
      stepId: input.stepId,
      status: input.status,
      targetIds: input.targetIds ?? current.targetIds,
      ...(input.deathOutcome === undefined
        ? {}
        : { deathOutcome: input.deathOutcome }),
      ...(input.resultSummary === undefined
        ? {}
        : { resultSummary: input.resultSummary }),
    },
    { ...context, occurredAt: now },
  );
  if (input.status !== 'completed' || input.deathOutcome?.type !== 'death') {
    return next;
  }
  const deathOutcome = input.deathOutcome;

  const victim = requireAssignment(next, deathOutcome.playerId);
  if (!victim.status.alive) {
    throw new InvalidGrimoireActionError('The selected night victim is dead.');
  }
  const attackedPlayerId = (input.targetIds ?? current.targetIds)[0];
  if (!attackedPlayerId) {
    throw new InvalidGrimoireActionError(
      'The Imp attack requires an attacked player.',
    );
  }
  if (
    deathOutcome.playerId !== attackedPlayerId &&
    requireAssignment(next, attackedPlayerId).characterId !== 'mayor'
  ) {
    throw new InvalidGrimoireActionError(
      'A demon death may only be redirected from the Mayor.',
    );
  }
  if (
    deathOutcome.playerId === current.playerId &&
    current.characterId === 'imp' &&
    !deathOutcome.newDemonPlayerId
  ) {
    const eligibleSuccessor = next.assignments.some((assignment) => {
      const role = getTroubleBrewingRole(assignment.characterId);
      return (
        role?.type === 'minion' &&
        assignment.status.alive &&
        !assignment.status.drunk &&
        !assignment.status.poisoned
      );
    });
    if (eligibleSuccessor) {
      throw new InvalidGrimoireActionError(
        'Choose an alive, healthy Minion to become the new Imp.',
      );
    }
  }

  next = {
    ...next,
    assignments: next.assignments.map((assignment) =>
      assignment.playerId === deathOutcome.playerId
        ? {
            ...assignment,
            status: {
              ...assignment.status,
              alive: false,
              deadVoteAvailable: true,
            },
          }
        : assignment,
    ),
  };
  next = appendEvent(
    next,
    {
      type: 'PLAYER_DIED',
      playerId: deathOutcome.playerId,
      reason: deathOutcome.reason ?? 'Demon attack during the night.',
    },
    { ...context, occurredAt: now, visibility: { scope: 'public' } },
  );

  if (
    deathOutcome.playerId === current.playerId &&
    current.characterId === 'imp'
  ) {
    const successorId = deathOutcome.newDemonPlayerId;
    if (successorId) {
      const successor = requireAssignment(next, successorId);
      const successorRole = getTroubleBrewingRole(successor.characterId);
      if (
        !successor.status.alive ||
        successorRole?.type !== 'minion' ||
        successor.status.drunk ||
        successor.status.poisoned
      ) {
        throw new InvalidGrimoireActionError(
          'The new demon must be an alive, healthy Minion.',
        );
      }
      next = {
        ...next,
        assignments: next.assignments.map((assignment) =>
          assignment.playerId === successorId
            ? { ...assignment, characterId: 'imp', alignment: 'evil' }
            : assignment,
        ),
      };
      next = appendEvent(
        next,
        {
          type: 'CHARACTER_CHANGED',
          playerId: successorId,
          fromCharacterId: successor.characterId,
          toCharacterId: 'imp',
        },
        { ...context, occurredAt: now },
      );
    }
  }

  const winner = determineWinner(next);
  if (winner) {
    next = appendEvent(
      { ...next, phase: 'game_over' },
      { type: 'GAME_ENDED', ...winner },
      { ...context, occurredAt: now, visibility: { scope: 'public' } },
    );
  }
  return next;
}

export function setGameTimer(
  state: GameState,
  timer: TimerState,
  context: GrimoireContext = {},
): GameState {
  if (
    timer.durationSeconds < 0 ||
    timer.remainingSeconds < 0 ||
    timer.remainingSeconds > timer.durationSeconds
  ) {
    throw new InvalidGrimoireActionError('Invalid timer values.');
  }
  return appendEvent(
    { ...state, timer },
    { type: 'TIMER_UPDATED', timer },
    context,
  );
}

export function endGame(
  state: GameState,
  winningAlignment: 'good' | 'evil',
  reason: string,
  context: GrimoireContext = {},
): GameState {
  const endedAt = context.occurredAt ?? new Date().toISOString();
  const result = { winningAlignment, reason: reason.trim(), endedAt };
  return appendEvent(
    { ...state, phase: 'game_over', result },
    { type: 'GAME_ENDED', winningAlignment, reason: result.reason },
    { ...context, occurredAt: endedAt },
  );
}
