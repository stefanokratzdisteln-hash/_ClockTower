import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';

import {
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  getLegalNightTargets,
  type GameEvent,
  type GamePhase,
  type GameState,
} from '@clocktower/rules-engine';
import type { GameExport, StorytellerCommand } from '@clocktower/shared';

import { USER_ASSETS } from './assets-manifest.js';
import { PlayerPortal } from './pages/player-portal.js';
import { useRoomConnection } from './stores/room-connection.js';

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: '房间准备',
  setup_players: '设置座位',
  assign_characters: '分配身份',
  private_reveal: '身份确认',
  first_night: '首夜',
  day_discussion: '白天讨论',
  nomination: '提名',
  voting: '投票',
  execution_resolution: '处决结算',
  night: '夜晚',
  game_over: '游戏结束',
  review: '复盘',
};

const ROLE_NAMES: Record<string, string> = {
  washerwoman: '洗衣妇',
  librarian: '图书管理员',
  investigator: '调查员',
  chef: '厨师',
  empath: '共情者',
  fortune_teller: '占卜师',
  undertaker: '掘墓人',
  monk: '僧侣',
  ravenkeeper: '守鸦人',
  virgin: '贞洁者',
  slayer: '猎手',
  soldier: '士兵',
  mayor: '市长',
  butler: '管家',
  drunk: '酒鬼',
  recluse: '隐士',
  saint: '圣徒',
  poisoner: '投毒者',
  spy: '间谍',
  scarlet_woman: '红唇女郎',
  baron: '男爵',
  imp: '小恶魔',
};

const NEXT_PHASE: Partial<Record<GamePhase, GamePhase>> = {
  lobby: 'setup_players',
  setup_players: 'assign_characters',
  assign_characters: 'private_reveal',
  private_reveal: 'first_night',
  first_night: 'day_discussion',
  day_discussion: 'nomination',
  nomination: 'voting',
  voting: 'execution_resolution',
  execution_resolution: 'night',
  night: 'day_discussion',
  game_over: 'review',
};

function eventText(event: GameEvent, state: GameState) {
  const name = (id: string) =>
    state.players.find((player) => player.id === id)?.name ?? id;
  switch (event.type) {
    case 'ROOM_CREATED':
      return '房间已创建';
    case 'PLAYER_ADDED':
      return `${event.name} 加入房间`;
    case 'PLAYER_REMOVED':
      return `${event.name} 离开房间`;
    case 'PLAYER_JOINED':
      return `${event.name} 已连接`;
    case 'PLAYER_NAME_CHANGED':
      return `${name(event.playerId)} 修改了昵称`;
    case 'PLAYER_EXPERIENCE_CHANGED':
      return `${name(event.playerId)} 更新了经验等级`;
    case 'PLAYER_SEATS_SET':
      return '玩家座位顺序已更新';
    case 'SEAT_CHANGED':
      return `${name(event.playerId)} 移至 ${event.seatIndex + 1} 号座位`;
    case 'PHASE_ADVANCED':
      return `${PHASE_LABELS[event.from]} → ${PHASE_LABELS[event.to]}`;
    case 'CHARACTER_ASSIGNED':
      return `${name(event.playerId)} 已分配身份`;
    case 'CHARACTER_CHANGED':
      return `${name(event.playerId)} 的身份已调整为 ${
        ROLE_NAMES[event.toCharacterId] ?? event.toCharacterId
      }`;
    case 'PRIVATE_INFO_GIVEN':
      return `已向 ${name(event.playerId)} 发送私密信息：${event.summary}`;
    case 'NOMINATION_CREATED':
      return `${name(event.nominatorId)} 提名 ${name(event.nomineeId)}`;
    case 'VOTE_CAST':
      return `${name(event.voterId)} ${event.value ? '举手' : '未举手'}`;
    case 'NOMINATION_RESOLVED':
      return `投票结算 ${event.voteCount}/${event.executionThreshold}`;
    case 'PLAYER_EXECUTED':
      return `${name(event.playerId)} 被处决`;
    case 'PLAYER_DIED':
      return `${name(event.playerId)} 死亡：${event.reason}`;
    case 'STATUS_CHANGED':
      return `${name(event.playerId)} 的 ${event.statusKey} 状态变为 ${
        event.value ? '是' : '否'
      }`;
    case 'EFFECT_ADDED':
      return `${name(event.effect.playerId)} 添加状态：${event.effect.label}`;
    case 'EFFECT_REMOVED':
      return `${name(event.playerId)} 移除状态`;
    case 'REMINDER_ADDED':
      return `${name(event.reminder.playerId)} 添加提醒：${event.reminder.label}`;
    case 'REMINDER_REMOVED':
      return `${name(event.playerId)} 移除提醒`;
    case 'NIGHT_QUEUE_PREPARED':
      return `第 ${event.nightNumber} 夜行动队列已生成（${event.stepCount} 步）`;
    case 'NIGHT_STEP_UPDATED':
      return `夜晚步骤更新：${event.status}`;
    case 'BLUFFS_SET':
      return '已设置恶魔伪装角色';
    case 'TIMER_UPDATED':
      return `${event.timer.mode === 'night' ? '夜晚' : '白天'}计时器已更新`;
    case 'HISTORY_RESTORED':
      return event.direction === 'undo' ? '已撤销上一操作' : '已重做操作';
    case 'GAME_ENDED':
      return `${event.winningAlignment === 'good' ? '善良' : '邪恶'}阵营获胜：${event.reason}`;
  }
}

export function App() {
  const room = useRoomConnection();
  const [roomCode, setRoomCode] = useState(
    `TB-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`,
  );

  if (room.role === 'player') {
    return (
      <PlayerPortal
        roomId={room.roomId}
        view={room.playerView}
        error={room.error}
        onJoin={(code, name) =>
          void room
            .join(code, name)
            .catch((error: Error) => room.setError(error.message))
        }
        onNominate={(nomineeId) =>
          room.send({ type: 'CREATE_NOMINATION', nomineeId })
        }
        onVote={(value) => {
          if (room.playerView?.activeNomination) {
            room.send({
              type: 'CAST_VOTE',
              nominationId: room.playerView.activeNomination.id,
              value,
            });
          }
        }}
        onNightAction={(stepId, targetIds) =>
          room.send({ type: 'SUBMIT_NIGHT_ACTION', stepId, targetIds })
        }
        onLeave={() => {
          room.disconnect(true);
          window.history.replaceState({}, '', window.location.pathname);
        }}
        onBackToStoryteller={() => {
          room.disconnect(true);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (!room.game) {
    return (
      <main className="welcome-shell">
        <section className="create-room">
          <div className="brand-mark">◈</div>
          <p className="eyebrow">MULTIPLAYER STORYTELLER</p>
          <h1>暗流涌动</h1>
          <p className="muted">
            服务端权威房间 · 玩家手机实时同步 · 可断线恢复
          </p>
          <label>
            房间码
            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
            />
          </label>
          {room.error && <div className="error">{room.error}</div>}
          <button
            className="primary large"
            onClick={() =>
              void room
                .create(roomCode)
                .catch((error: Error) => room.setError(error.message))
            }
          >
            创建多人房间 <span>→</span>
          </button>
          <a
            className="join-link"
            href={`?room=${encodeURIComponent(roomCode)}&player=1`}
          >
            我是玩家，加入房间
          </a>
        </section>
      </main>
    );
  }

  return <StorytellerConsole room={{ ...room, game: room.game }} />;
}

type RoomModel = ReturnType<typeof useRoomConnection> & { game: GameState };

function StorytellerConsole({ room }: { room: RoomModel }) {
  const game = room.game;
  const [name, setName] = useState('');
  const [nominatorId, setNominatorId] = useState('');
  const [nomineeId, setNomineeId] = useState('');
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [suggestionPage, setSuggestionPage] = useState(0);
  const [activeTool, setActiveTool] = useState<
    'grimoire' | 'roles' | 'night' | 'review'
  >('grimoire');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [hideIdentities, setHideIdentities] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<
    Record<string, string>
  >({});
  const [reminderLabel, setReminderLabel] = useState('');
  const [privateInfo, setPrivateInfo] = useState('');
  const [now, setNow] = useState(Date.now());
  const [animationsEnabled, setAnimationsEnabled] = useState(
    localStorage.getItem('clocktower:animations') !== 'off',
  );
  const [transitionSource, setTransitionSource] = useState('');
  const previousPhase = useRef(game.phase);
  const active = [...game.nominations]
    .reverse()
    .find(({ status }) => status === 'open');
  const resolved = [...game.nominations]
    .reverse()
    .find(({ status }) => status === 'resolved');
  const dailyCandidates = game.nominations.filter(
    ({ dayNumber, status, reachedExecutionThreshold }) =>
      dayNumber === game.dayNumber &&
      status === 'resolved' &&
      reachedExecutionThreshold,
  );
  const highestVotes = Math.max(
    0,
    ...dailyCandidates.map(({ voteCount }) => voteCount),
  );
  const highestCandidates = dailyCandidates.filter(
    ({ voteCount }) => voteCount === highestVotes,
  );
  const executionCandidate =
    highestCandidates.length === 1 ? highestCandidates[0] : undefined;
  const resolvedNominee = executionCandidate
    ? game.assignments.find(
        ({ playerId }) => playerId === executionCandidate.nomineeId,
      )
    : undefined;
  const next = NEXT_PHASE[game.phase];
  const playerLink = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(game.id)}&player=1`;
  const send = (command: StorytellerCommand) => room.send(command);
  const aliveCount =
    game.assignments.filter(({ status }) => status.alive).length ||
    game.players.length;
  const playerOptions = game.players.map((player) => (
    <option key={player.id} value={player.id}>
      {player.seatIndex + 1} · {player.name}
    </option>
  ));
  const canAdvance = useMemo(() => {
    if (game.phase === 'lobby') return game.players.length >= 5;
    if (game.phase === 'assign_characters') return game.assignments.length > 0;
    if (game.phase === 'nomination') return Boolean(active);
    if (game.phase === 'voting') return Boolean(resolved);
    if (game.phase === 'execution_resolution' && executionCandidate) {
      return resolvedNominee?.status.alive === false;
    }
    if (game.phase === 'first_night' || game.phase === 'night') {
      return (
        game.nightQueue.length > 0 &&
        game.nightQueue.every(
          ({ status }) => status === 'completed' || status === 'skipped',
        )
      );
    }
    return true;
  }, [active, executionCandidate, game, resolved, resolvedNominee]);
  const pendingSuggestionCount = room.suggestions.filter(
    ({ confirmed }) => !confirmed,
  ).length;
  const currentSuggestion =
    room.suggestions[
      Math.min(suggestionPage, Math.max(room.suggestions.length - 1, 0))
    ];
  const selectedPlayer = game.players.find(({ id }) => id === selectedPlayerId);
  const selectedAssignment = game.assignments.find(
    ({ playerId }) => playerId === selectedPlayerId,
  );
  const timerRemaining = game.timer.running
    ? Math.max(
        0,
        game.timer.remainingSeconds -
          Math.floor(
            (now - new Date(game.timer.startedAt ?? now).getTime()) / 1000,
          ),
      )
    : game.timer.remainingSeconds;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (previousPhase.current === game.phase) return;
    previousPhase.current = game.phase;
    if (game.phase === 'first_night' || game.phase === 'night') {
      setActiveTool('night');
    } else if (game.phase === 'game_over' || game.phase === 'review') {
      setActiveTool('review');
    }
    if (
      !animationsEnabled ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const source =
      game.phase === 'night' || game.phase === 'first_night'
        ? USER_ASSETS.nightfallAnimation.path
        : game.phase === 'day_discussion'
          ? USER_ASSETS.dawnAnimation.path
          : game.phase === 'nomination'
            ? USER_ASSETS.nominationAnimation.path
            : game.phase === 'execution_resolution'
              ? USER_ASSETS.executionAnimation.path
              : game.phase === 'game_over'
                ? game.result?.winningAlignment === 'evil'
                  ? USER_ASSETS.evilWinAnimation.path
                  : USER_ASSETS.goodWinAnimation.path
                : '';
    if (source) {
      void fetch(source, { method: 'HEAD' })
        .then((response) => {
          if (response.ok) setTransitionSource(source);
        })
        .catch(() => undefined);
    }
  }, [animationsEnabled, game.phase, game.result?.winningAlignment]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'r') setActiveTool('roles');
      if (event.key.toLowerCase() === 'n') setActiveTool('night');
      if (event.key.toLowerCase() === 'h')
        setHideIdentities((hidden) => !hidden);
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        send({ type: event.shiftKey ? 'REDO' : 'UNDO' });
      }
      if (event.key.toLowerCase() === 'f') {
        void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="mp-shell" data-phase={game.phase}>
      <header className="mp-topbar">
        <div className="mp-brand">
          <span>◈</span>
          <div>
            <strong>暗流涌动</strong>
            <small>STORYTELLER CONSOLE</small>
          </div>
        </div>
        <div className="connection-pill" data-status={room.status}>
          <i />
          {room.status === 'online'
            ? '实时同步'
            : room.status === 'reconnecting'
              ? '正在重连'
              : '连接中'}
        </div>
        <div className="room-code">
          <span>房间</span>
          <strong>{game.id}</strong>
          <small>v{game.version}</small>
        </div>
        <button
          className="ghost"
          onClick={() => void navigator.clipboard.writeText(playerLink)}
        >
          复制玩家链接
        </button>
        <button
          className="confirmation-trigger"
          onClick={() => {
            setSuggestionPage(0);
            setConfirmationOpen(true);
          }}
        >
          说书人确认
          {pendingSuggestionCount > 0 && <b>{pendingSuggestionCount}</b>}
        </button>
      </header>

      <nav className="grimoire-toolbar" aria-label="魔典工具">
        {[
          ['grimoire', '魔典'],
          ['roles', '角色能力表 R'],
          ['night', '夜晚顺序 N'],
          ['review', '复盘'],
        ].map(([id, label]) => (
          <button
            className={activeTool === id ? 'active' : ''}
            key={id}
            onClick={() => setActiveTool(id as typeof activeTool)}
          >
            {label}
          </button>
        ))}
        <span className="toolbar-spacer" />
        <div className="timer-control">
          <strong>
            {String(Math.floor(timerRemaining / 60)).padStart(2, '0')}:
            {String(timerRemaining % 60).padStart(2, '0')}
          </strong>
          <button
            onClick={() =>
              send({
                type: 'SET_TIMER',
                durationSeconds: game.timer.durationSeconds,
                remainingSeconds: timerRemaining,
                running: !game.timer.running,
              })
            }
          >
            {game.timer.running ? '暂停' : '开始'}
          </button>
          <button
            onClick={() =>
              send({
                type: 'SET_TIMER',
                durationSeconds: 600,
                remainingSeconds: 600,
                running: false,
              })
            }
          >
            重置
          </button>
        </div>
        <button onClick={() => send({ type: 'UNDO' })}>撤销</button>
        <button onClick={() => send({ type: 'REDO' })}>重做</button>
        <button onClick={() => setHideIdentities((value) => !value)}>
          {hideIdentities ? '显示身份' : '隐藏身份 H'}
        </button>
        <button
          onClick={() => {
            const next = !animationsEnabled;
            setAnimationsEnabled(next);
            localStorage.setItem('clocktower:animations', next ? 'on' : 'off');
          }}
        >
          {animationsEnabled ? '关闭动画' : '开启动画'}
        </button>
        <button onClick={() => void room.exportGame()}>导出</button>
        <label className="toolbar-file">
          导入
          <input
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file
                .text()
                .then((text) => room.importGame(JSON.parse(text) as GameExport))
                .catch((error: Error) => room.setError(error.message));
              event.currentTarget.value = '';
            }}
          />
        </label>
        <button
          onClick={() => void document.documentElement.requestFullscreen?.()}
        >
          全屏 F
        </button>
      </nav>

      <section className="mp-hero">
        <div>
          <p className="eyebrow">
            DAY {game.dayNumber || '—'} · {game.players.length} PLAYERS
          </p>
          <h1>{PHASE_LABELS[game.phase]}</h1>
        </div>
        <div className="phase-dots">
          {[
            'setup_players',
            'assign_characters',
            'first_night',
            'day_discussion',
            'nomination',
            'voting',
            'night',
          ].map((phase) => (
            <span className={game.phase === phase ? 'active' : ''} key={phase}>
              {PHASE_LABELS[phase as GamePhase]}
            </span>
          ))}
        </div>
      </section>

      {activeTool === 'grimoire' && (
        <section className="mp-grid">
          <aside className="mp-panel roster-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">PLAYERS</p>
                <h2>玩家与座位</h2>
              </div>
              <b>{aliveCount} 存活</b>
            </div>
            {game.phase === 'lobby' && (
              <div className="quick-add">
                <input
                  placeholder="玩家昵称"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && name.trim()) {
                      send({ type: 'ADD_PLAYER', name });
                      setName('');
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (name.trim()) {
                      send({ type: 'ADD_PLAYER', name });
                      setName('');
                    }
                  }}
                >
                  ＋
                </button>
              </div>
            )}
            <div className="mp-roster">
              {game.players.map((player) => {
                const assignment = game.assignments.find(
                  ({ playerId }) => playerId === player.id,
                );
                return (
                  <article
                    className={selectedPlayerId === player.id ? 'selected' : ''}
                    key={player.id}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <span className="seat">{player.seatIndex + 1}</span>
                    <span className={`avatar ${assignment?.alignment ?? ''}`}>
                      {player.name.slice(0, 1)}
                    </span>
                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {assignment
                          ? hideIdentities
                            ? '身份已隐藏'
                            : ROLE_NAMES[assignment.characterId]
                          : '等待身份'}
                      </small>
                    </div>
                    <i
                      className={
                        assignment?.status.alive === false
                          ? 'dead'
                          : room.onlinePlayerIds.includes(player.id)
                            ? ''
                            : 'offline'
                      }
                    >
                      {assignment?.status.alive === false
                        ? '死亡'
                        : room.onlinePlayerIds.includes(player.id)
                          ? '在线'
                          : '未连接'}
                    </i>
                    {(game.phase === 'lobby' ||
                      game.phase === 'setup_players') && (
                      <span className="seat-actions">
                        <button
                          title="前移座位"
                          disabled={player.seatIndex === 0}
                          onClick={(event) => {
                            event.stopPropagation();
                            const order = game.players.map(({ id }) => id);
                            [
                              order[player.seatIndex - 1],
                              order[player.seatIndex],
                            ] = [
                              order[player.seatIndex]!,
                              order[player.seatIndex - 1]!,
                            ];
                            send({ type: 'SET_SEATS', playerIds: order });
                          }}
                        >
                          ↑
                        </button>
                        <button
                          title="后移座位"
                          disabled={
                            player.seatIndex === game.players.length - 1
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            const order = game.players.map(({ id }) => id);
                            [
                              order[player.seatIndex],
                              order[player.seatIndex + 1],
                            ] = [
                              order[player.seatIndex + 1]!,
                              order[player.seatIndex]!,
                            ];
                            send({ type: 'SET_SEATS', playerIds: order });
                          }}
                        >
                          ↓
                        </button>
                      </span>
                    )}
                  </article>
                );
              })}
              {!game.players.length && (
                <div className="empty-state">等待玩家通过手机加入</div>
              )}
            </div>
            {game.phase === 'lobby' && !game.players.length && (
              <button
                className="secondary full"
                onClick={() => send({ type: 'ADD_DEMO_PLAYERS' })}
              >
                载入 7 人演示阵容
              </button>
            )}
            <div className="share-card">
              <small>玩家加入地址</small>
              <code>{playerLink}</code>
              <ShareQr value={playerLink} />
              <p>玩家会获得独立会话，只能看见自己的安全视图。</p>
            </div>
          </aside>

          <section className="mp-panel stage-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">AUTHORITATIVE STATE</p>
                <h2>房间现场</h2>
              </div>
              <span className="server-badge">服务端权威</span>
            </div>
            <div className="seat-circle">
              <div className="circle-core">
                <span>{game.phase.includes('night') ? '☾' : '☼'}</span>
                <strong>{PHASE_LABELS[game.phase]}</strong>
                <small>{game.players.length} 名玩家</small>
              </div>
              {game.players.map((player, index) => {
                const angle =
                  (index / Math.max(game.players.length, 1)) * Math.PI * 2 -
                  Math.PI / 2;
                const assignment = game.assignments.find(
                  ({ playerId }) => playerId === player.id,
                );
                return (
                  <button
                    type="button"
                    className={`circle-player ${
                      assignment?.status.alive === false ? 'dead' : ''
                    } ${selectedPlayerId === player.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPlayerId(player.id)}
                    key={player.id}
                    style={{
                      left: `${50 + Math.cos(angle) * 41}%`,
                      top: `${50 + Math.sin(angle) * 41}%`,
                    }}
                  >
                    <span
                      className={
                        hideIdentities ? undefined : assignment?.alignment
                      }
                    >
                      {hideIdentities ? '？' : player.name.slice(0, 1)}
                    </span>
                    <strong>{player.name}</strong>
                    {assignment?.status.alive === false && <small>死亡</small>}
                  </button>
                );
              })}
            </div>
            <div className="stage-actions">
              {game.phase === 'assign_characters' && (
                <div className="assignment-workbench">
                  <div className="manual-assignment-grid">
                    {game.players.map((player) => (
                      <label key={player.id}>
                        <span>
                          {player.seatIndex + 1} · {player.name}
                        </span>
                        <select
                          value={manualAssignments[player.id] ?? ''}
                          onChange={(event) =>
                            setManualAssignments((current) => ({
                              ...current,
                              [player.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">选择角色</option>
                          {TROUBLE_BREWING_ROLE_DEFINITIONS.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name} · {role.type}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div>
                    <button
                      className="primary"
                      onClick={() => send({ type: 'AUTO_ASSIGN' })}
                    >
                      自动分配身份
                    </button>
                    <button
                      className="secondary"
                      disabled={game.players.some(
                        ({ id }) => !manualAssignments[id],
                      )}
                      onClick={() =>
                        send({
                          type: 'MANUAL_ASSIGN',
                          assignments: game.players.map(({ id }) => ({
                            playerId: id,
                            characterId: manualAssignments[id]!,
                          })),
                        })
                      }
                    >
                      提交手动分配
                    </button>
                  </div>
                </div>
              )}
              {game.phase === 'private_reveal' && (
                <button
                  className="primary"
                  onClick={() => send({ type: 'CONFIRM_ALL_IDENTITIES' })}
                >
                  确认全员已查看身份
                </button>
              )}
              {game.phase === 'nomination' && (
                <div className="nomination-form">
                  <select
                    value={nominatorId}
                    onChange={(event) => setNominatorId(event.target.value)}
                  >
                    <option value="">提名人</option>
                    {playerOptions}
                  </select>
                  <select
                    value={nomineeId}
                    onChange={(event) => setNomineeId(event.target.value)}
                  >
                    <option value="">被提名人</option>
                    {playerOptions}
                  </select>
                  <button
                    className="primary"
                    disabled={
                      !nominatorId || !nomineeId || nominatorId === nomineeId
                    }
                    onClick={() =>
                      send({
                        type: 'CREATE_NOMINATION',
                        nominatorId,
                        nomineeId,
                      })
                    }
                  >
                    发起提名
                  </button>
                </div>
              )}
              {game.phase === 'voting' && active && (
                <div className="vote-board">
                  <strong>
                    {active.voteCount}
                    <small> / {active.executionThreshold} 票</small>
                  </strong>
                  <div>
                    {game.players.map((player) => {
                      const vote = active.votes.find(
                        ({ voterId }) => voterId === player.id,
                      );
                      return (
                        <button
                          key={player.id}
                          disabled={Boolean(vote)}
                          onClick={() =>
                            send({
                              type: 'CAST_VOTE',
                              nominationId: active.id,
                              voterId: player.id,
                              value: true,
                            })
                          }
                        >
                          {player.name}{' '}
                          {vote ? (vote.value ? '✓' : '—') : '举手'}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      send({
                        type: 'RESOLVE_NOMINATION',
                        nominationId: active.id,
                      })
                    }
                  >
                    结算投票（未选择视为未举手）
                  </button>
                </div>
              )}
              {game.phase === 'voting' && resolved && !active && (
                <button
                  className="secondary"
                  onClick={() =>
                    send({ type: 'ADVANCE_PHASE', to: 'nomination' })
                  }
                >
                  继续本日提名
                </button>
              )}
              {game.phase === 'execution_resolution' &&
                executionCandidate &&
                resolvedNominee?.status.alive !== false && (
                  <button
                    className="danger-button"
                    onClick={() =>
                      window.confirm('确认执行处决？规则引擎将再次校验。') &&
                      send({
                        type: 'EXECUTE_NOMINATION',
                        nominationId: executionCandidate.id,
                      })
                    }
                  >
                    确认处决
                  </button>
                )}
              {next && (
                <button
                  className="advance-button"
                  disabled={!canAdvance}
                  onClick={() => send({ type: 'ADVANCE_PHASE', to: next })}
                >
                  推进至 {PHASE_LABELS[next]} <span>→</span>
                </button>
              )}
            </div>
            {selectedPlayer && (
              <section className="player-inspector">
                <header>
                  <div>
                    <small>座位 {selectedPlayer.seatIndex + 1}</small>
                    <h3>{selectedPlayer.name}</h3>
                  </div>
                  <button onClick={() => setSelectedPlayerId('')}>×</button>
                </header>
                <div className="inspector-actions">
                  {(game.phase === 'lobby' ||
                    game.phase === 'setup_players') && (
                    <>
                      <button
                        onClick={() => {
                          const nextName = window.prompt(
                            '新的玩家昵称',
                            selectedPlayer.name,
                          );
                          if (nextName?.trim()) {
                            send({
                              type: 'RENAME_PLAYER',
                              playerId: selectedPlayer.id,
                              name: nextName,
                            });
                          }
                        }}
                      >
                        改名
                      </button>
                      <button
                        onClick={() =>
                          window.confirm('解除该座位的设备绑定？') &&
                          send({
                            type: 'RELEASE_PLAYER_SESSION',
                            playerId: selectedPlayer.id,
                          })
                        }
                      >
                        解除设备绑定
                      </button>
                      <button
                        className="danger-button"
                        onClick={() =>
                          window.confirm(`移除 ${selectedPlayer.name}？`) &&
                          send({
                            type: 'REMOVE_PLAYER',
                            playerId: selectedPlayer.id,
                          })
                        }
                      >
                        移除
                      </button>
                    </>
                  )}
                  {selectedAssignment && (
                    <>
                      <button
                        onClick={() =>
                          send({
                            type: 'SET_STATUS',
                            playerId: selectedPlayer.id,
                            key: 'alive',
                            value: !selectedAssignment.status.alive,
                          })
                        }
                      >
                        {selectedAssignment.status.alive
                          ? '标记死亡'
                          : '恢复存活'}
                      </button>
                      {[
                        ['drunk', '醉酒', 'dusk'],
                        ['poisoned', '中毒', 'dusk'],
                        ['protected', '保护', 'dawn'],
                      ].map(([kind, label, expiresAt]) => (
                        <button
                          key={kind}
                          onClick={() =>
                            send({
                              type: 'ADD_EFFECT',
                              playerId: selectedPlayer.id,
                              kind: kind as 'drunk' | 'poisoned' | 'protected',
                              label,
                              expiresAt: expiresAt as 'dawn' | 'dusk',
                            })
                          }
                        >
                          ＋{label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
                {selectedAssignment && (
                  <>
                    <label className="inspector-role-select">
                      当前身份
                      <select
                        value={selectedAssignment.characterId}
                        onChange={(event) =>
                          send({
                            type: 'CHANGE_CHARACTER',
                            playerId: selectedPlayer.id,
                            characterId: event.target.value,
                          })
                        }
                      >
                        {TROUBLE_BREWING_ROLE_DEFINITIONS.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name} · {role.type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="token-list">
                      {game.effects
                        .filter(
                          ({ playerId }) => playerId === selectedPlayer.id,
                        )
                        .map((effect) => (
                          <button
                            key={effect.id}
                            onClick={() =>
                              send({
                                type: 'REMOVE_EFFECT',
                                playerId: selectedPlayer.id,
                                effectId: effect.id,
                              })
                            }
                          >
                            {effect.label} ×
                          </button>
                        ))}
                      {game.reminderTokens
                        .filter(
                          ({ playerId }) => playerId === selectedPlayer.id,
                        )
                        .map((reminder) => (
                          <button
                            key={reminder.id}
                            onClick={() =>
                              send({
                                type: 'REMOVE_REMINDER',
                                playerId: selectedPlayer.id,
                                reminderId: reminder.id,
                              })
                            }
                          >
                            {reminder.label} ×
                          </button>
                        ))}
                    </div>
                    <div className="inspector-input">
                      <input
                        value={reminderLabel}
                        placeholder="自定义提醒"
                        onChange={(event) =>
                          setReminderLabel(event.target.value)
                        }
                      />
                      <button
                        disabled={!reminderLabel.trim()}
                        onClick={() => {
                          send({
                            type: 'ADD_REMINDER',
                            playerId: selectedPlayer.id,
                            label: reminderLabel,
                          });
                          setReminderLabel('');
                        }}
                      >
                        添加
                      </button>
                    </div>
                    <div className="inspector-input">
                      <input
                        value={privateInfo}
                        placeholder="发送给该玩家的私密信息"
                        onChange={(event) => setPrivateInfo(event.target.value)}
                      />
                      <button
                        disabled={!privateInfo.trim()}
                        onClick={() => {
                          send({
                            type: 'SEND_PRIVATE_INFO',
                            playerId: selectedPlayer.id,
                            infoKind: 'storyteller-message',
                            summary: privateInfo,
                          });
                          setPrivateInfo('');
                        }}
                      >
                        私密发送
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}
            {room.error && <div className="error">{room.error}</div>}
          </section>

          <aside className="mp-panel intelligence-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">GAME HISTORY</p>
                <h2>游戏日志</h2>
              </div>
              <b>{game.events.length} 条</b>
            </div>
            <div className="game-log">
              {[...game.events].reverse().map((event) => (
                <div key={event.id}>
                  <i />
                  <span>
                    {eventText(event, game)}
                    <small>
                      {new Date(event.occurredAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </small>
                  </span>
                  <b>#{event.sequence}</b>
                </div>
              ))}
            </div>
          </aside>
        </section>
      )}

      {activeTool === 'roles' && <RoleLibrary />}
      {activeTool === 'night' && <NightWorkbench game={game} send={send} />}
      {activeTool === 'review' && <ReviewWorkspace game={game} send={send} />}
      {transitionSource && (
        <TransitionOverlay
          source={transitionSource}
          onClose={() => setTransitionSource('')}
        />
      )}
      {confirmationOpen && (
        <div
          className="confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmationOpen(false);
            }
          }}
        >
          <section
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmation-title"
          >
            <header>
              <div>
                <p className="eyebrow">STORYTELLER CONFIRMATION</p>
                <h2 id="confirmation-title">说书人确认</h2>
              </div>
              <button
                aria-label="关闭说书人确认"
                onClick={() => setConfirmationOpen(false)}
              >
                ×
              </button>
            </header>
            <p className="ai-policy">
              建议不会自动修改游戏，也不会直接发送给玩家；只有说书人确认后才可执行。
            </p>
            {!currentSuggestion ? (
              <div className="confirmation-empty">
                <span>◈</span>
                <h3>暂无待确认内容</h3>
                <p>生成建议后，会在这里逐页显示。</p>
                <button
                  className="primary"
                  onClick={() => send({ type: 'REQUEST_AI_SUGGESTIONS' })}
                >
                  生成当前建议
                </button>
              </div>
            ) : (
              <>
                <article
                  className={`confirmation-page ${
                    currentSuggestion.confirmed ? 'confirmed' : ''
                  }`}
                >
                  <small>{currentSuggestion.type}</small>
                  <h3>{currentSuggestion.title}</h3>
                  <p>{currentSuggestion.body}</p>
                  <div>
                    <button
                      className="primary"
                      disabled={currentSuggestion.confirmed}
                      onClick={() =>
                        send({
                          type: 'CONFIRM_AI_SUGGESTION',
                          suggestionId: currentSuggestion.id,
                        })
                      }
                    >
                      {currentSuggestion.confirmed
                        ? '已由说书人确认'
                        : '确认本页建议'}
                    </button>
                    {currentSuggestion.confirmed &&
                      currentSuggestion.proposedAction && (
                        <button
                          className="execute-suggestion"
                          onClick={() =>
                            send({
                              type: 'EXECUTE_CONFIRMED_AI_ACTION',
                              suggestionId: currentSuggestion.id,
                            })
                          }
                        >
                          通过规则引擎执行
                        </button>
                      )}
                  </div>
                </article>
                <footer>
                  <button
                    disabled={suggestionPage === 0}
                    onClick={() =>
                      setSuggestionPage((page) => Math.max(0, page - 1))
                    }
                  >
                    ← 上一页
                  </button>
                  <span>
                    {suggestionPage + 1} / {room.suggestions.length}
                  </span>
                  <button
                    disabled={suggestionPage >= room.suggestions.length - 1}
                    onClick={() =>
                      setSuggestionPage((page) =>
                        Math.min(room.suggestions.length - 1, page + 1),
                      )
                    }
                  >
                    下一页 →
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function ShareQr({ value }: { value: string }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    void QRCode.toDataURL(value, {
      width: 320,
      margin: 2,
      color: { dark: '#101722', light: '#f5eedc' },
      errorCorrectionLevel: 'M',
    }).then(setSource);
  }, [value]);
  return source ? (
    <img className="room-qr" src={source} alt="玩家加入房间二维码" />
  ) : null;
}

function TransitionOverlay({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) {
  return (
    <div className="transition-overlay" role="dialog" aria-label="场景转场动画">
      <video
        autoPlay
        muted
        playsInline
        poster={source.replace(/\.webm$/, '.webp')}
        src={source}
        onEnded={onClose}
        onError={onClose}
      />
      <button onClick={onClose}>跳过动画</button>
    </div>
  );
}

function RoleLibrary() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [licensedCopy, setLicensedCopy] = useState<
    Record<string, { summary?: string; storytellerSteps?: string[] }>
  >({});
  useEffect(() => {
    void fetch('/assets/user/licensed-copy.zh-CN.json')
      .then((response) => {
        if (!response.ok) throw new Error('optional copy unavailable');
        return response.json() as Promise<{
          schemaVersion: 1;
          roles: Record<
            string,
            { summary?: string; storytellerSteps?: string[] }
          >;
        }>;
      })
      .then((payload) => setLicensedCopy(payload.roles ?? {}))
      .catch(() => undefined);
  }, []);
  const roles = TROUBLE_BREWING_ROLE_DEFINITIONS.filter(
    (role) =>
      (type === 'all' || role.type === type) &&
      `${role.name}${role.summary}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="tool-workspace role-library">
      <header>
        <div>
          <p className="eyebrow">TROUBLE BREWING</p>
          <h2>角色能力表</h2>
        </div>
        <input
          placeholder="搜索角色或能力"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">全部类型</option>
          <option value="townsfolk">镇民</option>
          <option value="outsider">外来者</option>
          <option value="minion">爪牙</option>
          <option value="demon">恶魔</option>
        </select>
      </header>
      <div className="role-cards">
        {roles.map((role) => (
          <article className={`role-card ${role.alignment}`} key={role.id}>
            <div className="role-token-placeholder" data-role={role.id}>
              {role.name.slice(0, 1)}
            </div>
            <div>
              <small>
                {role.type} · {role.alignment === 'good' ? '善良' : '邪恶'}
              </small>
              <h3>{role.name}</h3>
              <p>{licensedCopy[role.id]?.summary ?? role.summary}</p>
              <ol>
                {(
                  licensedCopy[role.id]?.storytellerSteps ??
                  role.storytellerSteps
                ).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <footer>
                <span>首夜：{role.firstNightOrder ?? '—'}</span>
                <span>其他夜：{role.otherNightOrder ?? '—'}</span>
                {role.reminderLabels.map((label) => (
                  <b key={label}>{label}</b>
                ))}
              </footer>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NightWorkbench({
  game,
  send,
}: {
  game: GameState;
  send: (command: StorytellerCommand) => void;
}) {
  const active = game.nightQueue.find(({ status }) => status === 'active');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [resultSummary, setResultSummary] = useState('');
  const [deathResolution, setDeathResolution] = useState('');
  const [newDemonPlayerId, setNewDemonPlayerId] = useState('');
  useEffect(() => {
    setTargetIds(active?.targetIds ?? []);
    setResultSummary(active?.resultSummary ?? '');
    setDeathResolution('');
    setNewDemonPlayerId('');
  }, [active?.id]);
  const legalTargets = active
    ? new Set(getLegalNightTargets(game, active.playerId))
    : new Set<string>();
  const role = active
    ? TROUBLE_BREWING_ROLE_DEFINITIONS.find(
        ({ id }) => id === active.characterId,
      )
    : undefined;
  const actor = active
    ? game.players.find(({ id }) => id === active.playerId)
    : undefined;
  const actorAssignment = active
    ? game.assignments.find(({ playerId }) => playerId === active.playerId)
    : undefined;
  const attackedAssignment = targetIds[0]
    ? game.assignments.find(({ playerId }) => playerId === targetIds[0])
    : undefined;
  const attackedPlayer = targetIds[0]
    ? game.players.find(({ id }) => id === targetIds[0])
    : undefined;
  const isImpAttack = active?.characterId === 'imp';
  const attackedHealthyMayor =
    attackedAssignment?.characterId === 'mayor' &&
    !attackedAssignment.status.drunk &&
    !attackedAssignment.status.poisoned;
  const attackAutomaticallyFails =
    Boolean(actorAssignment?.status.drunk) ||
    Boolean(actorAssignment?.status.poisoned) ||
    Boolean(attackedAssignment?.status.protected) ||
    (attackedAssignment?.characterId === 'soldier' &&
      !attackedAssignment.status.drunk &&
      !attackedAssignment.status.poisoned);
  const redirectCandidates = attackedHealthyMayor
    ? game.players.filter(
        ({ id }) =>
          id !== attackedPlayer?.id &&
          game.assignments.find(({ playerId }) => playerId === id)?.status
            .alive,
      )
    : [];
  const successorCandidates = game.assignments
    .filter((assignment) => {
      const definition = TROUBLE_BREWING_ROLE_DEFINITIONS.find(
        ({ id }) => id === assignment.characterId,
      );
      return (
        definition?.type === 'minion' &&
        assignment.status.alive &&
        !assignment.status.drunk &&
        !assignment.status.poisoned
      );
    })
    .map(({ playerId }) => game.players.find(({ id }) => id === playerId)!)
    .filter(Boolean);
  useEffect(() => {
    if (!isImpAttack || !attackedPlayer) {
      setDeathResolution('');
      return;
    }
    if (attackAutomaticallyFails) {
      setDeathResolution('no_death');
    } else if (attackedHealthyMayor) {
      setDeathResolution('');
    } else {
      setDeathResolution(attackedPlayer.id);
    }
    setNewDemonPlayerId('');
  }, [
    active?.id,
    attackAutomaticallyFails,
    attackedHealthyMayor,
    attackedPlayer?.id,
    isImpAttack,
  ]);
  const requiresSuccessor =
    isImpAttack &&
    deathResolution === active?.playerId &&
    successorCandidates.length > 0;
  const canComplete =
    !isImpAttack ||
    (targetIds.length === 1 &&
      Boolean(deathResolution) &&
      (!requiresSuccessor || Boolean(newDemonPlayerId)));
  return (
    <section className="tool-workspace night-workspace">
      <header>
        <div>
          <p className="eyebrow">NIGHT ORDER</p>
          <h2>{game.phase === 'first_night' ? '首夜顺序' : '夜晚工作台'}</h2>
        </div>
        {(game.phase === 'first_night' || game.phase === 'night') &&
          !game.nightQueue.length && (
            <button
              className="primary"
              onClick={() => send({ type: 'PREPARE_NIGHT' })}
            >
              生成本夜队列
            </button>
          )}
      </header>
      {game.phase !== 'first_night' && game.phase !== 'night' ? (
        <div className="night-preview">
          <p>进入首夜或夜晚后可执行队列。当前显示完整参考顺序。</p>
          {TROUBLE_BREWING_ROLE_DEFINITIONS.filter(
            ({ firstNightOrder, otherNightOrder }) =>
              firstNightOrder !== null || otherNightOrder !== null,
          )
            .sort(
              (left, right) =>
                (left.otherNightOrder ?? left.firstNightOrder ?? 999) -
                (right.otherNightOrder ?? right.firstNightOrder ?? 999),
            )
            .map((definition) => (
              <span key={definition.id}>
                {definition.name}
                <small>
                  {definition.firstNightOrder ?? '—'} /{' '}
                  {definition.otherNightOrder ?? '—'}
                </small>
              </span>
            ))}
        </div>
      ) : (
        <div className="night-layout">
          <aside className="night-queue">
            {game.nightQueue.map((step) => {
              const definition = TROUBLE_BREWING_ROLE_DEFINITIONS.find(
                ({ id }) => id === step.characterId,
              );
              const player = game.players.find(
                ({ id }) => id === step.playerId,
              );
              return (
                <article className={step.status} key={step.id}>
                  <b>{step.order}</b>
                  <span>
                    <strong>{definition?.name ?? step.characterId}</strong>
                    <small>{player?.name ?? step.playerId}</small>
                  </span>
                  <i>{step.status}</i>
                </article>
              );
            })}
          </aside>
          <section className="night-action-card">
            {!active ? (
              <div className="confirmation-empty">
                <span>☾</span>
                <h3>本夜流程已完成</h3>
                {game.nightQueue.length > 0 && (
                  <button
                    className="advance-button"
                    onClick={() =>
                      send({ type: 'ADVANCE_PHASE', to: 'day_discussion' })
                    }
                  >
                    宣布黎明，进入白天 <span>→</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                <small>当前唤醒 · {actor?.name}</small>
                <h3>{role?.name}</h3>
                <p>{role?.summary}</p>
                <ol>
                  {role?.storytellerSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {legalTargets.size > 0 && (
                  <div className="night-targets">
                    {game.players
                      .filter(({ id }) => legalTargets.has(id))
                      .map((player) => (
                        <button
                          className={
                            targetIds.includes(player.id) ? 'selected' : ''
                          }
                          key={player.id}
                          onClick={() =>
                            setTargetIds((current) => {
                              if (isImpAttack) {
                                return current.includes(player.id)
                                  ? []
                                  : [player.id];
                              }
                              return current.includes(player.id)
                                ? current.filter((id) => id !== player.id)
                                : [...current, player.id];
                            })
                          }
                        >
                          {player.seatIndex + 1} · {player.name}
                        </button>
                      ))}
                  </div>
                )}
                {isImpAttack && attackedPlayer && (
                  <section className="night-resolution">
                    <label>
                      黎明死亡结果
                      <select
                        value={deathResolution}
                        onChange={(event) =>
                          setDeathResolution(event.target.value)
                        }
                      >
                        <option value="">请选择说书人裁定</option>
                        <option value="no_death">无人死亡</option>
                        <option value={attackedPlayer.id}>
                          {attackedPlayer.name} 死亡
                        </option>
                        {redirectCandidates.map((player) => (
                          <option key={player.id} value={player.id}>
                            转移给 {player.name} 死亡
                          </option>
                        ))}
                      </select>
                    </label>
                    {attackAutomaticallyFails && (
                      <p>
                        规则建议：本次攻击应无人死亡。目标可能受到保护，或相关能力因醉酒/中毒失效。
                      </p>
                    )}
                    {attackedHealthyMayor && (
                      <p>
                        市长受到恶魔攻击：请明确选择市长死亡、转移给另一名玩家，或无人死亡。
                      </p>
                    )}
                    {requiresSuccessor && (
                      <label>
                        小恶魔自刀后的新恶魔
                        <select
                          value={newDemonPlayerId}
                          onChange={(event) =>
                            setNewDemonPlayerId(event.target.value)
                          }
                        >
                          <option value="">选择一名存活爪牙</option>
                          {successorCandidates.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </section>
                )}
                <textarea
                  placeholder="结果摘要或给出的信息"
                  value={resultSummary}
                  onChange={(event) => setResultSummary(event.target.value)}
                />
                <div>
                  <button
                    onClick={() =>
                      send({
                        type: 'UPDATE_NIGHT_STEP',
                        stepId: active.id,
                        status: 'skipped',
                        targetIds,
                        resultSummary,
                      })
                    }
                  >
                    跳过
                  </button>
                  <button
                    className="primary"
                    disabled={!canComplete}
                    onClick={() =>
                      send({
                        type: 'UPDATE_NIGHT_STEP',
                        stepId: active.id,
                        status: 'completed',
                        targetIds,
                        ...(isImpAttack
                          ? {
                              deathOutcome:
                                deathResolution === 'no_death'
                                  ? {
                                      type: 'no_death' as const,
                                      reason:
                                        resultSummary.trim() ||
                                        '说书人确认本夜无人死亡',
                                    }
                                  : {
                                      type: 'death' as const,
                                      playerId: deathResolution,
                                      reason:
                                        resultSummary.trim() ||
                                        '夜间遭到恶魔攻击',
                                      ...(newDemonPlayerId
                                        ? { newDemonPlayerId }
                                        : {}),
                                    },
                            }
                          : {}),
                        resultSummary,
                      })
                    }
                  >
                    完成并唤醒下一位
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function ReviewWorkspace({
  game,
  send,
}: {
  game: GameState;
  send: (command: StorytellerCommand) => void;
}) {
  return (
    <section className="tool-workspace review-workspace">
      <header>
        <div>
          <p className="eyebrow">REVIEW & EXPORT</p>
          <h2>游戏复盘</h2>
        </div>
        {game.phase !== 'game_over' && game.phase !== 'review' && (
          <div className="end-game-actions">
            <button
              onClick={() =>
                window.confirm('确认善良阵营获胜并结束游戏？') &&
                send({
                  type: 'END_GAME',
                  winningAlignment: 'good',
                  reason: '由说书人确认善良阵营获胜',
                })
              }
            >
              善良获胜
            </button>
            <button
              className="danger-button"
              onClick={() =>
                window.confirm('确认邪恶阵营获胜并结束游戏？') &&
                send({
                  type: 'END_GAME',
                  winningAlignment: 'evil',
                  reason: '由说书人确认邪恶阵营获胜',
                })
              }
            >
              邪恶获胜
            </button>
          </div>
        )}
      </header>
      {game.result && (
        <div className={`result-banner ${game.result.winningAlignment}`}>
          <strong>
            {game.result.winningAlignment === 'good' ? '善良' : '邪恶'}阵营获胜
          </strong>
          <span>{game.result.reason}</span>
        </div>
      )}
      <div className="review-grid">
        <section>
          <h3>最终身份</h3>
          {game.players.map((player) => {
            const assignment = game.assignments.find(
              ({ playerId }) => playerId === player.id,
            );
            return (
              <article key={player.id}>
                <span>
                  {player.seatIndex + 1} · {player.name}
                </span>
                <strong>
                  {ROLE_NAMES[assignment?.characterId ?? ''] ?? '未分配'}
                </strong>
                <small>
                  {assignment?.status.alive === false ? '死亡' : '存活'}
                </small>
              </article>
            );
          })}
        </section>
        <section>
          <h3>公开时间线</h3>
          {[...game.events]
            .filter(({ visibility }) => visibility.scope === 'public')
            .reverse()
            .map((event) => (
              <article key={event.id}>
                <span>{eventText(event, game)}</span>
                <small>
                  {new Date(event.occurredAt).toLocaleString('zh-CN')}
                </small>
              </article>
            ))}
        </section>
      </div>
    </section>
  );
}
