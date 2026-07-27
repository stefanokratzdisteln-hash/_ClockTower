import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { AiSuggestion, GameState } from '@clocktower/shared';

export type PersistedSession =
  | { role: 'storyteller'; tokenHash: string }
  | { role: 'player'; tokenHash: string; playerId: string };

export type PersistedRoom = {
  state: GameState;
  sessions: PersistedSession[];
  suggestions: AiSuggestion[];
  undoStack: GameState[];
  redoStack: GameState[];
  processedRequests: Array<[string, number]>;
};

export interface RoomRepository {
  load(roomId: string): PersistedRoom | undefined;
  save(room: PersistedRoom): void;
  close(): void;
}

export class SqliteRoomRepository implements RoomRepository {
  private readonly database: DatabaseSync;

  constructor(path = resolve('data', 'clocktower.sqlite')) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  load(roomId: string): PersistedRoom | undefined {
    const row = this.database
      .prepare('SELECT payload FROM rooms WHERE id = ?')
      .get(roomId) as { payload: string } | undefined;
    if (!row) return undefined;
    return JSON.parse(row.payload) as PersistedRoom;
  }

  save(room: PersistedRoom): void {
    this.database
      .prepare(
        `INSERT INTO rooms (id, payload, version, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           version = excluded.version,
           updated_at = excluded.updated_at`,
      )
      .run(
        room.state.id,
        JSON.stringify(room),
        room.state.version,
        room.state.updatedAt,
      );
  }

  close(): void {
    this.database.close();
  }
}
