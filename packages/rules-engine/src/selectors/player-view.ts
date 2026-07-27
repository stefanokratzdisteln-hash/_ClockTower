import type {
  Alignment,
  GameEvent,
  GamePhase,
  GameState,
  PlayerId,
} from '@clocktower/shared';

import { getLegalNightTargets } from '../validators/action-validator.js';

export type PlayerPublicReference = {
  id: PlayerId;
  name: string;
  seatIndex: number;
  alive: boolean;
};

export type PlayerPrivateHint = {
  id: string;
  kind: string;
  text: string;
  receivedAt: string;
};

export type PlayerActionPermission = {
  allowed: boolean;
  reason: string;
};

export type PlayerReview = {
  winner?: Alignment;
  reason?: string;
  roles: Array<{
    playerId: PlayerId;
    playerName: string;
    characterId: string;
    alignment: Alignment;
  }>;
  publicTimeline: Array<{
    id: string;
    type: GameEvent['type'];
    occurredAt: string;
  }>;
};

/**
 * The only state shape that may cross the server-to-player boundary.
 *
 * Deliberately absent: assignments for other players, storyteller-only events,
 * reminders, drunk/poison/protection flags and the complete GameState.
 */
export type PlayerView = {
  roomId: string;
  scriptId: string;
  /** Public optimistic-concurrency cursor; contains no hidden game data. */
  version: number;
  phase: GamePhase;
  dayNumber: number;
  self: {
    id: PlayerId;
    name: string;
    seatIndex: number;
    characterId?: string;
    alignment?: Alignment;
    alive: boolean;
    deadVoteAvailable: boolean;
  };
  players: PlayerPublicReference[];
  privateHints: PlayerPrivateHint[];
  permissions: {
    nominate: PlayerActionPermission;
    vote: PlayerActionPermission;
  };
  activeNomination?: {
    id: string;
    nominatorId: PlayerId;
    nomineeId: PlayerId;
    voteCount: number;
    executionThreshold: number;
    hasVoted: boolean;
  };
  nightRequest?: {
    stepId: string;
    characterId: string;
    legalTargets: PlayerPublicReference[];
    selectedTargetIds: PlayerId[];
  };
  review?: PlayerReview;
};

export class PlayerViewPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerViewPermissionError';
  }
}

function isVisibleToPlayer(event: GameEvent, playerId: PlayerId): boolean {
  return (
    event.visibility.scope === 'public' ||
    (event.visibility.scope === 'players' &&
      event.visibility.playerIds.includes(playerId))
  );
}

function permission(allowed: boolean, reason: string): PlayerActionPermission {
  return { allowed, reason: allowed ? '现在可以操作' : reason };
}

/**
 * Projects authoritative state into a new, minimal player-safe object.
 * Call this on the trusted server/room boundary and serialize only its result.
 */
export function selectPlayerView(
  state: GameState,
  playerId: PlayerId,
): PlayerView {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    throw new PlayerViewPermissionError('Player is not a member of this room.');
  }

  const ownAssignment = state.assignments.find(
    (candidate) => candidate.playerId === playerId,
  );
  const status = ownAssignment?.status ?? {
    alive: true,
    deadVoteAvailable: false,
  };
  const activeNomination = [...state.nominations]
    .reverse()
    .find((candidate) => candidate.status === 'open');
  const hasVoted =
    activeNomination?.votes.some((vote) => vote.voterId === playerId) ?? false;
  const nominationOpen = state.phase === 'nomination';
  const voteOpen = state.phase === 'voting' && activeNomination !== undefined;
  const mayVoteWhileDead = !status.alive && status.deadVoteAvailable;

  const visibleEvents = state.events.filter((event) =>
    isVisibleToPlayer(event, playerId),
  );
  const privateHints = visibleEvents
    .filter(
      (event): event is Extract<GameEvent, { type: 'PRIVATE_INFO_GIVEN' }> =>
        event.type === 'PRIVATE_INFO_GIVEN' && event.playerId === playerId,
    )
    .map((event) => ({
      id: event.id,
      kind: event.infoKind,
      text: event.summary,
      receivedAt: event.occurredAt,
    }));

  const gameEnded = state.phase === 'game_over' || state.phase === 'review';
  const nightStep = (state.nightQueue ?? []).find(
    ({ playerId: actorId, status: stepStatus }) =>
      actorId === playerId && stepStatus === 'active',
  );
  const legalNightTargetIds = nightStep
    ? new Set(getLegalNightTargets(state, playerId))
    : new Set<PlayerId>();
  const gameEnd = [...state.events]
    .reverse()
    .find(
      (event): event is Extract<GameEvent, { type: 'GAME_ENDED' }> =>
        event.type === 'GAME_ENDED',
    );

  return {
    roomId: state.id,
    scriptId: state.scriptId,
    version: state.version,
    phase: state.phase,
    dayNumber: state.dayNumber,
    self: {
      id: player.id,
      name: player.name,
      seatIndex: player.seatIndex,
      ...(ownAssignment
        ? {
            characterId: ownAssignment.characterId,
            alignment: ownAssignment.alignment,
          }
        : {}),
      alive: status.alive,
      deadVoteAvailable: status.deadVoteAvailable,
    },
    players: state.players
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        seatIndex: candidate.seatIndex,
        alive:
          state.assignments.find(
            (assignment) => assignment.playerId === candidate.id,
          )?.status.alive ?? true,
      }))
      .sort((left, right) => left.seatIndex - right.seatIndex),
    privateHints,
    permissions: {
      nominate: permission(
        nominationOpen && status.alive,
        !nominationOpen ? '当前不是提名阶段' : '死亡玩家不能发起提名',
      ),
      vote: permission(
        voteOpen && !hasVoted && (status.alive || mayVoteWhileDead),
        !voteOpen
          ? '当前没有进行中的投票'
          : hasVoted
            ? '你已完成本轮投票'
            : '死亡投票权已使用',
      ),
    },
    ...(activeNomination
      ? {
          activeNomination: {
            id: activeNomination.id,
            nominatorId: activeNomination.nominatorId,
            nomineeId: activeNomination.nomineeId,
            voteCount: activeNomination.voteCount,
            executionThreshold: activeNomination.executionThreshold,
            hasVoted,
          },
        }
      : {}),
    ...(nightStep
      ? {
          nightRequest: {
            stepId: nightStep.id,
            characterId: nightStep.characterId,
            legalTargets: state.players
              .filter(({ id }) => legalNightTargetIds.has(id))
              .map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                seatIndex: candidate.seatIndex,
                alive:
                  state.assignments.find(
                    ({ playerId: assignmentPlayerId }) =>
                      assignmentPlayerId === candidate.id,
                  )?.status.alive ?? true,
              })),
            selectedTargetIds: nightStep.targetIds,
          },
        }
      : {}),
    ...(gameEnded
      ? {
          review: {
            ...(gameEnd
              ? {
                  winner: gameEnd.winningAlignment,
                  reason: gameEnd.reason,
                }
              : {}),
            roles: state.assignments.map((assignment) => ({
              playerId: assignment.playerId,
              playerName:
                state.players.find(
                  (candidate) => candidate.id === assignment.playerId,
                )?.name ?? assignment.playerId,
              characterId: assignment.characterId,
              alignment: assignment.alignment,
            })),
            publicTimeline: state.events
              .filter((event) => event.visibility.scope === 'public')
              .map((event) => ({
                id: event.id,
                type: event.type,
                occurredAt: event.occurredAt,
              })),
          },
        }
      : {}),
  };
}
