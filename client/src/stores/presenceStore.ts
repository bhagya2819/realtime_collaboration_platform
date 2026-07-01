import { create } from 'zustand';

interface RemoteUser {
  socketId: string;
  userId: string;
  name?: string;
  avatarUrl?: string;
  cursor?: { position: number; selection?: any };
  typing: boolean;
}

interface TypingUser {
  userId: string;
  name: string;
}

interface PresenceState {
  users: Record<string, RemoteUser[]>;
  typingUsers: Record<string, TypingUser[]>;
  setUsers: (documentId: string, users: RemoteUser[]) => void;
  addUser: (documentId: string, user: RemoteUser) => void;
  removeUser: (documentId: string, socketId: string) => void;
  updateCursor: (documentId: string, socketId: string, cursor: { position: number; selection?: any }) => void;
  setTypingUsers: (documentId: string, typingUsers: TypingUser[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  users: {},
  typingUsers: {},

  setUsers: (documentId, users) =>
    set((s) => ({ users: { ...s.users, [documentId]: users } })),

  addUser: (documentId, user) =>
    set((s) => ({
      users: {
        ...s.users,
        [documentId]: [...(s.users[documentId] || []), user],
      },
    })),

  removeUser: (documentId, socketId) =>
    set((s) => ({
      users: {
        ...s.users,
        [documentId]: (s.users[documentId] || []).filter((u) => u.socketId !== socketId),
      },
    })),

  updateCursor: (documentId, socketId, cursor) =>
    set((s) => ({
      users: {
        ...s.users,
        [documentId]: (s.users[documentId] || []).map((u) =>
          u.socketId === socketId ? { ...u, cursor } : u
        ),
      },
    })),

  setTypingUsers: (documentId, typingUsers) =>
    set((s) => ({
      typingUsers: { ...s.typingUsers, [documentId]: typingUsers },
    })),
}));
