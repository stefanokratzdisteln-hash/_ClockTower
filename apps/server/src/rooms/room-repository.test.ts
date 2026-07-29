import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import type { PlayerView } from '@clocktower/rules-engine';
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

  it('delivers Storyteller night information to the correct player view', () => {
    const service = new RoomService();
    const session = service.create('NIGHT-INFO');
    let request = 0;
    const send = (command: StorytellerCommand) =>
      service.handleMessage(session.roomId, session.token, {
        type: 'COMMAND',
        requestId: `night-info-${request++}`,
        command,
      });
    const storytellerState = () => {
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
    const players = storytellerState().players;
    const washerwoman = players[0]!;
    const playerSession = service.join(session.roomId, washerwoman.name);
    send({ type: 'ADVANCE_PHASE', to: 'setup_players' });
    send({ type: 'ADVANCE_PHASE', to: 'assign_characters' });
    send({
      type: 'MANUAL_ASSIGN',
      assignments: players.map(({ id }, index) => ({
        playerId: id,
        characterId: [
          'washerwoman',
          'chef',
          'empath',
          'fortune_teller',
          'soldier',
          'spy',
          'imp',
        ][index]!,
      })),
    });
    send({ type: 'ADVANCE_PHASE', to: 'private_reveal' });
    send({ type: 'ADVANCE_PHASE', to: 'first_night' });

    const step = storytellerState().nightQueue.find(
      ({ characterId }) => characterId === 'washerwoman',
    )!;
    send({
      type: 'UPDATE_NIGHT_STEP',
      stepId: step.id,
      status: 'completed',
      targetIds: [],
      resultSummary: '2 号或 5 号玩家中有一名是厨师。',
    });

    const playerSnapshot = service.getSnapshot(
      session.roomId,
      playerSession.token,
    );
    if (
      playerSnapshot.type !== 'SNAPSHOT' ||
      playerSnapshot.payload.kind !== 'player'
    ) {
      throw new Error('Expected a player snapshot.');
    }
    const playerView = playerSnapshot.payload.view as PlayerView;
    expect(playerView.privateHints.at(-1)).toMatchObject({
      kind: '夜间结果',
      text: '2 号或 5 号玩家中有一名是厨师。',
    });
    service.close();
  });

  it('records a Spy grimoire acknowledgement for both player and Storyteller', () => {
    const service = new RoomService();
    const session = service.create('SPY-ACK');
    let request = 0;
    const send = (command: StorytellerCommand) =>
      service.handleMessage(session.roomId, session.token, {
        type: 'COMMAND',
        requestId: `spy-ack-${request++}`,
        command,
      });
    const storytellerState = () => {
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
    const players = storytellerState().players;
    const spy = players[0]!;
    const spySession = service.join(session.roomId, spy.name);
    send({ type: 'ADVANCE_PHASE', to: 'setup_players' });
    send({ type: 'ADVANCE_PHASE', to: 'assign_characters' });
    send({
      type: 'MANUAL_ASSIGN',
      assignments: players.map(({ id }, index) => ({
        playerId: id,
        characterId: [
          'spy',
          'washerwoman',
          'librarian',
          'investigator',
          'chef',
          'empath',
          'imp',
        ][index]!,
      })),
    });
    send({ type: 'ADVANCE_PHASE', to: 'private_reveal' });
    send({ type: 'ADVANCE_PHASE', to: 'first_night' });

    while (
      storytellerState().nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'spy'
    ) {
      const active = storytellerState().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'skipped',
      });
    }
    const spyStep = storytellerState().nightQueue.find(
      ({ status }) => status === 'active',
    )!;
    service.handleMessage(session.roomId, spySession.token, {
      type: 'COMMAND',
      requestId: 'spy-player-submit',
      command: {
        type: 'SUBMIT_NIGHT_ACTION',
        stepId: spyStep.id,
        targetIds: [],
      },
    });

    const receivedStep = storytellerState().nightQueue.find(
      ({ id }) => id === spyStep.id,
    );
    expect(receivedStep).toMatchObject({
      status: 'active',
      targetIds: [],
    });
    expect(receivedStep?.playerSubmittedAt).toBeTruthy();
    expect(receivedStep?.resultSummary).toBeUndefined();

    const playerSnapshot = service.getSnapshot(
      session.roomId,
      spySession.token,
    );
    if (
      playerSnapshot.type !== 'SNAPSHOT' ||
      playerSnapshot.payload.kind !== 'player'
    ) {
      throw new Error('Expected a player snapshot.');
    }
    expect(
      (playerSnapshot.payload.view as PlayerView).nightRequest,
    ).toMatchObject({
      interaction: 'grimoire',
      submitted: true,
    });
    service.close();
  });

  it('delivers the selected adjacent evil pair count to the Chef', () => {
    const service = new RoomService();
    const session = service.create('CHEF-INFO');
    let request = 0;
    const send = (command: StorytellerCommand) =>
      service.handleMessage(session.roomId, session.token, {
        type: 'COMMAND',
        requestId: `chef-info-${request++}`,
        command,
      });
    const storytellerState = () => {
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
    const players = storytellerState().players;
    const chef = players[0]!;
    const chefSession = service.join(session.roomId, chef.name);
    send({ type: 'ADVANCE_PHASE', to: 'setup_players' });
    send({ type: 'ADVANCE_PHASE', to: 'assign_characters' });
    send({
      type: 'MANUAL_ASSIGN',
      assignments: players.map(({ id }, index) => ({
        playerId: id,
        characterId: [
          'chef',
          'washerwoman',
          'librarian',
          'investigator',
          'empath',
          'spy',
          'imp',
        ][index]!,
      })),
    });
    send({ type: 'ADVANCE_PHASE', to: 'private_reveal' });
    send({ type: 'ADVANCE_PHASE', to: 'first_night' });

    while (
      storytellerState().nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'chef'
    ) {
      const active = storytellerState().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'skipped',
      });
    }
    const chefStep = storytellerState().nightQueue.find(
      ({ status }) => status === 'active',
    )!;
    send({
      type: 'UPDATE_NIGHT_STEP',
      stepId: chefStep.id,
      status: 'completed',
      targetIds: [],
      resultSummary: '厨师信息：相邻邪恶玩家共有 1 对。',
    });

    const playerSnapshot = service.getSnapshot(
      session.roomId,
      chefSession.token,
    );
    if (
      playerSnapshot.type !== 'SNAPSHOT' ||
      playerSnapshot.payload.kind !== 'player'
    ) {
      throw new Error('Expected a player snapshot.');
    }
    expect(
      (playerSnapshot.payload.view as PlayerView).privateHints.at(-1),
    ).toMatchObject({
      kind: '夜间结果',
      text: '厨师信息：相邻邪恶玩家共有 1 对。',
    });
    service.close();
  });

  it('applies Poisoner, Butler, and Monk choices after Storyteller confirmation', () => {
    const service = new RoomService();
    const session = service.create('NIGHT-EFFECTS');
    let request = 0;
    const send = (command: StorytellerCommand) =>
      service.handleMessage(session.roomId, session.token, {
        type: 'COMMAND',
        requestId: `night-effects-${request++}`,
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
    const completeActive = (targetIds: string[] = []) => {
      const active = state().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'completed',
        targetIds,
        ...(getInfoRoleIds().has(active.characterId)
          ? { resultSummary: '测试夜间结果' }
          : {}),
      });
    };
    const skipRemainingNight = () => {
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
    };

    for (let index = 0; index < 8; index += 1) {
      send({ type: 'ADD_PLAYER', name: `效果玩家 ${index + 1}` });
    }
    const players = state().players;
    send({ type: 'ADVANCE_PHASE', to: 'setup_players' });
    send({ type: 'ADVANCE_PHASE', to: 'assign_characters' });
    send({
      type: 'MANUAL_ASSIGN',
      assignments: players.map(({ id }, index) => ({
        playerId: id,
        characterId: [
          'monk',
          'chef',
          'empath',
          'fortune_teller',
          'soldier',
          'butler',
          'poisoner',
          'imp',
        ][index]!,
      })),
    });
    send({ type: 'ADVANCE_PHASE', to: 'private_reveal' });
    send({ type: 'ADVANCE_PHASE', to: 'first_night' });

    const poisonTarget = players[1]!;
    completeActive([poisonTarget.id]);
    expect(
      state().assignments.find(({ playerId }) => playerId === poisonTarget.id)
        ?.status.poisoned,
    ).toBe(true);
    while (
      state().nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'butler'
    ) {
      const active = state().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'skipped',
      });
    }
    const master = players[2]!;
    completeActive([master.id]);
    expect(
      state().assignments
        .find(({ characterId }) => characterId === 'butler')
        ?.effects.some(
          ({ kind, sourcePlayerId }) =>
            kind === 'master' && sourcePlayerId === master.id,
        ),
    ).toBe(true);
    skipRemainingNight();

    for (const to of [
      'day_discussion',
      'nomination',
      'voting',
      'execution_resolution',
      'night',
    ] as const) {
      send({ type: 'ADVANCE_PHASE', to });
    }
    while (
      state().nightQueue.find(({ status }) => status === 'active')
        ?.characterId !== 'monk'
    ) {
      const active = state().nightQueue.find(
        ({ status }) => status === 'active',
      )!;
      send({
        type: 'UPDATE_NIGHT_STEP',
        stepId: active.id,
        status: 'skipped',
      });
    }
    const protectedPlayer = players[3]!;
    completeActive([protectedPlayer.id]);
    expect(
      state().assignments.find(
        ({ playerId }) => playerId === protectedPlayer.id,
      )?.status.protected,
    ).toBe(true);
    service.close();
  });
});

function getInfoRoleIds() {
  return new Set([
    'washerwoman',
    'librarian',
    'investigator',
    'chef',
    'empath',
    'fortune_teller',
    'undertaker',
    'ravenkeeper',
  ]);
}
