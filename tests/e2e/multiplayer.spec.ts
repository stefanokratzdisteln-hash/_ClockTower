import { expect, test, type APIRequestContext } from '@playwright/test';
import WebSocket from 'ws';

import { buildApp } from '../../apps/server/src/main.js';

type Message = {
  type: string;
  requestId?: string;
  version?: number;
  payload?: {
    kind: 'storyteller' | 'player';
    state?: {
      version: number;
      phase: string;
      assignments: unknown[];
      nominations: Array<{
        id: string;
        voteCount: number;
        executionThreshold: number;
        votes: Array<{ voterId: string; value: boolean }>;
      }>;
    };
    view?: {
      version: number;
      phase: string;
      self: { id: string; characterId?: string };
      activeNomination?: { id: string; voteCount: number };
    };
    suggestions?: Array<{
      id: string;
      type: string;
      confirmed: boolean;
      proposedAction?: { type: string };
    }>;
  };
  code?: string;
  message?: string;
};

class RoomSocket {
  readonly socket: WebSocket;
  private readonly queue: Message[] = [];
  private readonly waiters: Array<{
    predicate: (message: Message) => boolean;
    resolve: (message: Message) => void;
  }> = [];

  private constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as Message;
      const index = this.waiters.findIndex(({ predicate }) =>
        predicate(message),
      );
      if (index >= 0) this.waiters.splice(index, 1)[0]!.resolve(message);
      else this.queue.push(message);
    });
  }

  static async connect(roomId: string, token: string) {
    const client = new RoomSocket(
      `ws://127.0.0.1:3000/ws/${encodeURIComponent(roomId)}?token=${encodeURIComponent(token)}`,
    );
    await new Promise<void>((resolve, reject) => {
      client.socket.once('open', resolve);
      client.socket.once('error', reject);
    });
    return client;
  }

  next(predicate: (message: Message) => boolean = () => true) {
    const index = this.queue.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.queue.splice(index, 1)[0]!);
    return new Promise<Message>((resolve, reject) => {
      const waiter = { predicate, resolve };
      this.waiters.push(waiter);
      setTimeout(() => {
        const pending = this.waiters.indexOf(waiter);
        if (pending >= 0) this.waiters.splice(pending, 1);
        reject(new Error('Timed out waiting for WebSocket message'));
      }, 5_000);
    });
  }

  async snapshot() {
    return this.next((message) => message.type === 'SNAPSHOT');
  }

  async snapshotWhere(predicate: (message: Message) => boolean) {
    return this.next(
      (message) => message.type === 'SNAPSHOT' && predicate(message),
    );
  }

  async command(command: Record<string, unknown>, expectedVersion?: number) {
    const requestId = crypto.randomUUID();
    this.socket.send(
      JSON.stringify({
        type: 'COMMAND',
        requestId,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        command,
      }),
    );
    const acknowledgement = await this.next(
      (message) =>
        message.requestId === requestId &&
        (message.type === 'COMMAND_ACCEPTED' || message.type === 'ERROR'),
    );
    if (acknowledgement.type === 'ERROR') return acknowledgement;
    return this.snapshotWhere(
      (message) =>
        message.payload?.state?.version === acknowledgement.version ||
        message.payload?.view?.version === acknowledgement.version,
    );
  }

  close() {
    this.socket.close();
  }
}

let app: Awaited<ReturnType<typeof buildApp>>;

test.beforeAll(async () => {
  app = await buildApp();
  await app.listen({ port: 3000, host: '127.0.0.1' });
});

test.afterAll(async () => {
  await app.close();
});

async function createRoom(request: APIRequestContext, suffix: string) {
  const response = await request.post('http://127.0.0.1:3000/api/rooms', {
    data: { roomId: `E2E-${suffix}` },
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ roomId: string; token: string }>;
}

async function join(request: APIRequestContext, roomId: string, name: string) {
  const response = await request.post(
    `http://127.0.0.1:3000/api/rooms/${roomId}/join`,
    { data: { name } },
  );
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ playerId: string; token: string }>;
}

test('玩家权限隔离、黎明 CG、投票同步和断线恢复', async ({
  page,
  request,
}, testInfo) => {
  const session = await createRoom(request, `SYNC-${testInfo.project.name}`);
  const storyteller = await RoomSocket.connect(session.roomId, session.token);
  let storytellerState = (await storyteller.snapshot()).payload!.state!;

  storytellerState = (
    await storyteller.command(
      { type: 'ADD_DEMO_PLAYERS' },
      storytellerState.version,
    )
  ).payload!.state!;
  const aliceSession = await join(request, session.roomId, '林');
  const bobSession = await join(request, session.roomId, '乔');
  await page.addInitScript(
    ({ roomId, token }) => {
      localStorage.setItem(
        `clocktower:player:${roomId}`,
        JSON.stringify({ token }),
      );
    },
    { roomId: session.roomId, token: aliceSession.token },
  );
  await page.goto(`/?room=${session.roomId}&player=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('.player-shell')).toBeVisible();
  const alice = await RoomSocket.connect(session.roomId, aliceSession.token);
  const bob = await RoomSocket.connect(session.roomId, bobSession.token);
  const aliceInitial = await alice.snapshot();
  const bobInitial = await bob.snapshot();
  await storyteller.snapshot();
  await storyteller.snapshot();

  expect(JSON.stringify(aliceInitial)).not.toContain('"assignments"');
  expect(JSON.stringify(bobInitial)).not.toContain('"assignments"');
  expect(aliceInitial.payload!.view!.self.id).toBe(aliceSession.playerId);
  expect(bobInitial.payload!.view!.self.id).toBe(bobSession.playerId);

  alice.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      requestId: 'forbidden',
      command: { type: 'AUTO_ASSIGN' },
    }),
  );
  const forbidden = await alice.next((message) => message.type === 'ERROR');
  expect(forbidden.code).toBe('FORBIDDEN_COMMAND');

  for (const command of [
    { type: 'ADVANCE_PHASE', to: 'setup_players' },
    { type: 'ADVANCE_PHASE', to: 'assign_characters' },
    { type: 'AUTO_ASSIGN' },
    { type: 'ADVANCE_PHASE', to: 'private_reveal' },
    { type: 'ADVANCE_PHASE', to: 'first_night' },
  ]) {
    storytellerState = (
      await storyteller.command(command, storytellerState.version)
    ).payload!.state!;
  }
  while (
    storytellerState.nightQueue.some(({ status }) => status === 'active')
  ) {
    const nightStep = storytellerState.nightQueue.find(
      ({ status }) => status === 'active',
    )!;
    storytellerState = (
      await storyteller.command(
        {
          type: 'UPDATE_NIGHT_STEP',
          stepId: nightStep.id,
          status: 'skipped',
        },
        storytellerState.version,
      )
    ).payload!.state!;
  }
  storytellerState = (
    await storyteller.command(
      { type: 'ADVANCE_PHASE', to: 'day_discussion' },
      storytellerState.version,
    )
  ).payload!.state!;
  await expect(page.locator('.dawn-cinematic')).toBeVisible();
  await expect(page.locator('.dawn-cinematic > img')).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: /跳过 CG|Skip CG/ }).click();
  await expect(page.locator('.dawn-cinematic')).toBeHidden();

  storytellerState = (
    await storyteller.command(
      { type: 'ADVANCE_PHASE', to: 'nomination' },
      storytellerState.version,
    )
  ).payload!.state!;

  await alice.command({
    type: 'CREATE_NOMINATION',
    nomineeId: bobSession.playerId,
  });
  storytellerState = (
    await storyteller.snapshotWhere(
      (message) => (message.payload?.state?.nominations.length ?? 0) > 0,
    )
  ).payload!.state!;
  const nominationId = storytellerState.nominations.at(-1)!.id;
  storytellerState = (
    await storyteller.command(
      { type: 'ADVANCE_PHASE', to: 'voting' },
      storytellerState.version,
    )
  ).payload!.state!;
  await alice.snapshotWhere(
    (message) => message.payload?.view?.phase === 'voting',
  );
  await bob.snapshotWhere(
    (message) => message.payload?.view?.phase === 'voting',
  );

  alice.socket.send(
    JSON.stringify({
      type: 'COMMAND',
      requestId: 'spoof-proof',
      command: {
        type: 'CAST_VOTE',
        nominationId,
        voterId: bobSession.playerId,
        value: true,
      },
    }),
  );
  const bobSynced = await bob.snapshotWhere(
    (message) => message.payload?.view?.activeNomination?.voteCount === 1,
  );
  expect(bobSynced.payload!.view!.activeNomination!.voteCount).toBe(1);
  storytellerState = (
    await storyteller.snapshotWhere((message) =>
      Boolean(
        message.payload?.state?.nominations
          .at(-1)
          ?.votes.some(
            (vote) => vote.voterId === aliceSession.playerId && vote.value,
          ),
      ),
    )
  ).payload!.state!;
  const recordedVote = storytellerState.nominations
    .at(-1)!
    .votes.find(
      (vote: { voterId: string }) => vote.voterId === aliceSession.playerId,
    );
  expect(recordedVote).toBeTruthy();

  alice.close();
  const reconnectedAlice = await RoomSocket.connect(
    session.roomId,
    aliceSession.token,
  );
  const restored = await reconnectedAlice.snapshot();
  expect(restored.payload!.view!.activeNomination!.voteCount).toBe(1);
  expect(restored.payload!.view!.self.id).toBe(aliceSession.playerId);

  reconnectedAlice.close();
  bob.close();
  storyteller.close();
});

test('AI 只读摘要与说书人确认不改变 GameState', async ({
  request,
}, testInfo) => {
  const session = await createRoom(request, `AI-${testInfo.project.name}`);
  const storyteller = await RoomSocket.connect(session.roomId, session.token);
  const before = (await storyteller.snapshot()).payload!.state!;

  const generated = await storyteller.command(
    { type: 'REQUEST_AI_SUGGESTIONS' },
    before.version,
  );
  expect(generated.payload!.state!.version).toBe(before.version);
  expect(
    generated.payload!.suggestions!.map(({ type }) => type).sort(),
  ).toEqual(
    [
      'RULE_HINT',
      'PACE_HINT',
      'BALANCE_HINT',
      'EXPERIENCE_HINT',
      'DRAMA_HINT',
      'REVIEW_SUMMARY',
      'RISK_WARNING',
    ].sort(),
  );

  const suggestionId = generated.payload!.suggestions![0]!.id;
  const confirmed = await storyteller.command(
    { type: 'CONFIRM_AI_SUGGESTION', suggestionId },
    before.version,
  );
  expect(confirmed.payload!.state!.version).toBe(before.version);
  expect(
    confirmed.payload!.suggestions!.find(({ id }) => id === suggestionId)
      ?.confirmed,
  ).toBe(true);
  const executable = confirmed.payload!.suggestions!.find(
    ({ proposedAction }) => proposedAction,
  );
  expect(executable).toBeTruthy();
  if (!executable!.confirmed) {
    await storyteller.command(
      { type: 'CONFIRM_AI_SUGGESTION', suggestionId: executable!.id },
      before.version,
    );
  }
  const executed = await storyteller.command(
    { type: 'EXECUTE_CONFIRMED_AI_ACTION', suggestionId: executable!.id },
    before.version,
  );
  expect(executed.payload!.state!.version).toBeGreaterThan(before.version);
  storyteller.close();
});

test('移动端玩家加入页可用且暴露 PWA manifest', async ({ page }, testInfo) => {
  const roomId = `E2E-UI-${testInfo.project.name}`;
  await page.goto(`/?room=${roomId}&player=1`);
  await expect(page.getByRole('heading', { name: '加入钟楼' })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  await expect(page.getByLabel('房间码')).toHaveValue(roomId.toUpperCase());
  expect(
    await page
      .locator('body')
      .evaluate((body) => body.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test('F5 释放当前对局、返回根页面并允许复用房间码', async ({
  page,
  request,
}, testInfo) => {
  const roomId = `E2E-RESET-${testInfo.project.name}`;
  await page.goto('/');
  await page.locator('.create-room input').fill(roomId);
  await page.locator('.create-room button.primary').click();
  await expect(page.locator('.mp-shell')).toBeVisible();

  await page.keyboard.press('F5');

  await expect(page.locator('.create-room')).toBeVisible();
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  const reused = await request.post('http://127.0.0.1:3000/api/rooms', {
    data: { roomId },
  });
  expect(reused.ok()).toBeTruthy();
});

test('说书人可以手动添加玩家并载入 7 人测试阵容', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', {
      configurable: true,
      value: undefined,
    });
  });

  const createFromRoot = async (suffix: string) => {
    await page.goto('/');
    await page
      .locator('.create-room input')
      .fill(`E2E-LOBBY-${suffix}-${testInfo.project.name}`);
    await page.locator('.create-room button.primary').click();
    await expect(page.locator('.mp-shell')).toBeVisible();
  };

  await createFromRoot('MANUAL');
  await page.locator('.quick-add input').fill('手动玩家');
  await page.locator('.quick-add button').click();
  await expect(page.locator('.mp-roster')).toContainText('手动玩家');

  await page.getByRole('button', { name: /补足至 7 人测试阵容/ }).click();
  await expect(page.locator('.mp-roster article')).toHaveCount(7);

  await page.getByRole('button', { name: /角色能力表 R/ }).click();
  await page.keyboard.press('m');
  await expect(page.getByRole('button', { name: /魔典 M/ })).toHaveClass(
    /active/,
  );

  if (testInfo.project.name === 'chromium') {
    const layout = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      return {
        roster: box('.roster-panel'),
        stage: box('.stage-panel'),
        logPanel: box('.intelligence-panel'),
        qr: box('.share-card'),
        add: box('.quick-add'),
        next: box('.side-next-button'),
        log: box('.game-log'),
      };
    });
    expect(layout.roster.x).toBeLessThan(layout.stage.x);
    expect(layout.stage.x).toBeLessThan(layout.logPanel.x);
    expect(layout.qr.y).toBeLessThan(layout.add.y);
    expect(layout.next.y).toBeLessThan(layout.log.y);
  }
});

test('玩家不扫码也可以输入房间码和昵称手动加入', async ({
  page,
  context,
}, testInfo) => {
  const roomId = `E2E-MANUAL-JOIN-${testInfo.project.name}`;
  await page.goto('/');
  await page.locator('.create-room input').fill(roomId);
  await page.locator('.create-room button.primary').click();
  await expect(page.locator('.mp-shell')).toBeVisible();

  const playerPage = await context.newPage();
  await playerPage.goto(`/?room=${roomId}&player=1`);
  await playerPage.locator('.join-card input').nth(1).fill('手动加入玩家');
  await playerPage.locator('.join-card .player-primary').click();

  await expect(playerPage.locator('.player-topbar')).toBeVisible();
  await expect(page.locator('.mp-roster')).toContainText('手动加入玩家');
});

for (const ending of [
  {
    alignment: 'good' as const,
    label: '善良阵营获胜',
    imageName: 'HE',
  },
  {
    alignment: 'evil' as const,
    label: '邪恶阵营获胜',
    imageName: 'BE',
  },
]) {
  test(`说书人端结束后立即展示${ending.label} CG 并可进入复盘`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(45_000);
    const session = await createRoom(
      request,
      `ENDING-${ending.alignment}-${testInfo.project.name}`,
    );
    const storyteller = await RoomSocket.connect(session.roomId, session.token);
    const initial = (await storyteller.snapshot()).payload!.state!;

    await storyteller.command(
      {
        type: 'END_GAME',
        winningAlignment: ending.alignment,
        reason: '端到端结局 CG 验证',
      },
      initial.version,
    );
    await page.addInitScript(({ roomId, token }) => {
      localStorage.setItem(
        `clocktower:storyteller:${roomId}`,
        JSON.stringify({ role: 'storyteller', roomId, token }),
      );
    }, session);
    await page.goto(`/?room=${session.roomId}`, {
      waitUntil: 'domcontentloaded',
    });

    const cinematic = page.locator(`.ending-cinematic.${ending.alignment}`);
    await expect(cinematic).toBeVisible();
    await expect(cinematic.getByText(ending.label)).toBeVisible();
    await expect(cinematic.locator('img')).toHaveAttribute(
      'src',
      new RegExp(`${ending.imageName}-[^/]+\\.png$`),
    );
    const cgLayout = await cinematic.locator('img').evaluate((image) => {
      const style = getComputedStyle(image);
      return {
        position: style.position,
        objectFit: style.objectFit,
        left: image.offsetLeft,
        top: image.offsetTop,
        width: image.clientWidth,
        height: image.clientHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(cgLayout).toEqual({
      position: 'absolute',
      objectFit: 'contain',
      left: 0,
      top: 0,
      width: cgLayout.viewportWidth,
      height: cgLayout.viewportHeight,
      viewportWidth: cgLayout.viewportWidth,
      viewportHeight: cgLayout.viewportHeight,
    });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          html: getComputedStyle(document.documentElement).overflow,
          body: getComputedStyle(document.body).overflow,
        })),
      )
      .toEqual({ html: 'hidden', body: 'hidden' });

    await cinematic.getByRole('button', { name: /进入复盘/ }).click();
    await expect(cinematic).toBeHidden();
    await expect(page.locator('.mp-shell')).toHaveAttribute(
      'data-phase',
      'review',
    );
    await expect(page.locator('.mp-hero h1')).toHaveText('复盘');
    storyteller.close();
  });
}
