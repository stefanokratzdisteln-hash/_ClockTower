import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';

import type { ClientMessage, GameExport } from '@clocktower/shared';

import { ReadOnlyAiService } from './ai/ai-service.js';
import { RoomService, RoomServiceError } from './rooms/room-service.js';
import { SqliteRoomRepository } from './rooms/room-repository.js';

export async function buildApp(roomService = new RoomService()) {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(websocket);
  app.addHook('onClose', async () => roomService.close());

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: { roomId?: string } }>(
    '/api/rooms',
    async (request, reply) => {
      try {
        return roomService.create(request.body?.roomId ?? '');
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{ Params: { roomId: string }; Body: { name?: string } }>(
    '/api/rooms/:roomId/join',
    async (request, reply) => {
      try {
        return roomService.join(
          request.params.roomId,
          request.body?.name ?? '',
        );
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.delete<{
    Params: { roomId: string };
    Querystring: { token?: string };
  }>('/api/rooms/:roomId', async (request, reply) => {
    try {
      roomService.release(request.params.roomId, request.query.token ?? '');
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.post<{
    Params: { roomId: string };
    Querystring: { token?: string };
    Body: ClientMessage;
  }>('/api/rooms/:roomId/command', async (request, reply) => {
    try {
      const token = request.query.token ?? '';
      const message = request.body;
      if (
        message?.type !== 'COMMAND' ||
        !message.requestId ||
        !message.command
      ) {
        throw new RoomServiceError('INVALID_MESSAGE', '消息格式无效。');
      }
      roomService.handleMessage(request.params.roomId, token, message);
      return roomService.getSnapshot(request.params.roomId, token);
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { roomId: string }; Querystring: { token?: string } }>(
    '/api/rooms/:roomId/snapshot',
    async (request, reply) => {
      try {
        return roomService.getSnapshot(
          request.params.roomId,
          request.query.token ?? '',
        );
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.get<{ Params: { roomId: string }; Querystring: { token?: string } }>(
    '/api/rooms/:roomId/export',
    async (request, reply) => {
      try {
        return roomService.exportGame(
          request.params.roomId,
          request.query.token ?? '',
        );
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  app.post<{
    Params: { roomId: string };
    Querystring: { token?: string };
    Body: GameExport;
  }>('/api/rooms/:roomId/import', async (request, reply) => {
    try {
      roomService.importGame(
        request.params.roomId,
        request.query.token ?? '',
        request.body,
      );
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.get<{ Params: { roomId: string }; Querystring: { token?: string } }>(
    '/ws/:roomId',
    { websocket: true },
    (socket, request) => {
      const token = request.query.token ?? '';
      let disconnect: (() => void) | undefined;
      try {
        disconnect = roomService.connect(request.params.roomId, token, socket);
      } catch (error) {
        const normalized = normalizeError(error);
        socket.send(JSON.stringify({ type: 'ERROR', ...normalized }));
        socket.close(1008, normalized.message);
        return;
      }

      socket.on('message', (raw: unknown) => {
        let message: ClientMessage | undefined;
        try {
          message = JSON.parse(String(raw)) as ClientMessage;
          if (
            message.type !== 'COMMAND' ||
            !message.requestId ||
            !message.command
          ) {
            throw new RoomServiceError('INVALID_MESSAGE', '消息格式无效。');
          }
          const version = roomService.handleMessage(
            request.params.roomId,
            token,
            message,
          );
          socket.send(
            JSON.stringify({
              type: 'COMMAND_ACCEPTED',
              requestId: message.requestId,
              version,
            }),
          );
        } catch (error) {
          socket.send(
            JSON.stringify({
              type: 'ERROR',
              requestId: message?.requestId,
              ...normalizeError(error),
            }),
          );
        }
      });
      socket.on('close', () => disconnect?.());
    },
  );

  return app;
}

function normalizeError(error: unknown) {
  return error instanceof RoomServiceError
    ? { code: error.code, message: error.message }
    : {
        code: 'COMMAND_REJECTED',
        message: error instanceof Error ? error.message : '操作失败。',
      };
}

function sendError(
  reply: { code(statusCode: number): { send(payload: unknown): unknown } },
  error: unknown,
) {
  const normalized = normalizeError(error);
  const status =
    normalized.code === 'ROOM_NOT_FOUND'
      ? 404
      : normalized.code === 'UNAUTHORIZED'
        ? 401
        : 400;
  return reply.code(status).send(normalized);
}

const isEntryPoint =
  process.argv[1] &&
  new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') ===
    process.argv[1].replaceAll('\\', '/');

async function start() {
  const repository = new SqliteRoomRepository(process.env.CLOCKTOWER_DB_PATH);
  const app = await buildApp(
    new RoomService(new ReadOnlyAiService(), repository),
  );
  const port = Number(process.env.PORT ?? 3000);
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (isEntryPoint) void start();
