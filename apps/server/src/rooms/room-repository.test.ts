import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import type { StorytellerCommand } from '@clocktower/shared';

import { ReadOnlyAiService } from '../ai/ai-service.js';
import { SqliteRoomRepository } from './room-repository.js';
import { RoomService } from './room-service.js';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('SQLite room persistence', () => {
  it('restores authoritative state and hashed sessions after restart', () => {
    const directory = mkdtempSync(join(tmpdir(), 'clocktower-sqlite-'));
    directories.push(directory);
    const path = join(directory, 'rooms.sqlite');

    const first = new RoomService(
      new ReadOnlyAiService(),
      new SqliteRoomRepository(path),
    );
    const session = first.create('PERSIST-1');
    const initial = first.getSnapshot(session.roomId, session.token);
    expect(initial.type).toBe('SNAPSHOT');
    const version =
      initial.type === 'SNAPSHOT' && initial.payload.kind === 'storyteller'
        ? initial.payload.state.version
        : 0;
    first.handleMessage(session.roomId, session.token, {
      type: 'COMMAND',
      requestId: 'add-demo',
      expectedVersion: version,
      command: { type: 'ADD_DEMO_PLAYERS' },
    });
    const exported = first.exportGame(session.roomId, session.token);
    expect(JSON.stringify(exported)).not.toContain(session.token);
    first.close();

    const second = new RoomService(
      new ReadOnlyAiService(),
      new SqliteRoomRepository(path),
    );
    const restored = second.getSnapshot(session.roomId, session.token);
    expect(restored.type).toBe('SNAPSHOT');
    if (
      restored.type === 'SNAPSHOT' &&
      restored.payload.kind === 'storyteller'
    ) {
      expect(restored.payload.state.players).toHaveLength(7);
    }
    second.close();
  });

  it('returns the original version for a duplicate idempotency key', () => {
    const directory = mkdtempSync(join(tmpdir(), 'clocktower-sqlite-'));
    directories.push(directory);
    const service = new RoomService(
      new ReadOnlyAiService(),
      new SqliteRoomRepository(join(directory, 'rooms.sqlite')),
    );
    const session = service.create('IDEMPOTENT');
    const message = {
      type: 'COMMAND' as const,
      requestId: 'stable-request',
      command: { type: 'ADD_PLAYER' as const, name: '唯一玩家' },
    };
    const firstVersion = service.handleMessage(
      session.roomId,
      session.token,
      message,
    );
    const secondVersion = service.handleMessage(
      session.roomId,
      session.token,
      message,
    );
    expect(secondVersion).toBe(firstVersion);
    const snapshot = service.getSnapshot(session.roomId, session.token);
    if (
      snapshot.type === 'SNAPSHOT' &&
      snapshot.payload.kind === 'storyteller'
    ) {
      expect(snapshot.payload.state.players).toHaveLength(1);
    }
    service.close();
  });

  it('releases a room permanently so its code can be reused', () => {
    const directory = mkdtempSync(join(tmpdir(), 'clocktower-sqlite-'));
    directories.push(directory);
    const path = join(directory, 'rooms.sqlite');
    const service = new RoomService(
      new ReadOnlyAiService(),
      new SqliteRoomRepository(path),
    );
    const firstSession = service.create('REUSABLE');

    service.release(firstSession.roomId, firstSession.token);
    const secondSession = service.create('REUSABLE');

    expect(secondSession.roomId).toBe('REUSABLE');
    service.close();
  });
});

describe('night workflow', () => {
  it('automatically opens the night queue and blocks dawn until every step is resolved', () => {
    const service = new RoomService();
    const session = service.create('NIGHT-FLOW');
    let request = 0;
    const send = (command: StorytellerCommand) =>
      service.handleMessage(session.roomId, session.token, {
        type: 'COMMAND',
        requestId: `night-${request++}`,
        command,
      });
    const state = () => {
      const snapshot = service.getSnapshot(session.roomId, session.token);
      if (
        snapshot.type !== 'SNAPSHOT' ||
        snapshot.payload.kind !== 'storyteller'
      ) {
        throw new Error('Expected a storyteller snapshot.');
      }
      return snapshot.payload.state;
    };

    send({ type: 'ADD_DEMO_PLAYERS' });
    send({ type: 'ADVANCE_PHASE', to: 'setup_players' });
    send({ type: 'ADVANCE_PHASE', to: 'assign_characters' });
    send({ type: 'AUTO_ASSIGN' });
    send({ type: 'ADVANCE_PHASE', to: 'private_reveal' });
    send({ type: 'ADVANCE_PHASE', to: 'first_night' });

    expect(state().nightQueue.length).toBeGreaterThan(0);
    expect(state().nightQueue[0]?.status).toBe('active');
    expect(() =>
      send({ type: 'ADVANCE_PHASE', to: 'day_discussion' }),
    ).toThrowError(/完成或跳过本夜全部行动/);

    while (state().nightQueue.some(({ status }) => status === 'active')) {
      const active = state().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'skipped',
      });
    }

    send({ type: 'ADVANCE_PHASE', to: 'day_discussion' });
    expect(state().phase).toBe('day_discussion');
    service.close();
  });
});
