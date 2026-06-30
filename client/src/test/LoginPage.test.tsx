import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const loginFn = vi.fn();
const logoutFn = vi.fn();
const fetchUserFn = vi.fn();

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    login: loginFn,
    logout: logoutFn,
    register: vi.fn(),
    fetchUser: fetchUserFn,
    user: null,
    isLoading: false,
    isAuthenticated: false,
  }),
}));

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginFn.mockResolvedValue(undefined);
  });

  it('renders the login form', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('has a link to the register page', () => {
    renderLoginPage();

    const link = screen.getByRole('link', { name: 'Register' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/register');
  });

  it('shows error message on failed login', async () => {
    loginFn.mockRejectedValueOnce(new Error('Invalid email or password'));

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    const error = await screen.findByText('Invalid email or password');
    expect(error).toBeInTheDocument();
  });

  it('calls login and navigates on success', async () => {
    loginFn.mockResolvedValueOnce(undefined);

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(loginFn).toHaveBeenCalledWith('test@example.com', 'password123');

    await vi.waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/workspaces');
    });
  });

  it('clears error on resubmit', async () => {
    loginFn
      .mockRejectedValueOnce(new Error('Invalid email or password'))
      .mockResolvedValueOnce(undefined);

    renderLoginPage();

    await userEvent.type(screen.getByLabelText('Email'), 'bad@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'good@example.com');
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
  });
});
