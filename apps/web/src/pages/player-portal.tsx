import { useEffect, useRef, useState } from 'react';

import {
  TROUBLE_BREWING_ROLE_DEFINITIONS,
  type PlayerView,
} from '@clocktower/rules-engine';

import { DawnCinematic } from '../components/dawn-cinematic.js';
import { EndingCinematic } from '../components/ending-cinematic.js';
import { RoomAudioToggle } from '../components/room-audio-toggle.js';
import { LanguageToggle } from '../i18n.js';

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
  const [dawnCinematicOpen, setDawnCinematicOpen] = useState(false);
  const nightStepId = props.view?.nightRequest?.stepId;
  const currentPhase = props.view?.phase;
  const previousPhase = useRef(currentPhase);

  useEffect(() => {
    setNightTargets(props.view?.nightRequest?.selectedTargetIds ?? []);
  }, [nightStepId]);

  useEffect(() => {
    const priorPhase = previousPhase.current;
    previousPhase.current = currentPhase;
    if (
      currentPhase === 'day_discussion' &&
      (priorPhase === 'first_night' || priorPhase === 'night')
    ) {
      setDawnCinematicOpen(true);
    }
  }, [currentPhase]);

  if (!props.view) {
    return (
      <main className="player-shell join-shell">
        <section className="join-card">
          <LanguageToggle />
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
        <div className="player-topbar-actions">
          <RoomAudioToggle />
          <LanguageToggle />
          <button onClick={props.onLeave}>退出房间</button>
        </div>
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
            {view.evilTeamInfo && (
              <section className="evil-team-info">
                <small>EVIL TEAM · 仅你可见</small>
                {view.evilTeamInfo.demon && (
                  <p>
                    <strong>恶魔</strong>
                    <span>
                      {view.evilTeamInfo.demon.seatIndex + 1} ·{' '}
                      {view.evilTeamInfo.demon.name}
                    </span>
                  </p>
                )}
                <p>
                  <strong>爪牙</strong>
                  <span>
                    {view.evilTeamInfo.minions
                      .map(
                        (minion) => `${minion.seatIndex + 1} · ${minion.name}`,
                      )
                      .join(' / ') || '无'}
                  </span>
                </p>
                {view.evilTeamInfo.demonBluffs.length > 0 && (
                  <p>
                    <strong>安全伪装</strong>
                    <span>
                      {view.evilTeamInfo.demonBluffs
                        .map(
                          (characterId) =>
                            ROLE_NAMES[characterId] ?? characterId,
                        )
                        .join(' · ')}
                    </span>
                  </p>
                )}
              </section>
            )}
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
                <h2>
                  {view.nightRequest.interaction === 'choose'
                    ? '选择夜间目标'
                    : view.nightRequest.interaction === 'grimoire'
                      ? '查看魔典'
                      : '等待说书人信息'}
                </h2>
                <p>
                  {view.nightRequest.interaction === 'choose'
                    ? `请选择 ${
                        view.nightRequest.minTargets ===
                        view.nightRequest.maxTargets
                          ? view.nightRequest.minTargets
                          : `${view.nightRequest.minTargets}–${view.nightRequest.maxTargets}`
                      } 名玩家。你的选择只会发送给说书人。`
                    : view.nightRequest.interaction === 'grimoire'
                      ? '查看完整魔典后，确认已阅读并通知说书人。'
                      : '你无需选择目标。说书人确认结果后，会私密显示在下方提示中。'}
                </p>
                {view.spyGrimoire && (
                  <section className="spy-grimoire" aria-label="间谍魔典">
                    <header>
                      <div>
                        <small>SPY EYES ONLY</small>
                        <h3>说书人的魔典</h3>
                      </div>
                      <span>仅本次唤醒可见</span>
                    </header>
                    <p className="spy-warning">
                      以下是当前魔典中的身份与状态。请勿让其他玩家看到屏幕。
                    </p>
                    <div className="spy-seat-grid">
                      {view.spyGrimoire.seats.map((seat) => {
                        const statusLabels = [
                          !seat.status.alive ? '死亡' : '',
                          seat.status.drunk ? '醉酒' : '',
                          seat.status.poisoned ? '中毒' : '',
                          seat.status.protected ? '受保护' : '',
                          !seat.status.alive && seat.status.deadVoteAvailable
                            ? '保留死亡票'
                            : '',
                        ].filter(Boolean);
                        const markers = [
                          ...statusLabels,
                          ...seat.effects,
                          ...seat.reminders,
                        ];
                        return (
                          <article
                            className={seat.alignment}
                            key={seat.playerId}
                          >
                            <span className="spy-seat-number">
                              {seat.seatIndex + 1}
                            </span>
                            <div>
                              <strong>{seat.playerName}</strong>
                              <b>
                                {ROLE_NAMES[seat.characterId] ??
                                  seat.characterId}
                              </b>
                              <small>
                                {seat.alignment === 'good'
                                  ? '善良阵营'
                                  : '邪恶阵营'}
                              </small>
                            </div>
                            <div className="spy-markers">
                              {markers.length ? (
                                markers.map((marker, index) => (
                                  <i key={`${marker}-${index}`}>{marker}</i>
                                ))
                              ) : (
                                <i className="clear">无状态标记</i>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {view.spyGrimoire.demonBluffs.length > 0 && (
                      <div className="spy-bluffs">
                        <strong>恶魔伪装身份</strong>
                        <span>
                          {view.spyGrimoire.demonBluffs
                            .map(
                              (characterId) =>
                                ROLE_NAMES[characterId] ?? characterId,
                            )
                            .join(' · ')}
                        </span>
                      </div>
                    )}
                  </section>
                )}
                {view.nightRequest.interaction === 'choose' && (
                  <>
                    <div className="night-target-progress">
                      已选择 {nightTargets.length} /{' '}
                      {view.nightRequest.maxTargets}
                    </div>
                    <div className="night-player-targets">
                      {view.nightRequest.legalTargets.map((player) => {
                        const selected = nightTargets.includes(player.id);
                        return (
                          <button
                            className={selected ? 'selected' : ''}
                            disabled={
                              !selected &&
                              nightTargets.length >=
                                view.nightRequest!.maxTargets
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
                            {!player.alive ? '（已死亡）' : ''}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                {view.nightRequest.submitted &&
                  view.nightRequest.interaction !== 'information' && (
                    <div className="player-success" role="status">
                      已私密提交，说书人端已收到。
                    </div>
                  )}
                {view.nightRequest.interaction !== 'information' && (
                  <button
                    className="player-primary"
                    disabled={
                      view.nightRequest.interaction === 'choose' &&
                      (nightTargets.length < view.nightRequest.minTargets ||
                        nightTargets.length > view.nightRequest.maxTargets)
                    }
                    onClick={() =>
                      props.onNightAction(
                        view.nightRequest!.stepId,
                        nightTargets,
                      )
                    }
                  >
                    {view.nightRequest.submitted
                      ? '重新提交给说书人'
                      : view.nightRequest.interaction === 'grimoire'
                        ? '确认已查看并通知说书人'
                        : '私密提交给说书人'}
                  </button>
                )}
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

        {view.phase === 'review' && view.review && (
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
      {view.phase === 'game_over' && view.review?.winner && (
        <EndingCinematic winner={view.review.winner} />
      )}
      {dawnCinematicOpen && (
        <DawnCinematic onComplete={() => setDawnCinematicOpen(false)} />
      )}
    </main>
  );
}
