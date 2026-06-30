import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { InvitePage } from '../pages/InvitePage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import api from '../services/api';

const renderInvitePage = () =>
  render(
    <MemoryRouter>
      <InvitePage />
    </MemoryRouter>
  );

describe('InvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the join form', () => {
    renderInvitePage();

    expect(screen.getByLabelText('Invite Code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('navigates back on cancel', async () => {
    renderInvitePage();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
  });

  it('joins successfully and navigates to workspace', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { workspace: { _id: 'ws123' } },
    });

    renderInvitePage();

    await userEvent.type(screen.getByLabelText('Invite Code'), 'ABC12345');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(api.post).toHaveBeenCalledWith('/workspaces/join', { inviteCode: 'ABC12345' });

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces/ws123');
    });
  });

  it('shows error on failed join', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'Invalid invite code' } },
    });

    renderInvitePage();

    await userEvent.type(screen.getByLabelText('Invite Code'), 'WRONG');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('Invalid invite code')).toBeInTheDocument();
  });

  it('shows generic error when no response message', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

    renderInvitePage();

    await userEvent.type(screen.getByLabelText('Invite Code'), 'CODE123');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(await screen.findByText('Failed to join workspace')).toBeInTheDocument();
  });
});
