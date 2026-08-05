import type {
  Alignment,
  EventActor,
  EventVisibility,
  GameEvent,
  GameEventPayload,
  GameState,
  Nomination,
  PlayerId,
} from '@clocktower/shared';

import { getTroubleBrewingRole } from '../scripts/trouble-brewing.js';

export type DayActionContext = {
  occurredAt?: string;
  actor?: EventActor;
  visibility?: EventVisibility;
  correlationId?: string;
  causationId?: string;
};

export type CreateNominationInput = {
  nominationId: string;
  nominatorId: PlayerId;
  nomineeId: PlayerId;
};

export type CastVoteInput = {
  nominationId: string;
  voterId: PlayerId;
  value: boolean;
};

export type WinResult = {
  winningAlignment: Alignment;
  reason: string;
};

export class InvalidDayActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDayActionError';
  }
}

function assignmentFor(state: GameState, playerId: PlayerId) {
  const assignment = state.assignments.find(
    (candidate) => candidate.playerId === playerId,
  );
  if (assignment === undefined) {
    throw new InvalidDayActionError(`Unknown player: ${playerId}.`);
  }
  return assignment;
}

function nominationFor(state: GameState, nominationId: string): Nomination {
  const nomination = state.nominations.find(
    (candidate) => candidate.id === nominationId,
  );
  if (nomination === undefined) {
    throw new InvalidDayActionError(`Unknown nomination: ${nominationId}.`);
  }
  return nomination;
}

function appendEvent(
  state: GameState,
  payload: GameEventPayload,
  context: DayActionContext,
): GameState {
  const sequence = state.version + 1;
  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const event: GameEvent = {
    id: `${state.id}:day:${sequence}`,
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
    ...payload,
  } as GameEvent;

  return {
    ...state,
    events: [...state.events, event],
    version: sequence,
    updatedAt: occurredAt,
  };
}

function executionThreshold(state: GameState): number {
  const aliveCount = state.assignments.filter(
    ({ status }) => status.alive,
  ).length;
  return Math.ceil(aliveCount / 2);
}

export function createNomination(
  state: GameState,
  input: CreateNominationInput,
  context: DayActionContext = {},
): GameState {
  if (state.phase !== 'nomination') {
    throw new InvalidDayActionError(
      `Nominations are only allowed during nomination; current phase is ${state.phase}.`,
    );
  }
  if (state.nominations.some(({ id }) => id === input.nominationId)) {
    throw new InvalidDayActionError(
      `Nomination ${input.nominationId} already exists.`,
    );
  }
  if (state.nominations.some(({ status }) => status === 'open')) {
    throw new InvalidDayActionError(
      'Resolve the current nomination before opening another.',
    );
  }
  if (
    state.nominations.some(
      ({ dayNumber, nominatorId }) =>
        dayNumber === state.dayNumber && nominatorId === input.nominatorId,
    )
  ) {
    throw new InvalidDayActionError('A player may only nominate once per day.');
  }
  if (
    state.nominations.some(
      ({ dayNumber, nomineeId }) =>
        dayNumber === state.dayNumber && nomineeId === input.nomineeId,
    )
  ) {
    throw new InvalidDayActionError(
      'A player may only be nominated once per day.',
    );
  }

  assignmentFor(state, input.nominatorId);
  const nominee = assignmentFor(state, input.nomineeId);
  if (!nominee.status.alive) {
    throw new InvalidDayActionError('Only a living player may be nominated.');
  }

  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const threshold = executionThreshold(state);
  const nomination: Nomination = {
    id: input.nominationId,
    dayNumber: state.dayNumber,
    nominatorId: input.nominatorId,
    nomineeId: input.nomineeId,
    status: 'open',
    votes: [],
    voteCount: 0,
    executionThreshold: threshold,
    reachedExecutionThreshold: false,
    createdAt: occurredAt,
  };

  return appendEvent(
    { ...state, nominations: [...state.nominations, nomination] },
    {
      type: 'NOMINATION_CREATED',
      nominationId: input.nominationId,
      nominatorId: input.nominatorId,
      nomineeId: input.nomineeId,
    },
    { ...context, occurredAt },
  );
}

export function castVote(
  state: GameState,
  input: CastVoteInput,
  context: DayActionContext = {},
): GameState {
  if (state.phase !== 'voting') {
    throw new InvalidDayActionError(
      `Votes are only allowed during voting; current phase is ${state.phase}.`,
    );
  }

  const nomination = nominationFor(state, input.nominationId);
  if (nomination.status !== 'open') {
    throw new InvalidDayActionError('The nomination is no longer open.');
  }
  if (nomination.votes.some(({ voterId }) => voterId === input.voterId)) {
    throw new InvalidDayActionError(
      'A player may only vote once per nomination.',
    );
  }

  const voter = assignmentFor(state, input.voterId);
  if (!voter.status.alive && !voter.status.deadVoteAvailable) {
    throw new InvalidDayActionError(
      'This dead player has no dead vote available.',
    );
  }

  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const order = nomination.votes.length + 1;
  const votes = [
    ...nomination.votes,
    { voterId: input.voterId, value: input.value, order, castAt: occurredAt },
  ];
  const voteCount = votes.filter(({ value }) => value).length;
  const reachedExecutionThreshold = voteCount >= nomination.executionThreshold;
  let next: GameState = {
    ...state,
    nominations: state.nominations.map((candidate) =>
      candidate.id === nomination.id
        ? {
            ...candidate,
            votes,
            voteCount,
            reachedExecutionThreshold,
          }
        : candidate,
    ),
  };

  next = appendEvent(
    next,
    {
      type: 'VOTE_CAST',
      nominationId: nomination.id,
      voterId: input.voterId,
      nomineeId: nomination.nomineeId,
      value: input.value,
      order,
    },
    { ...context, occurredAt },
  );

  if (!voter.status.alive && input.value) {
    next = {
      ...next,
      assignments: next.assignments.map((assignment) =>
        assignment.playerId === input.voterId
          ? {
              ...assignment,
              status: { ...assignment.status, deadVoteAvailable: false },
            }
          : assignment,
      ),
    };
    next = appendEvent(
      next,
      {
        type: 'STATUS_CHANGED',
        playerId: input.voterId,
        statusKey: 'deadVoteAvailable',
        value: false,
      },
      { ...context, occurredAt },
    );
  }

  return next;
}

export function resolveNomination(
  state: GameState,
  nominationId: string,
  context: DayActionContext = {},
): GameState {
  if (state.phase !== 'voting') {
    throw new InvalidDayActionError(
      `Votes can only be resolved during voting; current phase is ${state.phase}.`,
    );
  }
  const nomination = nominationFor(state, nominationId);
  if (nomination.status !== 'open') {
    throw new InvalidDayActionError('The nomination is already resolved.');
  }

  const occurredAt = context.occurredAt ?? new Date().toISOString();
  const resolved = {
    ...nomination,
    status: 'resolved' as const,
    resolvedAt: occurredAt,
  };
  return appendEvent(
    {
      ...state,
      nominations: state.nominations.map((candidate) =>
        candidate.id === nominationId ? resolved : candidate,
      ),
    },
    {
      type: 'NOMINATION_RESOLVED',
      nominationId,
      nomineeId: nomination.nomineeId,
      voteCount: nomination.voteCount,
      executionThreshold: nomination.executionThreshold,
      reachedExecutionThreshold: nomination.reachedExecutionThreshold,
    },
    { ...context, occurredAt },
  );
}

export function determineWinner(state: GameState): WinResult | undefined {
  const livingDemon = state.assignments.some(({ characterId, status }) => {
    const role = getTroubleBrewingRole(characterId);
    return role?.type === 'demon' && status.alive;
  });
  if (!livingDemon) {
    return {
      winningAlignment: 'good',
      reason: 'The Demon is dead.',
    };
  }

  const aliveCount = state.assignments.filter(
    ({ status }) => status.alive,
  ).length;
  if (aliveCount <= 2) {
    return {
      winningAlignment: 'evil',
      reason: 'Two or fewer players remain alive.',
    };
  }
  return undefined;
}

export function executeNomination(
  state: GameState,
  nominationId: string,
  context: DayActionContext = {},
): GameState {
  if (state.phase !== 'execution_resolution') {
    throw new InvalidDayActionError(
      `Executions are only allowed during execution_resolution; current phase is ${state.phase}.`,
    );
  }
  const nomination = nominationFor(state, nominationId);
  if (nomination.status !== 'resolved') {
    throw new InvalidDayActionError('The nomination must be resolved first.');
  }
  if (!nomination.reachedExecutionThreshold) {
    throw new InvalidDayActionError(
      'The nomination did not reach the execution threshold.',
    );
  }
  const sameDayCandidates = state.nominations.filter(
    (candidate) =>
      candidate.dayNumber === nomination.dayNumber &&
      candidate.status === 'resolved' &&
      candidate.reachedExecutionThreshold,
  );
  const highestVotes = Math.max(
    0,
    ...sameDayCandidates.map(({ voteCount }) => voteCount),
  );
  const tiedAtTop = sameDayCandidates.filter(
    ({ voteCount }) => voteCount === highestVotes,
  );
  if (nomination.voteCount !== highestVotes || tiedAtTop.length !== 1) {
    throw new InvalidDayActionError(
      'Only the unique highest-voted nominee may be executed.',
    );
  }

  const nominee = assignmentFor(state, nomination.nomineeId);
  if (!nominee.status.alive) {
    throw new InvalidDayActionError('The nominee is already dead.');
  }

  const occurredAt = context.occurredAt ?? new Date().toISOString();
  let next: GameState = {
    ...state,
    assignments: state.assignments.map((assignment) =>
      assignment.playerId === nomination.nomineeId
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
    { type: 'PLAYER_EXECUTED', playerId: nomination.nomineeId },
    { ...context, occurredAt },
  );

  if (
    nominee.characterId === 'saint' &&
    !nominee.status.drunk &&
    !nominee.status.poisoned
  ) {
    const result = {
      winningAlignment: 'evil' as const,
      reason: 'The Saint died by execution.',
      endedAt: occurredAt,
    };
    return appendEvent(
      { ...next, phase: 'game_over', result },
      {
        type: 'GAME_ENDED',
        winningAlignment: result.winningAlignment,
        reason: result.reason,
      },
      { ...context, occurredAt },
    );
  }

  const nomineeRole = getTroubleBrewingRole(nominee.characterId);
  const aliveBeforeExecution = state.assignments.filter(
    ({ status }) => status.alive,
  ).length;
  if (nomineeRole?.type === 'demon' && aliveBeforeExecution >= 5) {
    const successor = next.assignments.find(
      ({ characterId, status }) =>
        characterId === 'scarlet_woman' &&
        status.alive &&
        !status.drunk &&
        !status.poisoned,
    );
    if (successor) {
      next = {
        ...next,
        assignments: next.assignments.map((assignment) =>
          assignment.playerId === successor.playerId
            ? { ...assignment, characterId: 'imp', alignment: 'evil' }
            : assignment,
        ),
      };
      next = appendEvent(
        next,
        {
          type: 'CHARACTER_CHANGED',
          playerId: successor.playerId,
          fromCharacterId: 'scarlet_woman',
          toCharacterId: 'imp',
        },
        { ...context, occurredAt },
      );
    }
  }

  const winner = determineWinner(next);
  if (winner !== undefined) {
    next = appendEvent(
      {
        ...next,
        phase: 'game_over',
        result: { ...winner, endedAt: occurredAt },
      },
      { type: 'GAME_ENDED', ...winner },
      { ...context, occurredAt },
    );
  }
  return next;
}
