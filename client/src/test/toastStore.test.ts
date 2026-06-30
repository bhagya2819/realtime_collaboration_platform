import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../stores/toastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('starts with empty toasts array', () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('pushes a toast and auto-generates an id', () => {
    useToastStore.getState().pushToast({ message: 'Hello', type: 'mention' });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Hello');
    expect(toasts[0].type).toBe('mention');
    expect(toasts[0].id).toMatch(/^toast-/);
  });

  it('increments toast id for each push', () => {
    useToastStore.getState().pushToast({ message: 'First', type: 'comment' });
    useToastStore.getState().pushToast({ message: 'Second', type: 'invite' });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('removes a toast by id', () => {
    useToastStore.getState().pushToast({ message: 'Keep', type: 'share' });
    useToastStore.getState().pushToast({ message: 'Remove', type: 'mention' });

    const toasts = useToastStore.getState().toasts;
    useToastStore.getState().removeToast(toasts[1].id);

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Keep');
  });

  it('persists id and targetId fields', () => {
    useToastStore.getState().pushToast({
      message: 'Test',
      type: 'comment',
      targetId: 'doc123',
    });

    const toast = useToastStore.getState().toasts[0];
    expect(toast.targetId).toBe('doc123');
  });
});
