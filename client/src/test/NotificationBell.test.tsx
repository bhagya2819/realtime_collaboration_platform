import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from '../components/notifications/NotificationBell';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

const mockSubscribe = vi.fn().mockReturnValue(() => {});

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    subscribe: mockSubscribe,
    emit: vi.fn(),
    isConnected: vi.fn(() => true),
    socket: { current: null },
  }),
}));

const defaultNotifications = [
  {
    _id: 'n1',
    recipient: 'u1',
    actor: { _id: 'u2', name: 'Alice', email: 'alice@example.com' },
    type: 'mention' as const,
    message: 'Alice mentioned you in a comment',
    targetType: 'document',
    targetId: 'doc1',
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    _id: 'n2',
    recipient: 'u1',
    actor: { _id: 'u3', name: 'Bob', email: 'bob@example.com' },
    type: 'comment' as const,
    message: 'Bob commented on your document',
    targetType: 'document',
    targetId: 'doc1',
    isRead: true,
    createdAt: new Date().toISOString(),
  },
];

const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('../services/api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
    post: vi.fn(),
  },
}));

const renderBell = () =>
  render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      data: { notifications: defaultNotifications, unreadCount: 1 },
    });
  });

  it('fetches notifications on mount', async () => {
    renderBell();

    expect(mockGet).toHaveBeenCalledWith('/notifications');

    const bell = await screen.findByRole('button');
    await userEvent.click(bell);

    expect(await screen.findByText('Alice mentioned you in a comment')).toBeInTheDocument();
  });

  it('shows unread badge count', async () => {
    renderBell();

    const badge = await screen.findByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('shows dropdown on click', async () => {
    renderBell();

    const bell = await screen.findByRole('button');
    await userEvent.click(bell);

    expect(screen.getByText('Mark all read')).toBeInTheDocument();
    expect(screen.getByText('Alice mentioned you in a comment')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    mockGet.mockResolvedValueOnce({
      data: { notifications: [], unreadCount: 0 },
    });

    renderBell();

    const bell = await screen.findByRole('button');
    await userEvent.click(bell);

    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });

  it('marks all as read', async () => {
    renderBell();

    const bell = await screen.findByRole('button');
    await userEvent.click(bell);

    const markBtn = await screen.findByText('Mark all read');
    await userEvent.click(markBtn);

    expect(mockPatch).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('subscribes to socket notification events', async () => {
    renderBell();

    expect(mockSubscribe).toHaveBeenCalledWith('notification', expect.any(Function));
  });
});
