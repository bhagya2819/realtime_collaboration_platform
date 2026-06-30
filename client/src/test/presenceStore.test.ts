import { describe, it, expect, beforeEach } from 'vitest';
import { usePresenceStore } from '../stores/presenceStore';

describe('usePresenceStore', () => {
  beforeEach(() => {
    usePresenceStore.setState({ users: {}, typingUserIds: {} });
  });

  describe('setUsers', () => {
    it('sets users for a document', () => {
      const users = [
        { socketId: 's1', userId: 'u1', name: 'Alice', typing: false },
        { socketId: 's2', userId: 'u2', name: 'Bob', typing: false },
      ];

      usePresenceStore.getState().setUsers('doc1', users);

      expect(usePresenceStore.getState().users['doc1']).toEqual(users);
    });

    it('overwrites existing users for a document', () => {
      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's1', userId: 'u1', typing: false },
      ]);

      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's3', userId: 'u3', typing: false },
      ]);

      expect(usePresenceStore.getState().users['doc1']).toHaveLength(1);
      expect(usePresenceStore.getState().users['doc1'][0].userId).toBe('u3');
    });
  });

  describe('addUser', () => {
    it('adds a user to an existing document', () => {
      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's1', userId: 'u1', typing: false },
      ]);

      usePresenceStore.getState().addUser('doc1', {
        socketId: 's2', userId: 'u2', typing: false,
      });

      expect(usePresenceStore.getState().users['doc1']).toHaveLength(2);
    });

    it('adds a user to a new document', () => {
      usePresenceStore.getState().addUser('doc2', {
        socketId: 's1', userId: 'u1', typing: false,
      });

      expect(usePresenceStore.getState().users['doc2']).toHaveLength(1);
    });
  });

  describe('removeUser', () => {
    it('removes a user by socketId', () => {
      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's1', userId: 'u1', typing: false },
        { socketId: 's2', userId: 'u2', typing: false },
      ]);

      usePresenceStore.getState().removeUser('doc1', 's1');

      expect(usePresenceStore.getState().users['doc1']).toHaveLength(1);
      expect(usePresenceStore.getState().users['doc1'][0].socketId).toBe('s2');
    });

    it('handles non-existent document', () => {
      usePresenceStore.getState().removeUser('nonexistent', 's1');
      expect(usePresenceStore.getState().users['nonexistent']).toEqual([]);
    });
  });

  describe('updateCursor', () => {
    it('updates cursor position for a user', () => {
      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's1', userId: 'u1', typing: false },
      ]);

      usePresenceStore.getState().updateCursor('doc1', 's1', { position: 42 });

      expect(usePresenceStore.getState().users['doc1'][0].cursor).toEqual({ position: 42 });
    });

    it('preserves other user fields when updating cursor', () => {
      usePresenceStore.getState().setUsers('doc1', [
        { socketId: 's1', userId: 'u1', name: 'Alice', typing: false },
      ]);

      usePresenceStore.getState().updateCursor('doc1', 's1', { position: 10, selection: { head: 9 } });

      const user = usePresenceStore.getState().users['doc1'][0];
      expect(user.name).toBe('Alice');
      expect(user.cursor).toEqual({ position: 10, selection: { head: 9 } });
    });
  });

  describe('setTypingUsers', () => {
    it('sets typing user IDs for a document', () => {
      usePresenceStore.getState().setTypingUsers('doc1', ['u1', 'u2']);

      expect(usePresenceStore.getState().typingUserIds['doc1']).toEqual(['u1', 'u2']);
    });

    it('clears typing users', () => {
      usePresenceStore.getState().setTypingUsers('doc1', ['u1']);
      usePresenceStore.getState().setTypingUsers('doc1', []);

      expect(usePresenceStore.getState().typingUserIds['doc1']).toEqual([]);
    });
  });
});
