const ENDING_IMAGES = {
  good: new URL('../../../../public/ending/HE.png', import.meta.url).href,
  evil: new URL('../../../../public/ending/BE.png', import.meta.url).href,
} as const;

type EndingCinematicProps = {
  winner: keyof typeof ENDING_IMAGES;
  onContinue?: () => void;
};

export function EndingCinematic({ winner, onContinue }: EndingCinematicProps) {
  const goodEnding = winner === 'good';

  return (
    <section
      className={`ending-cinematic ${winner}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${goodEnding ? '善良' : '邪恶'}阵营获胜结局`}
    >
      <img
        src={ENDING_IMAGES[winner]}
        alt={`${goodEnding ? '善良阵营获胜' : '邪恶阵营获胜'}结局 CG`}
      />
      <div className="ending-cinematic-shade" />
      <footer>
        <div>
          <small>{goodEnding ? 'HAPPY ENDING' : 'BAD ENDING'}</small>
          <strong>{goodEnding ? '善良阵营获胜' : '邪恶阵营获胜'}</strong>
        </div>
        {onContinue ? (
          <button type="button" onClick={onContinue}>
            进入复盘 <span>→</span>
          </button>
        ) : (
          <p>等待说书人开启复盘…</p>
        )}
      </footer>
    </section>
  );
}
