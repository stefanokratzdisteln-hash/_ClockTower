import { useEffect, useRef, useState } from 'react';

const AUDIO_PREFERENCE_KEY = 'clocktower:room-audio';
const ANACREON_SOURCE = new URL(
  '../../../../public/audios/Anacreon.mp3',
  import.meta.url,
).href;

export function RoomAudioToggle() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(AUDIO_PREFERENCE_KEY) !== 'off',
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !soundEnabled) return;

    const tryToPlay = () => {
      void audio.play().catch(() => undefined);
    };

    tryToPlay();
    document.addEventListener('pointerdown', tryToPlay, { once: true });
    document.addEventListener('keydown', tryToPlay, { once: true });

    return () => {
      document.removeEventListener('pointerdown', tryToPlay);
      document.removeEventListener('keydown', tryToPlay);
    };
  }, [soundEnabled]);

  const toggleSound = () => {
    const audio = audioRef.current;
    const nextEnabled = !soundEnabled;

    setSoundEnabled(nextEnabled);
    localStorage.setItem(AUDIO_PREFERENCE_KEY, nextEnabled ? 'on' : 'off');

    if (!audio) return;
    if (nextEnabled) {
      void audio.play().catch(() => undefined);
    } else {
      audio.pause();
    }
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={ANACREON_SOURCE}
        preload="auto"
        autoPlay={soundEnabled}
        loop
      />
      <button
        className="sound-toggle"
        type="button"
        aria-label={soundEnabled ? '关闭房间音乐' : '打开房间音乐'}
        aria-pressed={soundEnabled}
        title={soundEnabled ? '关闭房间音乐' : '打开房间音乐'}
        onClick={toggleSound}
      >
        {soundEnabled ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            <path d="M16 9.5c.9.7 1.4 1.5 1.4 2.5s-.5 1.8-1.4 2.5M18.5 7c1.5 1.3 2.3 3 2.3 5s-.8 3.7-2.3 5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" />
            <path d="m17 9 4 4m0-4-4 4" />
          </svg>
        )}
        <span>{soundEnabled ? '声音' : '静音'}</span>
      </button>
    </>
  );
}
