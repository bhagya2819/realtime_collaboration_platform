import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const eventMapRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      eventMapRef.current.forEach((callbacks, event) => {
        callbacks.forEach((cb) => socket.on(event, cb));
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const subscribe = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!eventMapRef.current.has(event)) {
      eventMapRef.current.set(event, new Set());
    }
    eventMapRef.current.get(event)!.add(callback);

    socketRef.current?.on(event, callback);

    return () => {
      socketRef.current?.off(event, callback);
      eventMapRef.current.get(event)?.delete(callback);
    };
  }, []);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  const isConnected = useCallback(() => !!socketRef.current?.connected, []);

  return { socket: socketRef, subscribe, emit, isConnected };
};
