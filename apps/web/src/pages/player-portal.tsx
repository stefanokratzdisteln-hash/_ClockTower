import { useState } from 'react';

import {
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  type PlayerView,
} from '@clocktower/rules-engine';

const PHASE_LABELS: Record<PlayerView['phase'], string> = {
  lobby: '等待入座',
  setup_players: '确认座位',
  assign_characters: '身份准备中',
  private_reveal: '查看身份',
  first_night: '首夜',
  day_discussion: '白天讨论',
  nomination: '提名阶段',
  voting: '投票阶段',
  execution_resolution: '处决结算',
  night: '夜晚',
  game_over: '游戏结束',
  review: '公开复盘',
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

type PlayerPortalProps = {
  roomId: string;
  view?: PlayerView;
  error: string;
  onJoin: (roomCode: string, name: string) => void;
  onNominate: (nomineeId: string) => void;
  onVote: (value: boolean) => void;
  onNightAction: (stepId: string, targetIds: string[]) => void;
  onLeave: () => void;
  onBackToStoryteller: () => void;
};

export function PlayerPortal(props: PlayerPortalProps) {
  const [roomCode, setRoomCode] = useState(props.roomId);
  const [name, setName] = useState('');
  const [nomineeId, setNomineeId] = useState('');
  const [nightTargets, setNightTargets] = useState<string[]>([]);

  if (!props.view) {
    return (
      <main className="player-shell join-shell">
        <section className="join-card">
          <div className="player-sigil">◎</div>
          <p className="player-kicker">PLAYER ACCESS</p>
          <h1>加入钟楼</h1>
          <p>输入说书人提供的房间码与昵称。身份信息只会发送给你。</p>
          <label>
            房间码
            <input
              value={roomCode}
              onChange={(event) => setRoomCode(event.target.value)}
              autoCapitalize="characters"
            />
          </label>
          <label>
            昵称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="与座位上的昵称一致"
              onKeyDown={(event) =>
                event.key === 'Enter' && props.onJoin(roomCode, name)
              }
            />
          </label>
          {props.error && <div className="player-error">{props.error}</div>}
          <button
            className="player-primary"
            disabled={!roomCode.trim() || !name.trim()}
            onClick={() => props.onJoin(roomCode, name)}
          >
            安全加入房间 <span>→</span>
          </button>
          <button
            className="player-text-button"
            onClick={props.onBackToStoryteller}
          >
            返回说书人端
          </button>
        </section>
      </main>
    );
  }

  const { view } = props;
  const roleName = view.self.characterId
    ? (ROLE_NAMES[view.self.characterId] ?? view.self.characterId)
    : '等待说书人分配';
  const roleDefinition = TROUBLE_BREWING_ROLE_DEFINITIONS.find(
    ({ id }) => id === view.self.characterId,
  );
  const nominee = view.players.find(
    (player) => player.id === view.activeNomination?.nomineeId,
  );

  return (
    <main className="player-shell">
      <header className="player-topbar">
        <div>
          <span className="player-sigil small">◎</span>
          <span>
            <strong>钟楼 · 玩家端</strong>
            <small>房间 {view.roomId}</small>
          </span>
        </div>
        <button onClick={props.onLeave}>退出房间</button>
      </header>

      <section className="player-content">
        <div className="phase-ribbon">
          <span className={view.phase.includes('night') ? 'moon' : 'sun'}>
            {view.phase.includes('night') ? '☾' : '☼'}
          </span>
          <div>
            <p>DAY {view.dayNumber || '—'} · 当前阶段</p>
            <h1>{PHASE_LABELS[view.phase]}</h1>
          </div>
          <b
            className={
              view.permissions.nominate.allowed || view.permissions.vote.allowed
                ? 'ready'
                : ''
            }
          >
            {view.permissions.nominate.allowed || view.permissions.vote.allowed
              ? '现在可以操作'
              : '等待说书人'}
          </b>
        </div>

        <div className="player-grid">
          <section
            className={`identity-panel ${view.self.alignment ?? 'unknown'}`}
          >
            <p className="player-kicker">YOUR CHARACTER</p>
            <div className="role-emblem">
              {view.self.alignment === 'evil' ? '◆' : '✦'}
            </div>
            <h2>{roleName}</h2>
            <p className="alignment">
              {view.self.alignment
                ? `${view.self.alignment === 'good' ? '善良' : '邪恶'}阵营`
                : '身份尚未揭示'}
            </p>
            {roleDefinition && (
              <p className="player-role-summary">{roleDefinition.summary}</p>
            )}
            <div className="identity-meta">
              <span>
                座位 <strong>{view.self.seatIndex + 1}</strong>
              </span>
              <span className={view.self.alive ? 'alive' : 'dead'}>
                {view.self.alive ? '● 存活' : '† 死亡'}
              </span>
            </div>
            {!view.self.alive && (
              <small>
                {view.self.deadVoteAvailable
                  ? '你仍保留一次死亡投票权'
                  : '你的死亡投票权已使用'}
              </small>
            )}
          </section>

          <section className="player-actions-panel">
            <p className="player-kicker">AVAILABLE ACTION</p>
            {view.nightRequest ? (
              <div className="player-action night-player-action">
                <h2>提交夜间目标</h2>
                <p>你的选择只会发送给说书人，最终结果由说书人确认。</p>
                <div className="night-player-targets">
                  {view.nightRequest.legalTargets.map((player) => (
                    <button
                      className={
                        nightTargets.includes(player.id) ? 'selected' : ''
                      }
                      key={player.id}
                      onClick={() =>
                        setNightTargets((current) =>
                          current.includes(player.id)
                            ? current.filter((id) => id !== player.id)
                            : [...current, player.id],
                        )
                      }
                    >
                      {player.seatIndex + 1} · {player.name}
                    </button>
                  ))}
                </div>
                <button
                  className="player-primary"
                  onClick={() =>
                    props.onNightAction(view.nightRequest!.stepId, nightTargets)
                  }
                >
                  私密提交给说书人
                </button>
              </div>
            ) : view.permissions.nominate.allowed ? (
              <div className="player-action">
                <h2>发起提名</h2>
                <p>选择一名仍然存活的玩家。提名提交后不可撤回。</p>
                <select
                  value={nomineeId}
                  onChange={(event) => setNomineeId(event.target.value)}
                >
                  <option value="">选择被提名人</option>
                  {view.players
                    .filter(
                      (player) => player.alive && player.id !== view.self.id,
                    )
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.seatIndex + 1} 号 · {player.name}
                      </option>
                    ))}
                </select>
                <button
                  className="player-primary"
                  disabled={!nomineeId}
                  onClick={() => props.onNominate(nomineeId)}
                >
                  确认提名
                </button>
              </div>
            ) : view.permissions.vote.allowed && view.activeNomination ? (
              <div className="player-action vote-action">
                <h2>是否投给 {nominee?.name ?? '当前候选人'}？</h2>
                <p>
                  当前 {view.activeNomination.voteCount} /{' '}
                  {view.activeNomination.executionThreshold} 票
                </p>
                <div>
                  <button
                    className="player-primary"
                    onClick={() => props.onVote(true)}
                  >
                    举手赞成
                  </button>
                  <button
                    className="player-secondary"
                    onClick={() => props.onVote(false)}
                  >
                    不举手
                  </button>
                </div>
              </div>
            ) : (
              <div className="waiting-action">
                <span>⌛</span>
                <h2>当前无需操作</h2>
                <p>
                  {view.phase === 'voting'
                    ? view.permissions.vote.reason
                    : view.permissions.nominate.reason}
                </p>
              </div>
            )}
            {props.error && <div className="player-error">{props.error}</div>}
          </section>
        </div>

        <section className="private-feed">
          <div>
            <p className="player-kicker">PRIVATE INFORMATION</p>
            <h2>只对你可见的提示</h2>
          </div>
          {view.privateHints.length ? (
            <div className="hint-list">
              {[...view.privateHints].reverse().map((hint) => (
                <article key={hint.id}>
                  <span>✦</span>
                  <div>
                    <small>{hint.kind}</small>
                    <p>{hint.text}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-hints">
              尚无私密提示。说书人发送后会显示在这里。
            </p>
          )}
        </section>

        {view.review && (
          <section className="review-panel">
            <p className="player-kicker">OPEN REVIEW</p>
            <h2>身份公开复盘</h2>
            {view.review.winner && (
              <p className="review-result">
                {view.review.winner === 'good' ? '善良' : '邪恶'}阵营获胜
                {view.review.reason ? ` · ${view.review.reason}` : ''}
              </p>
            )}
            <div className="review-roles">
              {view.review.roles.map((role) => (
                <div key={role.playerId}>
                  <span>{role.playerName}</span>
                  <strong>
                    {ROLE_NAMES[role.characterId] ?? role.characterId}
                  </strong>
                  <small>{role.alignment === 'good' ? '善良' : '邪恶'}</small>
                </div>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
