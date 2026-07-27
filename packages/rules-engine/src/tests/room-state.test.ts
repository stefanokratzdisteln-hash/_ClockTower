import { describe, expect, it } from 'vitest';

import {
  InvalidRoomCommandError,
  addPlayer,
  changePlayerName,
  createRoom,
  replayRoomEvents,
  setPlayerExperience,
  setPlayerSeatOrder,
} from '../rooms/room-state.js';

const createdAt = '2026-07-27T00:00:00.000Z';

function populatedRoom() {
  const room = createRoom(
    { id: 'room-1', scriptId: 'trouble-brewing' },
    { occurredAt: createdAt, eventId: 'event-1' },
  );
  const withAlice = addPlayer(
    room,
    { id: 'alice', name: 'Alice', experience: 'regular' },
    { occurredAt: '2026-07-27T00:01:00.000Z', eventId: 'event-2' },
  );
  return addPlayer(
    withAlice,
    { id: 'bob', name: 'Bob' },
    { occurredAt: '2026-07-27T00:02:00.000Z', eventId: 'event-3' },
  );
}

describe('room player state', () => {
  it('creates a room and adds players at consecutive seats', () => {
    const state = populatedRoom();

    expect(state.players).toEqual([
      {
        id: 'alice',
        name: 'Alice',
        seatIndex: 0,
        experience: 'regular',
      },
      { id: 'bob', name: 'Bob', seatIndex: 1, experience: 'new' },
    ]);
    expect(state.spectators).toEqual([]);
    expect(state.events.map(({ type }) => type)).toEqual([
      'ROOM_CREATED',
      'PLAYER_ADDED',
      'PLAYER_ADDED',
    ]);
    expect(state.version).toBe(3);
  });

  it('changes player data and records exactly one event per change', () => {
    const initial = populatedRoom();
    const renamed = changePlayerName(initial, 'bob', 'Robert', {
      occurredAt: '2026-07-27T00:03:00.000Z',
      eventId: 'event-4',
    });
    const experienced = setPlayerExperience(renamed, 'bob', 'expert', {
      occurredAt: '2026-07-27T00:04:00.000Z',
      eventId: 'event-5',
    });

    expect(initial.players[1]?.name).toBe('Bob');
    expect(experienced.players[1]).toMatchObject({
      name: 'Robert',
      experience: 'expert',
    });
    expect(experienced.events.slice(-2).map(({ type }) => type)).toEqual([
      'PLAYER_NAME_CHANGED',
      'PLAYER_EXPERIENCE_CHANGED',
    ]);
    expect(experienced.events.map(({ sequence }) => sequence)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('sets the complete seat order without mutating the old state', () => {
    const initial = populatedRoom();
    const reordered = setPlayerSeatOrder(initial, ['bob', 'alice'], {
      occurredAt: '2026-07-27T00:03:00.000Z',
      eventId: 'event-4',
    });

    expect(initial.players.map(({ id, seatIndex }) => [id, seatIndex])).toEqual(
      [
        ['alice', 0],
        ['bob', 1],
      ],
    );
    expect(
      reordered.players.map(({ id, seatIndex }) => [id, seatIndex]),
    ).toEqual([
      ['bob', 0],
      ['alice', 1],
    ]);
    expect(reordered.events.at(-1)).toMatchObject({
      type: 'PLAYER_SEATS_SET',
      playerIds: ['bob', 'alice'],
      sequence: 4,
    });
  });

  it('rejects incomplete, duplicate, or unknown seat orders', () => {
    const state = populatedRoom();

    for (const order of [['alice'], ['alice', 'alice'], ['alice', 'charlie']]) {
      expect(() => setPlayerSeatOrder(state, order)).toThrow(
        InvalidRoomCommandError,
      );
    }
    expect(state.events).toHaveLength(3);
  });

  it('replays the event stream to an identical state', () => {
    const populated = populatedRoom();
    const renamed = changePlayerName(populated, 'alice', 'Alicia', {
      occurredAt: '2026-07-27T00:03:00.000Z',
      eventId: 'event-4',
    });
    const experienced = setPlayerExperience(renamed, 'bob', 'expert', {
      occurredAt: '2026-07-27T00:04:00.000Z',
      eventId: 'event-5',
    });
    const final = setPlayerSeatOrder(experienced, ['bob', 'alice'], {
      occurredAt: '2026-07-27T00:05:00.000Z',
      eventId: 'event-6',
    });

    expect(replayRoomEvents(final.events)).toEqual(final);
  });
});
