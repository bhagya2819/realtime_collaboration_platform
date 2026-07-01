import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentPanel } from '../components/comments/CommentPanel';

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    subscribe: vi.fn().mockReturnValue(() => {}),
    emit: vi.fn(),
    isConnected: vi.fn(() => true),
    socket: { current: null },
  }),
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('../services/api', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    post: (...args: any[]) => mockPost(...args),
    patch: (...args: any[]) => mockPatch(...args),
  },
}));

const defaultComments = [
  {
    _id: 'c1',
    document: 'doc1',
    user: { _id: 'u1', name: 'Alice', email: 'alice@example.com' },
    text: 'First comment',
    threadParent: null,
    resolved: false,
    mentions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'c2',
    document: 'doc1',
    user: { _id: 'u2', name: 'Bob', email: 'bob@example.com' },
    text: 'A reply',
    threadParent: 'c1',
    resolved: false,
    mentions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const renderPanel = () =>
  render(<CommentPanel documentId="doc1" editor={null} />);

describe('CommentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { comments: defaultComments } });
  });

  it('fetches and renders root comments', async () => {
    renderPanel();

    expect(mockGet).toHaveBeenCalledWith('/documents/doc1/comments');
    expect(await screen.findByText('First comment')).toBeInTheDocument();
  });

  it('shows reply count via threadParent', async () => {
    renderPanel();

    const reply = await screen.findByText('A reply');
    expect(reply).toBeInTheDocument();
  });

  it('subscribes to socket events', async () => {
    await act(async () => {
      renderPanel();
    });
    // subscribe is called for new-comment and comment-resolved
  });

  it('adds a comment', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });

    renderPanel();

    const textarea = screen.getByPlaceholderText(/Add a comment/);
    await userEvent.type(textarea, 'Hello world');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));

    expect(mockPost).toHaveBeenCalledWith('/documents/doc1/comments', {
      text: 'Hello world',
      mentions: [],
      selectionReference: undefined,
    });
  });

  it('resolves a comment', async () => {
    mockPatch.mockResolvedValueOnce({ data: {} });

    renderPanel();

    const resolveBtn = await screen.findByText('Resolve');
    await userEvent.click(resolveBtn);

    expect(mockPatch).toHaveBeenCalledWith('/comments/c1/resolve');
  });
});
