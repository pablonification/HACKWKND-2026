import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiHelperPage } from './AiHelperPage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../assets/tavi.png', () => ({ default: 'tavi.png' }));
vi.mock('../../assets/camera.png', () => ({ default: 'camera.png' }));
vi.mock('../../assets/mic.png', () => ({ default: 'mic.png' }));
vi.mock('../../assets/spark.png', () => ({ default: 'spark.png' }));

vi.mock('../lib/feedback', () => ({
  triggerHapticFeedback: vi.fn(),
}));

vi.mock('../lib/storage', () => ({
  setBoolean: vi.fn().mockResolvedValue(undefined),
  getBoolean: vi.fn().mockResolvedValue(false),
}));

vi.mock('../utils/authErrors', () => ({
  toAuthErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'An error occurred'),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            email: 'tuyang@example.com',
            user_metadata: { full_name: 'Tuyang' },
          },
        },
      }),
    },
  },
}));

// Ionic components — minimal stubs so jsdom doesn't choke
vi.mock('@ionic/react', () => ({
  IonSpinner: () => <span data-testid="ion-spinner" />,
  IonToast: ({ isOpen, message }: { isOpen: boolean; message: string }) =>
    isOpen ? <div role="alert">{message}</div> : null,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the page and skip past the intro screen by clicking the input bar. */
async function renderChat() {
  render(<AiHelperPage />);

  // The intro shows an input bar — clicking it transitions to chat
  const input = await screen.findByPlaceholderText(/write your message here/i);
  await act(async () => {
    fireEvent.click(input);
  });

  // Wait for chat shell to appear
  await screen.findByRole('button', { name: /send message/i });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AiHelperPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // ── Intro screen ────────────────────────────────────────────────────────

  describe('Intro screen', () => {
    it('renders the intro screen on first visit', async () => {
      render(<AiHelperPage />);
      expect(await screen.findByText(/meet/i)).toBeInTheDocument();
      expect(screen.getByText('Tavi')).toBeInTheDocument();
    });

    it('shows the "Personal AI Buddy" pill on the intro', async () => {
      render(<AiHelperPage />);
      expect(await screen.findByText(/personal ai buddy/i)).toBeInTheDocument();
    });

    it('shows the message input placeholder on the intro', async () => {
      render(<AiHelperPage />);
      expect(await screen.findByPlaceholderText(/write your message here/i)).toBeInTheDocument();
    });

    it('transitions to chat when the input bar is clicked', async () => {
      render(<AiHelperPage />);
      const input = await screen.findByPlaceholderText(/write your message here/i);
      await act(async () => {
        fireEvent.click(input);
      });
      expect(await screen.findByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('calls setBoolean to persist intro-seen when input bar is clicked', async () => {
      const { setBoolean } = await import('../lib/storage');
      render(<AiHelperPage />);
      const input = await screen.findByPlaceholderText(/write your message here/i);
      await act(async () => {
        fireEvent.click(input);
      });
      expect(setBoolean).toHaveBeenCalledWith('tavi-intro-seen', true);
    });
  });

  // ── Listening screen ────────────────────────────────────────────────────

  describe('Listening screen', () => {
    it('shows the listening screen when the mic button on the intro is tapped', async () => {
      render(<AiHelperPage />);
      const micBtn = await screen.findByRole('button', { name: /start listening/i });
      await act(async () => {
        fireEvent.click(micBtn);
      });
      expect(await screen.findByText(/listening\.\.\./i)).toBeInTheDocument();
    });

    it('shows "Tell Tavi" text on the listening screen', async () => {
      render(<AiHelperPage />);
      const micBtn = await screen.findByRole('button', { name: /start listening/i });
      await act(async () => {
        fireEvent.click(micBtn);
      });
      expect(await screen.findByText(/tell/i)).toBeInTheDocument();
    });

    it('back button on listening screen returns to intro', async () => {
      render(<AiHelperPage />);
      const micBtn = await screen.findByRole('button', { name: /start listening/i });
      await act(async () => {
        fireEvent.click(micBtn);
      });
      await screen.findByText(/listening\.\.\./i);
      const backBtn = screen.getByRole('button', { name: /go back/i });
      await act(async () => {
        fireEvent.click(backBtn);
      });
      expect(await screen.findByText(/meet/i)).toBeInTheDocument();
    });

    it('tapping the mic button on the listening screen goes to chat', async () => {
      render(<AiHelperPage />);
      const micBtn = await screen.findByRole('button', { name: /start listening/i });
      await act(async () => {
        fireEvent.click(micBtn);
      });
      const sendBtn = await screen.findByRole('button', { name: /done listening/i });
      await act(async () => {
        fireEvent.click(sendBtn);
      });
      expect(await screen.findByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('triggers medium haptic when mic is tapped on the intro', async () => {
      const { triggerHapticFeedback } = await import('../lib/feedback');
      render(<AiHelperPage />);
      const micBtn = await screen.findByRole('button', { name: /start listening/i });
      await act(async () => {
        fireEvent.click(micBtn);
      });
      expect(triggerHapticFeedback).toHaveBeenCalledWith('medium');
    });
  });

  // ── Chat shell ──────────────────────────────────────────────────────────

  describe('Chat shell', () => {
    it('renders the textarea input', async () => {
      await renderChat();
      expect(screen.getByPlaceholderText(/write your message here/i)).toBeInTheDocument();
    });

    it('renders the send button', async () => {
      await renderChat();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('send button is disabled when input is empty', async () => {
      await renderChat();
      const sendBtn = screen.getByRole('button', { name: /send message/i });
      expect(sendBtn).toBeDisabled();
    });

    it('send button is enabled when input has text', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);
      await userEvent.type(textarea, 'Bobolian');
      expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
    });

    it('shows greeting when no messages exist', async () => {
      await renderChat();
      expect(screen.getByText(/hello/i)).toBeInTheDocument();
    });

    it('shows the user name in the greeting', async () => {
      await renderChat();
      // The mock returns full_name: 'Tuyang'
      expect(await screen.findByText(/tuyang/i)).toBeInTheDocument();
    });

    it('hides greeting after first message is sent', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Hello Tavi');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      await waitFor(() => {
        expect(screen.queryByText(/hello,/i)).not.toBeInTheDocument();
      });
    });
  });

  // ── Sending messages ────────────────────────────────────────────────────

  describe('Sending a message', () => {
    it('shows the user bubble immediately after sending', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      expect(await screen.findByText('Bobolian')).toBeInTheDocument();
    });

    it('clears the textarea after sending', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Hello');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      expect(textarea).toHaveValue('');
    });

    it('shows a spinner in the send button while a message is in flight', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      expect(screen.getByTestId('ion-spinner')).toBeInTheDocument();
    });

    it('shows the Tavi reply bubble after the fake delay', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      const matches = await screen.findAllByText('Bobolian');
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('shows a Translation bubble after reply arrives', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      expect(await screen.findByText(/translation:/i)).toBeInTheDocument();
    });

    it('send button is disabled while a message is in flight', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
    });

    it('re-enables send button after reply arrives', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      await userEvent.type(textarea, 'X');
      expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
    });
  });

  // ── Keyboard shortcut ───────────────────────────────────────────────────

  describe('Keyboard shortcut', () => {
    it('sends the message on Enter (without Shift)', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(await screen.findByText('Bobolian')).toBeInTheDocument();
      expect(textarea).toHaveValue('');
    });

    it('does NOT send on Shift+Enter', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Hello');
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(textarea).toHaveValue('Hello');
      expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
    });
  });

  // ── Back button ─────────────────────────────────────────────────────────

  describe('Back button', () => {
    it('pressing back in chat returns to the intro screen', async () => {
      await renderChat();

      const backBtn = screen.getByRole('button', { name: /go back/i });
      fireEvent.click(backBtn);

      expect(await screen.findByText(/meet/i)).toBeInTheDocument();
    });
  });

  // ── Haptic feedback ─────────────────────────────────────────────────────

  describe('Haptic feedback', () => {
    it('triggers light haptic when send is tapped', async () => {
      const { triggerHapticFeedback } = await import('../lib/feedback');
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      expect(triggerHapticFeedback).toHaveBeenCalledWith('light');
    });

    it('triggers success haptic after reply arrives', async () => {
      const { triggerHapticFeedback } = await import('../lib/feedback');
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      await waitFor(() => {
        expect(triggerHapticFeedback).toHaveBeenCalledWith('success');
      });
    });

    it('triggers medium haptic when input bar is clicked on intro', async () => {
      const { triggerHapticFeedback } = await import('../lib/feedback');
      render(<AiHelperPage />);

      const input = await screen.findByPlaceholderText(/write your message here/i);
      await act(async () => {
        fireEvent.click(input);
      });

      expect(triggerHapticFeedback).toHaveBeenCalledWith('medium');
    });
  });
});

vi.mock('../lib/feedback', () => ({
  triggerHapticFeedback: vi.fn(),
}));

vi.mock('../lib/storage', () => ({
  setBoolean: vi.fn().mockResolvedValue(undefined),
  getBoolean: vi.fn().mockResolvedValue(false),
}));

vi.mock('../utils/authErrors', () => ({
  toAuthErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'An error occurred'),
}));
