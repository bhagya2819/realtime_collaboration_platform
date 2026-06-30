import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../components/notifications/ToastContainer';
import { useToastStore } from '../stores/toastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a toast with message and dismiss button', () => {
    act(() => {
      useToastStore.getState().pushToast({ message: 'New notification', type: 'mention' });
    });

    render(<ToastContainer />);

    expect(screen.getByText('New notification')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '×' })).toBeInTheDocument();
  });

  it('dismisses toast on button click', async () => {
    act(() => {
      useToastStore.getState().pushToast({ message: 'Removable', type: 'comment' });
    });

    render(<ToastContainer />);

    await userEvent.click(screen.getByRole('button', { name: '×' }));

    expect(screen.queryByText('Removable')).not.toBeInTheDocument();
  });

  it('renders multiple toasts', () => {
    act(() => {
      useToastStore.getState().pushToast({ message: 'Toast 1', type: 'mention' });
      useToastStore.getState().pushToast({ message: 'Toast 2', type: 'invite' });
    });

    render(<ToastContainer />);

    expect(screen.getByText('Toast 1')).toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
  });
});
