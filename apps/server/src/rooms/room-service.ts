import { createHash, randomUUID } from 'node:crypto';

import {
  TROUBLE_BREWING_SCRIPT_ID,
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  addReminderToken,
  addStatusEffect,
  addPlayer,
  autoAssignTroubleBrewingCharactersToGame,
  castVote,
  changeAssignedCharacter,
  changePlayerName,
  createNomination,
  createRoom,
  endGame,
  executeNomination,
  givePrivateInfo,
  manuallyAssignTroubleBrewingCharactersToGame,
  prepareNightQueue,
  removePlayer,
  removeReminderToken,
  removeStatusEffect,
  resolveNomination,
  selectPlayerView,
  setDemonBluffs,
  setGameTimer,
  setPlayerSeatOrder,
  setPlayerStatus,
  transitionGamePhase,
  updateNightStep,
  type GameState,
} from '@clocktower/rules-engine';
import type {
  AiSuggestion,
  ClientMessage,
  GameExport,
  PlayerCommand,
  PublicRoomSummary,
  ServerMessage,
  StorytellerCommand,
} from '@clocktower/shared';

import { ReadOnlyAiService } from '../ai/ai-service.js';
import type {
  PersistedRoom,
  PersistedSession,
  RoomRepository,
} from './room-repository.js';

type Session =
  | { role: 'storyteller'; tokenHash: string }
  | { role: 'player'; tokenHash: string; playerId: string };

type SocketClient = {
  send(data: string): void;
  readyState: number;
  close?(code?: number, reason?: string): void;
};

type Connection = { socket: SocketClient; session: Session };

type RoomRecord = {
  state: GameState;
  sessions: Map<string, Session>;
  connections: Set<Connection>;
  suggestions: AiSuggestion[];
  undoStack: GameState[];
  redoStack: GameState[];
  processedRequests: Map<string, number>;
};

const DEMO_NAMES = ['林', '乔', '阿澈', 'Mina', '老周', '小满', '七月'];

export class RoomServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RoomServiceError';
  }
}

function roomCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '');
  if (!normalized)
    throw new RoomServiceError('INVALID_ROOM', '房间码不能为空。');
  return normalized;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class RoomService {
  private readonly rooms = new Map<string, RoomRecord>();

  constructor(
    private readonly ai = new ReadOnlyAiService(),
    private readonly repository?: RoomRepository,
  ) {}

  create(requestedId: string) {
    const id = roomCode(requestedId);
    if (this.rooms.has(id) || this.repository?.load(id)) {
      throw new RoomServiceError('ROOM_EXISTS', '该房间码已存在。');
    }
    const token = randomUUID();
    const hash = tokenHash(token);
    const session: Session = { role: 'storyteller', tokenHash: hash };
    const room: RoomRecord = {
      state: createRoom(
        { id, scriptId: TROUBLE_BREWING_SCRIPT_ID },
        { actor: { type: 'storyteller' } },
      ),
      sessions: new Map([[hash, session]]),
      connections: new Set(),
      suggestions: [],
      undoStack: [],
      redoStack: [],
      processedRequests: new Map(),
    };
    this.rooms.set(id, room);
    this.persist(room);
    return { roomId: id, token };
  }

  join(requestedId: string, name: string) {
    const room = this.getRoom(requestedId);
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new RoomServiceError('INVALID_NAME', '昵称不能为空。');
    }
    const claimedIds = new Set(
      [...room.sessions.values()]
        .filter(
          (session): session is Extract<Session, { role: 'player' }> =>
            session.role === 'player',
        )
        .map((session) => session.playerId),
    );
    let player = room.state.players.find(
      (candidate) =>
        candidate.name.toLocaleLowerCase() ===
        normalizedName.toLocaleLowerCase(),
    );
    if (player && claimedIds.has(player.id)) {
      throw new RoomServiceError(
        'NAME_CLAIMED',
        '该座位已绑定设备，请使用原设备重连。',
      );
    }
    if (!player) {
      if (room.state.phase !== 'lobby') {
        throw new RoomServiceError(
          'GAME_STARTED',
          '游戏已开始，只能恢复已有座位。',
        );
      }
      const playerId = `p-${randomUUID().slice(0, 8)}`;
      room.state = addPlayer(
        room.state,
        { id: playerId, name: normalizedName, experience: 'new' },
        { actor: { type: 'player', playerId } },
      );
      player = room.state.players.find(
        (candidate) => candidate.id === playerId,
      )!;
    }
    const token = randomUUID();
    const hash = tokenHash(token);
    room.sessions.set(hash, {
      role: 'player',
      tokenHash: hash,
      playerId: player.id,
    });
    this.persist(room);
    this.broadcast(room);
    return { roomId: room.state.id, playerId: player.id, token };
  }

  resume(requestedId: string, token: string): Session {
    const session = this.getRoom(requestedId).sessions.get(tokenHash(token));
    if (!session)
      throw new RoomServiceError('UNAUTHORIZED', '会话无效或已过期。');
    return session;
  }

  release(requestedId: string, token: string): void {
    const room = this.getRoom(requestedId);
    const session = room.sessions.get(tokenHash(token));
    if (!session || session.role !== 'storyteller') {
      throw new RoomServiceError('UNAUTHORIZED', '只有说书人可以释放房间。');
    }

    const connections = [...room.connections];
    room.connections.clear();
    this.rooms.delete(room.state.id);
    this.repository?.delete(room.state.id);
    for (const connection of connections) {
      connection.socket.close?.(1000, '房间已由说书人释放');
    }
  }

  connect(
    requestedId: string,
    token: string,
    socket: SocketClient,
  ): () => void {
    const room = this.getRoom(requestedId);
    const session = this.resume(requestedId, token);
    const connection = { socket, session };
    room.connections.add(connection);
    this.broadcast(room);
    return () => {
      room.connections.delete(connection);
      this.broadcast(room);
    };
  }

  handleMessage(
    requestedId: string,
    token: string,
    message: ClientMessage,
  ): number {
    const room = this.getRoom(requestedId);
    const session = this.resume(requestedId, token);
    const processed = room.processedRequests.get(message.requestId);
    if (processed !== undefined) return processed;
    if (
      message.expectedVersion !== undefined &&
      message.expectedVersion !== room.state.version
    ) {
      throw new RoomServiceError(
        'VERSION_CONFLICT',
        `状态已更新（服务端 v${room.state.version}），请基于最新状态重试。`,
      );
    }
    const before = room.state;
    if (session.role === 'storyteller') {
      const command = message.command as StorytellerCommand;
      if (command.type === 'UNDO') {
        this.undo(room);
      } else if (command.type === 'REDO') {
        this.redo(room);
      } else {
        this.applyStorytellerCommand(room, command);
      }
    } else {
      this.applyPlayerCommand(
        room,
        session.playerId,
        message.command as PlayerCommand,
      );
    }
    if (
      room.state !== before &&
      message.command.type !== 'UNDO' &&
      message.command.type !== 'REDO'
    ) {
      room.undoStack.push(before);
      room.undoStack = room.undoStack.slice(-50);
      room.redoStack = [];
    }
    room.processedRequests.set(message.requestId, room.state.version);
    if (room.processedRequests.size > 500) {
      const oldest = room.processedRequests.keys().next().value;
      if (oldest) room.processedRequests.delete(oldest);
    }
    this.persist(room);
    this.broadcast(room);
    return room.state.version;
  }

  getSnapshot(requestedId: string, token: string): ServerMessage {
    const room = this.getRoom(requestedId);
    return this.snapshot(room, this.resume(requestedId, token));
  }

  exportGame(requestedId: string, token: string): GameExport {
    const room = this.getRoom(requestedId);
    const session = this.resume(requestedId, token);
    if (session.role !== 'storyteller') {
      throw new RoomServiceError('UNAUTHORIZED', '只有说书人可以导出游戏。');
    }
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      roomId: room.state.id,
      state: structuredClone(room.state),
      suggestions: structuredClone(room.suggestions),
    };
  }

  importGame(requestedId: string, token: string, data: GameExport): void {
    const room = this.getRoom(requestedId);
    const session = this.resume(requestedId, token);
    if (session.role !== 'storyteller') {
      throw new RoomServiceError('UNAUTHORIZED', '只有说书人可以导入游戏。');
    }
    if (
      data.schemaVersion !== 1 ||
      data.state?.scriptId !== TROUBLE_BREWING_SCRIPT_ID ||
      data.state.id !== room.state.id
    ) {
      throw new RoomServiceError(
        'INVALID_EXPORT',
        '导入文件版本、剧本或房间码不匹配。',
      );
    }
    room.undoStack.push(room.state);
    room.state = this.normalizeState(structuredClone(data.state));
    room.suggestions = structuredClone(data.suggestions ?? []);
    room.redoStack = [];
    this.persist(room);
    this.broadcast(room);
  }

  close(): void {
    this.repository?.close();
  }

  private applyStorytellerCommand(
    room: RoomRecord,
    command: StorytellerCommand,
  ) {
    const state = room.state;
    switch (command.type) {
      case 'ADD_PLAYER':
        room.state = addPlayer(state, {
          id: `p-${randomUUID().slice(0, 8)}`,
          name: command.name,
          experience: command.experience ?? 'regular',
        });
        break;
      case 'REMOVE_PLAYER':
        room.state = removePlayer(state, command.playerId);
        break;
      case 'RENAME_PLAYER':
        room.state = changePlayerName(state, command.playerId, command.name);
        break;
      case 'RELEASE_PLAYER_SESSION':
        for (const [hash, session] of room.sessions) {
          if (
            session.role === 'player' &&
            session.playerId === command.playerId
          ) {
            room.sessions.delete(hash);
          }
        }
        for (const connection of [...room.connections]) {
          if (
            connection.session.role === 'player' &&
            connection.session.playerId === command.playerId
          ) {
            room.connections.delete(connection);
            connection.socket.close?.(1008, '座位绑定已由说书人解除');
          }
        }
        break;
      case 'ADD_DEMO_PLAYERS': {
        let next = state;
        for (const name of DEMO_NAMES) {
          if (next.players.length >= 7) break;
          next = addPlayer(next, {
            id: `p-${randomUUID().slice(0, 8)}`,
            name,
            experience: 'regular',
          });
        }
        room.state = next;
        break;
      }
      case 'SET_SEATS':
        room.state = setPlayerSeatOrder(state, command.playerIds);
        break;
      case 'ADVANCE_PHASE':
        if (
          (state.phase === 'first_night' || state.phase === 'night') &&
          command.to === 'day_discussion' &&
          (state.nightQueue.length === 0 ||
            state.nightQueue.some(
              ({ status }) => status === 'active' || status === 'pending',
            ))
        ) {
          throw new RoomServiceError(
            'NIGHT_INCOMPLETE',
            '请先完成或跳过本夜全部行动，再进入白天。',
          );
        }
        room.state = transitionGamePhase(state, command.to);
        if (
          (command.to === 'first_night' || command.to === 'night') &&
          room.state.nightQueue.length === 0
        ) {
          room.state = prepareNightQueue(room.state);
        }
        break;
      case 'AUTO_ASSIGN':
        room.state = autoAssignTroubleBrewingCharactersToGame(state);
        room.state = setDemonBluffs(
          room.state,
          TROUBLE_BREWING_ROLE_DEFINITIONS.filter(
            (role) =>
              role.alignment === 'good' &&
              !room.state.assignments.some(
                ({ characterId }) => characterId === role.id,
              ),
          )
            .slice(0, 3)
            .map(({ id }) => id),
        );
        break;
      case 'MANUAL_ASSIGN':
        room.state = manuallyAssignTroubleBrewingCharactersToGame(
          state,
          command.assignments,
        );
        break;
      case 'CHANGE_CHARACTER':
        room.state = changeAssignedCharacter(
          state,
          command.playerId,
          command.characterId,
        );
        break;
      case 'SET_BLUFFS':
        room.state = setDemonBluffs(state, command.characterIds);
        break;
      case 'CONFIRM_ALL_IDENTITIES': {
        let next = state;
        for (const player of state.players) {
          const assignment = state.assignments.find(
            ({ playerId }) => playerId === player.id,
          );
          const definition = assignment
            ? TROUBLE_BREWING_ROLE_DEFINITIONS.find(
                ({ id }) => id === assignment.characterId,
              )
            : undefined;
          next = givePrivateInfo(next, {
            playerId: player.id,
            infoKind: 'character-reveal',
            summary: definition
              ? `你的身份是${definition.name}（${assignment?.alignment === 'good' ? '善良' : '邪恶'}阵营）。`
              : '身份已由说书人确认。',
          });
          if (assignment?.alignment === 'evil') {
            const evilTeam = state.assignments
              .filter(
                (candidate) =>
                  candidate.alignment === 'evil' &&
                  candidate.playerId !== player.id,
              )
              .map(
                (candidate) =>
                  state.players.find(({ id }) => id === candidate.playerId)
                    ?.name ?? candidate.playerId,
              );
            next = givePrivateInfo(next, {
              playerId: player.id,
              infoKind: 'evil-team',
              summary: evilTeam.length
                ? `你已确认邪恶同伴：${evilTeam.join('、')}。`
                : '当前没有需要展示的邪恶同伴。',
            });
          }
          if (definition?.type === 'demon' && state.demonBluffs.length) {
            const names = state.demonBluffs.map(
              ({ characterId }) =>
                TROUBLE_BREWING_ROLE_DEFINITIONS.find(
                  ({ id }) => id === characterId,
                )?.name ?? characterId,
            );
            next = givePrivateInfo(next, {
              playerId: player.id,
              infoKind: 'demon-bluffs',
              summary: `不在场角色：${names.join('、')}。`,
            });
          }
        }
        room.state = next;
        break;
      }
      case 'SET_STATUS':
        room.state = setPlayerStatus(
          state,
          command.playerId,
          command.key,
          command.value,
        );
        break;
      case 'ADD_EFFECT':
        room.state = addStatusEffect(state, {
          id: `effect-${randomUUID().slice(0, 8)}`,
          playerId: command.playerId,
          kind: command.kind,
          label: command.label,
          ...(command.sourceRoleId
            ? { sourceRoleId: command.sourceRoleId }
            : {}),
          expiresAt: command.expiresAt,
        });
        break;
      case 'REMOVE_EFFECT':
        room.state = removeStatusEffect(
          state,
          command.playerId,
          command.effectId,
        );
        break;
      case 'ADD_REMINDER':
        room.state = addReminderToken(state, {
          id: `reminder-${randomUUID().slice(0, 8)}`,
          playerId: command.playerId,
          label: command.label,
          ...(command.sourceRoleId
            ? { sourceRoleId: command.sourceRoleId }
            : {}),
          visibility: command.visibility ?? 'storyteller',
        });
        break;
      case 'REMOVE_REMINDER':
        room.state = removeReminderToken(
          state,
          command.playerId,
          command.reminderId,
        );
        break;
      case 'PREPARE_NIGHT':
        room.state = prepareNightQueue(state);
        break;
      case 'UPDATE_NIGHT_STEP':
        room.state = updateNightStep(state, command);
        break;
      case 'SEND_PRIVATE_INFO':
        room.state = givePrivateInfo(state, {
          playerId: command.playerId,
          infoKind: command.infoKind,
          summary: command.summary,
        });
        break;
      case 'SET_TIMER': {
        const durationSeconds = Math.max(0, command.durationSeconds);
        room.state = setGameTimer(state, {
          mode:
            state.phase === 'first_night' || state.phase === 'night'
              ? 'night'
              : 'day',
          durationSeconds,
          remainingSeconds: command.remainingSeconds ?? durationSeconds,
          running: command.running,
          ...(command.running ? { startedAt: new Date().toISOString() } : {}),
        });
        break;
      }
      case 'END_GAME':
        room.state = endGame(state, command.winningAlignment, command.reason);
        break;
      case 'UNDO':
      case 'REDO':
        throw new RoomServiceError(
          'INVALID_HISTORY_COMMAND',
          '撤销与重做必须从顶层命令执行。',
        );
      case 'CREATE_NOMINATION':
        room.state = createNomination(
          state,
          {
            nominationId: `nom-${state.dayNumber}-${state.version + 1}`,
            nominatorId: command.nominatorId,
            nomineeId: command.nomineeId,
          },
          { actor: { type: 'storyteller' } },
        );
        break;
      case 'CAST_VOTE':
        room.state = castVote(state, command, {
          actor: { type: 'storyteller' },
        });
        break;
      case 'RESOLVE_NOMINATION':
        room.state = resolveNomination(state, command.nominationId);
        break;
      case 'EXECUTE_NOMINATION':
        room.state = executeNomination(state, command.nominationId);
        break;
      case 'REQUEST_AI_SUGGESTIONS':
        room.suggestions = this.ai.suggest(this.summarize(state));
        break;
      case 'CONFIRM_AI_SUGGESTION': {
        const suggestion = room.suggestions.find(
          ({ id }) => id === command.suggestionId,
        );
        if (!suggestion)
          throw new RoomServiceError('AI_NOT_FOUND', '建议不存在。');
        room.suggestions = room.suggestions.map((candidate) =>
          candidate.id === suggestion.id
            ? { ...candidate, confirmed: true }
            : candidate,
        );
        // Confirmation is audit/UI state only. It never dispatches a game command.
        break;
      }
      case 'EXECUTE_CONFIRMED_AI_ACTION': {
        const suggestion = room.suggestions.find(
          ({ id }) => id === command.suggestionId,
        );
        if (!suggestion?.confirmed || !suggestion.proposedAction) {
          throw new RoomServiceError(
            'AI_CONFIRMATION_REQUIRED',
            '必须先由说书人确认该建议。',
          );
        }
        if (
          suggestion.proposedAction.type === 'REQUEST_AI_SUGGESTIONS' ||
          suggestion.proposedAction.type === 'CONFIRM_AI_SUGGESTION' ||
          suggestion.proposedAction.type === 'EXECUTE_CONFIRMED_AI_ACTION'
        ) {
          throw new RoomServiceError(
            'INVALID_AI_ACTION',
            'AI 建议不能调用 AI 控制命令。',
          );
        }
        // This is still the normal storyteller command path; every state
        // change below is performed and validated by the rules engine.
        this.applyStorytellerCommand(room, suggestion.proposedAction);
        break;
      }
      default:
        throw new RoomServiceError('FORBIDDEN_COMMAND', '说书人命令不受支持。');
    }
  }

  private applyPlayerCommand(
    room: RoomRecord,
    playerId: string,
    command: PlayerCommand,
  ) {
    const state = room.state;
    switch (command.type) {
      case 'CREATE_NOMINATION':
        room.state = createNomination(
          state,
          {
            nominationId: `nom-${state.dayNumber}-${state.version + 1}`,
            nominatorId: playerId,
            nomineeId: command.nomineeId,
          },
          { actor: { type: 'player', playerId } },
        );
        break;
      case 'SUBMIT_NIGHT_ACTION': {
        const step = state.nightQueue.find(({ id }) => id === command.stepId);
        if (!step || step.playerId !== playerId || step.status !== 'active') {
          throw new RoomServiceError(
            'INVALID_NIGHT_ACTION',
            '当前没有等待你提交的夜间行动。',
          );
        }
        room.state = updateNightStep(state, {
          stepId: command.stepId,
          status: 'active',
          targetIds: command.targetIds,
          resultSummary: '玩家已提交目标，等待说书人确认。',
        });
        break;
      }
      case 'CAST_VOTE':
        room.state = castVote(
          state,
          {
            nominationId: command.nominationId,
            voterId: playerId,
            value: command.value,
          },
          { actor: { type: 'player', playerId } },
        );
        break;
      default:
        throw new RoomServiceError('FORBIDDEN_COMMAND', '玩家无权执行该操作。');
    }
  }

  private summarize(state: GameState): PublicRoomSummary {
    const open = [...state.nominations]
      .reverse()
      .find(({ status }) => status === 'open');
    return {
      id: state.id,
      scriptId: state.scriptId,
      phase: state.phase,
      dayNumber: state.dayNumber,
      version: state.version,
      playerCount: state.players.length,
      aliveCount: state.assignments.filter(({ status }) => status.alive).length,
      experiencedPlayers: state.players.filter(
        ({ experience }) => experience === 'expert',
      ).length,
      newPlayers: state.players.filter(({ experience }) => experience === 'new')
        .length,
      publicEventTypes: state.events
        .filter(({ visibility }) => visibility.scope === 'public')
        .map(({ type }) => type),
      ...(open
        ? {
            openNomination: {
              voteCount: open.voteCount,
              executionThreshold: open.executionThreshold,
            },
          }
        : {}),
    };
  }

  private getRoom(requestedId: string): RoomRecord {
    const id = roomCode(requestedId);
    let room = this.rooms.get(id);
    if (!room) {
      const persisted = this.repository?.load(id);
      if (persisted) {
        room = this.hydrate(persisted);
        this.rooms.set(id, room);
      }
    }
    if (!room) throw new RoomServiceError('ROOM_NOT_FOUND', '房间不存在。');
    return room;
  }

  private undo(room: RoomRecord): void {
    const previous = room.undoStack.pop();
    if (!previous) {
      throw new RoomServiceError('NOTHING_TO_UNDO', '没有可以撤销的操作。');
    }
    room.redoStack.push(room.state);
    room.state = this.restoreHistoryState(room.state, previous, 'undo');
  }

  private redo(room: RoomRecord): void {
    const next = room.redoStack.pop();
    if (!next) {
      throw new RoomServiceError('NOTHING_TO_REDO', '没有可以重做的操作。');
    }
    room.undoStack.push(room.state);
    room.state = this.restoreHistoryState(room.state, next, 'redo');
  }

  private restoreHistoryState(
    current: GameState,
    restored: GameState,
    direction: 'undo' | 'redo',
  ): GameState {
    const occurredAt = new Date().toISOString();
    const sequence = current.version + 1;
    return {
      ...restored,
      historyCursor: restored.version,
      events: [
        ...current.events,
        {
          id: `${current.id}:history:${sequence}`,
          gameId: current.id,
          sequence,
          occurredAt,
          actor: { type: 'storyteller' },
          visibility: { scope: 'storyteller' },
          type: 'HISTORY_RESTORED',
          direction,
          restoredVersion: restored.version,
        },
      ],
      version: sequence,
      updatedAt: occurredAt,
    };
  }

  private normalizeState(state: GameState): GameState {
    const effects = state.effects ?? [];
    return {
      ...state,
      effects,
      reminderTokens: state.reminderTokens ?? [],
      demonBluffs: state.demonBluffs ?? [],
      nightQueue: state.nightQueue ?? [],
      timer: state.timer ?? {
        mode: 'day',
        durationSeconds: 600,
        remainingSeconds: 600,
        running: false,
      },
      historyCursor: state.historyCursor ?? 0,
      assignments: state.assignments.map((assignment) => ({
        ...assignment,
        effects:
          assignment.effects ??
          effects.filter((effect) => effect.playerId === assignment.playerId),
      })),
    };
  }

  private hydrate(persisted: PersistedRoom): RoomRecord {
    const sessions = new Map<string, Session>();
    for (const session of persisted.sessions) {
      sessions.set(session.tokenHash, session as Session);
    }
    return {
      state: this.normalizeState(persisted.state),
      sessions,
      connections: new Set(),
      suggestions: persisted.suggestions ?? [],
      undoStack: persisted.undoStack ?? [],
      redoStack: persisted.redoStack ?? [],
      processedRequests: new Map(persisted.processedRequests ?? []),
    };
  }

  private persist(room: RoomRecord): void {
    if (!this.repository) return;
    const sessions = [...room.sessions.values()].map(
      (session): PersistedSession => ({ ...session }),
    );
    this.repository.save({
      state: room.state,
      sessions,
      suggestions: room.suggestions,
      undoStack: room.undoStack,
      redoStack: room.redoStack,
      processedRequests: [...room.processedRequests.entries()],
    });
  }

  private snapshot(room: RoomRecord, session: Session): ServerMessage {
    return session.role === 'storyteller'
      ? {
          type: 'SNAPSHOT',
          payload: {
            kind: 'storyteller',
            roomId: room.state.id,
            state: structuredClone(room.state),
            suggestions: structuredClone(room.suggestions),
            onlinePlayerIds: [
              ...new Set(
                [...room.connections]
                  .filter(
                    (
                      connection,
                    ): connection is Connection & {
                      session: Extract<Session, { role: 'player' }>;
                    } => connection.session.role === 'player',
                  )
                  .map(({ session }) => session.playerId),
              ),
            ],
          },
        }
      : {
          type: 'SNAPSHOT',
          payload: {
            kind: 'player',
            roomId: room.state.id,
            view: selectPlayerView(room.state, session.playerId),
          },
        };
  }

  private sendSnapshot(room: RoomRecord, connection: Connection) {
    if (connection.socket.readyState === 1) {
      connection.socket.send(
        JSON.stringify(this.snapshot(room, connection.session)),
      );
    }
  }

  private broadcast(room: RoomRecord) {
    for (const connection of room.connections)
      this.sendSnapshot(room, connection);
  }
}
