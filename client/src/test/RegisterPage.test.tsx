import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../pages/RegisterPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const registerFn = vi.fn();

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    register: registerFn,
    fetchUser: vi.fn(),
    user: null,
    isLoading: false,
    isAuthenticated: false,
  }),
}));

const renderRegisterPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerFn.mockResolvedValue(undefined);
  });

  it('renders the registration form', () => {
    renderRegisterPage();

    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('has a link to the login page', () => {
    renderRegisterPage();

    const link = screen.getByRole('link', { name: 'Sign In' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('shows client-side validation for short password', async () => {
    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(registerFn).not.toHaveBeenCalled();
  });

  it('shows error message on failed registration', async () => {
    registerFn.mockRejectedValueOnce(new Error('Email already registered'));

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'dup@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
  });

  it('calls register and navigates on success', async () => {
    registerFn.mockResolvedValueOnce(undefined);

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(registerFn).toHaveBeenCalledWith('Test User', 'test@example.com', 'password123');

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
    });
  });

  it('clears error on resubmit', async () => {
    registerFn
      .mockRejectedValueOnce(new Error('Email already registered'))
      .mockResolvedValueOnce(undefined);

    renderRegisterPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Test User');
    await userEvent.type(screen.getByLabelText('Email'), 'dup@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'New User');
    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    expect(screen.queryByText('Email already registered')).not.toBeInTheDocument();
  });
});
