import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlayerView } from '@clocktower/rules-engine';
import type {
  AiSuggestion,
  ClientMessage,
  CreateRoomResponse,
  GameState,
  GameExport,
  JoinRoomResponse,
  PlayerCommand,
  ServerMessage,
  StorytellerCommand,
} from '@clocktower/shared';

type Role = 'storyteller' | 'player';
type ConnectionStatus = 'offline' | 'connecting' | 'online' | 'reconnecting';

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  '';

function websocketUrl(roomId: string, token: string) {
  const base = API_BASE || window.location.origin;
  const url = new URL(`/ws/${encodeURIComponent(roomId)}`, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? '请求失败');
  return payload;
}

export function useRoomConnection() {
  const [role, setRole] = useState<Role>();
  const [roomId, setRoomId] = useState('');
  const [token, setToken] = useState('');
  const [game, setGame] = useState<GameState>();
  const [playerView, setPlayerView] = useState<PlayerView>();
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('offline');
  const [error, setError] = useState('');
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const retryRef = useRef<number | undefined>(undefined);
  const shouldReconnect = useRef(true);

  const disconnect = useCallback(
    (forget = false) => {
      shouldReconnect.current = false;
      window.clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = undefined;
      setStatus('offline');
      setGame(undefined);
      setPlayerView(undefined);
      setSuggestions([]);
      setOnlinePlayerIds([]);
      if (forget && role && roomId)
        localStorage.removeItem(`clocktower:${role}:${roomId}`);
      if (forget) {
        setRole(undefined);
        setRoomId('');
        setToken('');
      }
    },
    [role, roomId],
  );

  const connect = useCallback(
    (nextRole: Role, nextRoomId: string, nextToken: string) => {
      shouldReconnect.current = true;
      setRole(nextRole);
      setRoomId(nextRoomId);
      setToken(nextToken);
      setStatus(socketRef.current ? 'reconnecting' : 'connecting');
      socketRef.current?.close();

      const socket = new WebSocket(websocketUrl(nextRoomId, nextToken));
      socketRef.current = socket;
      socket.onopen = () => {
        setStatus('online');
        setError('');
        localStorage.setItem(
          `clocktower:${nextRole}:${nextRoomId}`,
          JSON.stringify({
            role: nextRole,
            roomId: nextRoomId,
            token: nextToken,
          }),
        );
      };
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.type === 'ERROR') {
          setError(message.message);
          return;
        }
        if (message.type !== 'SNAPSHOT') return;
        if (message.payload.kind === 'storyteller') {
          setGame(message.payload.state);
          setSuggestions(message.payload.suggestions);
          setOnlinePlayerIds(message.payload.onlinePlayerIds ?? []);
        } else {
          setPlayerView(message.payload.view as PlayerView);
        }
      };
      socket.onclose = (event) => {
        if (!shouldReconnect.current) return;
        if (event.code === 1008) {
          setStatus('offline');
          setError('会话已失效，请重新加入。');
          return;
        }
        setStatus('reconnecting');
        retryRef.current = window.setTimeout(
          () => connect(nextRole, nextRoomId, nextToken),
          800,
        );
      };
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const routeRoom = params.get('room')?.toUpperCase();
    const routeRole: Role =
      params.get('player') === '1' ? 'player' : 'storyteller';
    if (!routeRoom) return;
    const saved = localStorage.getItem(`clocktower:${routeRole}:${routeRoom}`);
    if (saved) {
      const session = JSON.parse(saved) as { token: string };
      connect(routeRole, routeRoom, session.token);
    } else if (routeRole === 'player') {
      setRole('player');
      setRoomId(routeRoom);
    }
    return () => {
      shouldReconnect.current = false;
      window.clearTimeout(retryRef.current);
      socketRef.current?.close();
    };
  }, [connect]);

  const create = useCallback(
    async (requestedRoomId: string) => {
      setError('');
      const session = await post<CreateRoomResponse>('/api/rooms', {
        roomId: requestedRoomId,
      });
      window.history.replaceState(
        {},
        '',
        `?room=${encodeURIComponent(session.roomId)}`,
      );
      connect('storyteller', session.roomId, session.token);
    },
    [connect],
  );

  const join = useCallback(
    async (requestedRoomId: string, name: string) => {
      setError('');
      const session = await post<JoinRoomResponse>(
        `/api/rooms/${encodeURIComponent(requestedRoomId)}/join`,
        { name },
      );
      window.history.replaceState(
        {},
        '',
        `?room=${encodeURIComponent(session.roomId)}&player=1`,
      );
      connect('player', session.roomId, session.token);
    },
    [connect],
  );

  const send = useCallback(
    (command: StorytellerCommand | PlayerCommand) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        setError('连接尚未恢复，请稍后再试。');
        return;
      }
      const message: ClientMessage = {
        type: 'COMMAND',
        requestId: crypto.randomUUID(),
        ...(role === 'storyteller' && game
          ? { expectedVersion: game.version }
          : {}),
        command,
      };
      socket.send(JSON.stringify(message));
    },
    [game, role],
  );

  const exportGame = useCallback(async () => {
    if (!roomId || !token) throw new Error('说书人会话尚未建立。');
    const response = await fetch(
      `${API_BASE}/api/rooms/${encodeURIComponent(roomId)}/export?token=${encodeURIComponent(token)}`,
    );
    const payload = (await response.json()) as GameExport & {
      message?: string;
    };
    if (!response.ok) throw new Error(payload.message ?? '导出失败');
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${roomId}-clocktower.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [roomId, token]);

  const importGame = useCallback(
    async (data: GameExport) => {
      if (!roomId || !token) throw new Error('说书人会话尚未建立。');
      await post(
        `/api/rooms/${encodeURIComponent(roomId)}/import?token=${encodeURIComponent(token)}`,
        data,
      );
    },
    [roomId, token],
  );

  return {
    role,
    roomId,
    token,
    game,
    playerView,
    suggestions,
    onlinePlayerIds,
    status,
    error,
    setError,
    create,
    join,
    send,
    exportGame,
    importGame,
    disconnect,
  };
}
