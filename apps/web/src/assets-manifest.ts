import type { AssetManifest } from '@clocktower/shared';

const ROOT = '/assets/user';

export const USER_ASSETS = {
  lobbyBackground: {
    id: 'lobby-background',
    kind: 'background',
    path: `${ROOT}/background-lobby-desktop.webp`,
    mobilePath: `${ROOT}/background-lobby-mobile.webp`,
    width: 2560,
    height: 1440,
    optional: true,
  },
  dayBackground: {
    id: 'day-background',
    kind: 'background',
    path: `${ROOT}/background-day-desktop.webp`,
    mobilePath: `${ROOT}/background-day-mobile.webp`,
    width: 2560,
    height: 1440,
    optional: true,
  },
  nightBackground: {
    id: 'night-background',
    kind: 'background',
    path: `${ROOT}/background-night-desktop.webp`,
    mobilePath: `${ROOT}/background-night-mobile.webp`,
    width: 2560,
    height: 1440,
    optional: true,
  },
  reviewBackground: {
    id: 'review-background',
    kind: 'background',
    path: `${ROOT}/background-review-desktop.webp`,
    mobilePath: `${ROOT}/background-review-mobile.webp`,
    width: 2560,
    height: 1440,
    optional: true,
  },
  townSquare: {
    id: 'town-square',
    kind: 'overlay',
    path: `${ROOT}/town-square.webp`,
    width: 2048,
    height: 2048,
    optional: true,
  },
  townForeground: {
    id: 'town-foreground',
    kind: 'overlay',
    path: `${ROOT}/town-foreground.webp`,
    width: 2048,
    height: 2048,
    optional: true,
  },
  panelTexture: {
    id: 'panel-texture',
    kind: 'overlay',
    path: `${ROOT}/panel-texture.webp`,
    width: 1024,
    height: 1024,
    optional: true,
  },
  introAnimation: {
    id: 'intro-animation',
    kind: 'animation',
    path: `${ROOT}/animation-intro.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  nightfallAnimation: {
    id: 'nightfall-animation',
    kind: 'animation',
    path: `${ROOT}/animation-nightfall.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  dawnAnimation: {
    id: 'dawn-animation',
    kind: 'animation',
    path: `${ROOT}/animation-dawn.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  nominationAnimation: {
    id: 'nomination-animation',
    kind: 'animation',
    path: `${ROOT}/animation-nomination.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  executionAnimation: {
    id: 'execution-animation',
    kind: 'animation',
    path: `${ROOT}/animation-execution.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  goodWinAnimation: {
    id: 'good-win-animation',
    kind: 'animation',
    path: `${ROOT}/animation-good-win.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
  evilWinAnimation: {
    id: 'evil-win-animation',
    kind: 'animation',
    path: `${ROOT}/animation-evil-win.webm`,
    width: 1920,
    height: 1080,
    optional: true,
  },
} as const satisfies AssetManifest;

function imageAvailable(path: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = path;
  });
}

/** Applies optional artwork only after it has loaded successfully. */
export async function installAvailableUserAssets(): Promise<void> {
  const root = document.documentElement;
  const mobile = window.matchMedia('(max-width: 720px)').matches;
  const preferred = (slot: { path: string; mobilePath?: string }) =>
    mobile && slot.mobilePath ? slot.mobilePath : slot.path;
  const pairs = [
    ['--asset-bg-lobby', preferred(USER_ASSETS.lobbyBackground)],
    ['--asset-bg-day', preferred(USER_ASSETS.dayBackground)],
    ['--asset-bg-night', preferred(USER_ASSETS.nightBackground)],
    ['--asset-bg-review', preferred(USER_ASSETS.reviewBackground)],
    ['--asset-panel-texture', USER_ASSETS.panelTexture.path],
    ['--asset-town-square', USER_ASSETS.townSquare.path],
    ['--asset-town-foreground', USER_ASSETS.townForeground.path],
  ] as const;
  await Promise.all(
    pairs.map(async ([variable, path]) => {
      if (await imageAvailable(path)) {
        root.style.setProperty(variable, `url("${path}")`);
      }
    }),
  );
}
