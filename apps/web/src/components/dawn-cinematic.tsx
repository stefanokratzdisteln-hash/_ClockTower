import { useEffect, useRef, useState } from 'react';

export const DAWN_CINEMATIC_FRAMES = [
  {
    source: new URL('../../../../public/comic/1.png', import.meta.url).href,
    width: 793,
    height: 985,
  },
  {
    source: new URL('../../../../public/comic/2.png', import.meta.url).href,
    width: 1345,
    height: 968,
  },
  {
    source: new URL('../../../../public/comic/3.png', import.meta.url).href,
    width: 1286,
    height: 894,
  },
  {
    source: new URL('../../../../public/comic/4.png', import.meta.url).href,
    width: 878,
    height: 1779,
  },
  {
    source: new URL('../../../../public/comic/5.png', import.meta.url).href,
    width: 1297,
    height: 839,
  },
  {
    source: new URL('../../../../public/comic/6.png', import.meta.url).href,
    width: 2174,
    height: 894,
  },
] as const;

export function DawnCinematic({ onComplete }: { onComplete: () => void }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const completed = useRef(false);
  const longestSourceEdge = Math.max(
    ...DAWN_CINEMATIC_FRAMES.map(({ width, height }) =>
      Math.max(width, height),
    ),
  );
  const commonScale =
    Math.max(viewport.width, viewport.height) / longestSourceEdge;
  const currentFrame = DAWN_CINEMATIC_FRAMES[frameIndex]!;
  const displayScale =
    viewport.width <= 720
      ? Math.min(
          viewport.width / currentFrame.width,
          viewport.height / currentFrame.height,
        )
      : commonScale;
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };
  const advance = () => {
    if (!ready) return;
    if (frameIndex >= DAWN_CINEMATIC_FRAMES.length - 1) finish();
    else setFrameIndex((current) => current + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const images = DAWN_CINEMATIC_FRAMES.map(({ source }, index) => {
      const image = new Image();
      if (index === 0) {
        image.onload = image.onerror = () => {
          if (!cancelled) setReady(true);
        };
      }
      image.src = source;
      return image;
    });
    return () => {
      cancelled = true;
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
    };
  }, []);

  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      if (frameIndex >= DAWN_CINEMATIC_FRAMES.length - 1) finish();
      else setFrameIndex((current) => current + 1);
    }, 2000);
    return () => window.clearTimeout(timeout);
  }, [frameIndex, ready]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div
      className="dawn-cinematic"
      role="dialog"
      aria-modal="true"
      aria-label="黎明剧情动画"
    >
      {ready ? (
        <>
          <img
            alt={`黎明剧情第 ${frameIndex + 1} 幕`}
            key={currentFrame.source}
            src={currentFrame.source}
            style={{
              width: `${currentFrame.width * displayScale}px`,
              height: `${currentFrame.height * displayScale}px`,
            }}
            onClick={advance}
          />
          <div className="dawn-cinematic-vignette" />
          <header>
            <small>DAWN SEQUENCE</small>
            <strong>黎明将至</strong>
          </header>
          <div className="dawn-cinematic-progress">
            <span>
              {frameIndex + 1} / {DAWN_CINEMATIC_FRAMES.length}
            </span>
            <div>
              {DAWN_CINEMATIC_FRAMES.map(({ source }, index) => (
                <i
                  className={index <= frameIndex ? 'active' : ''}
                  key={source}
                />
              ))}
            </div>
          </div>
          <p>点击画面或按空格播放下一幕</p>
        </>
      ) : (
        <div className="dawn-cinematic-loading">
          <i />
          <strong>正在载入黎明序列</strong>
        </div>
      )}
      <button onClick={finish}>跳过 CG，进入白天</button>
    </div>
  );
}
