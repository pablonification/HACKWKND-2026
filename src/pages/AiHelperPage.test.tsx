import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiHelperPage } from './AiHelperPage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../assets/tavi.png', () => ({ default: 'tavi.png' }));
vi.mock('../../assets/camera.png', () => ({ default: 'camera.png' }));

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

// Ionic components — minimal stubs so jsdom doesn't choke
vi.mock('@ionic/react', () => ({
  IonSpinner: () => <span data-testid="ion-spinner" />,
  IonToast: ({ isOpen, message }: { isOpen: boolean; message: string }) =>
    isOpen ? <div role="alert">{message}</div> : null,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render the page and skip past the intro screen. */
async function renderChat() {
  render(<AiHelperPage />);

  // The intro is shown first — click "Get Started"
  const cta = await screen.findByRole('button', { name: /get started/i });
  await act(async () => {
    fireEvent.click(cta);
  });
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
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    });

    it('shows the "Personal AI Buddy" pill on the intro', async () => {
      render(<AiHelperPage />);
      expect(await screen.findByText(/personal ai buddy/i)).toBeInTheDocument();
    });

    it('transitions to the chat view after clicking Get Started', async () => {
      render(<AiHelperPage />);

      const cta = await screen.findByRole('button', { name: /get started/i });
      await act(async () => {
        fireEvent.click(cta);
      });

      // Chat header pill should now be visible
      expect(await screen.findByPlaceholderText(/write your message/i)).toBeInTheDocument();
    });

    it('calls setBoolean to persist intro-seen when Get Started is clicked', async () => {
      const { setBoolean } = await import('../lib/storage');
      render(<AiHelperPage />);

      const cta = await screen.findByRole('button', { name: /get started/i });
      await act(async () => {
        fireEvent.click(cta);
      });

      expect(setBoolean).toHaveBeenCalledWith('tavi-intro-seen', true);
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

    it('shows a loading bubble while awaiting Tavi reply', async () => {
      await renderChat();
      const textarea = screen.getByPlaceholderText(/write your message here/i);

      await userEvent.type(textarea, 'Bobolian');
      fireEvent.click(screen.getByRole('button', { name: /send message/i }));

      // Loading dots render inside the bubble before the 600ms resolves
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

      // The reply text echoes the input
      const matches = await screen.findAllByText('Bobolian');
      // user bubble + Tavi reply bubble = at least 2 occurrences
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

      // Still within the 600ms fake delay
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

      await waitFor(() => {
        // No text in box → still disabled, but isSending is false.
        // Type something to confirm it's reactive again.
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

      // Value should still be in the textarea, not cleared by a send
      expect(textarea).toHaveValue('Hello');
      // isSending should be false, send button still enabled (has value)
      expect(screen.getByRole('button', { name: /send message/i })).toBeEnabled();
    });
  });

  // ── Back button ─────────────────────────────────────────────────────────

  describe('Back button', () => {
    it('pressing back in chat returns to the intro screen', async () => {
      await renderChat();

      const backBtn = screen.getByRole('button', { name: /go back/i });
      fireEvent.click(backBtn);

      expect(await screen.findByRole('button', { name: /get started/i })).toBeInTheDocument();
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

    it('triggers medium haptic when Get Started is clicked', async () => {
      const { triggerHapticFeedback } = await import('../lib/feedback');
      render(<AiHelperPage />);

      const cta = await screen.findByRole('button', { name: /get started/i });
      await act(async () => {
        fireEvent.click(cta);
      });

      expect(triggerHapticFeedback).toHaveBeenCalledWith('medium');
    });
  });
});
