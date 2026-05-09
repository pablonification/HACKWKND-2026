import type { CoachAnswerLanguage, CoachMode, CoachSessionPhase, LearningTrack } from './aiCoach';
import { supabase } from './supabase';

export type TaviThreadSummary = {
  id: string;
  title: string;
  sessionPhase: CoachSessionPhase;
  track: LearningTrack;
  lastMessageAt: string;
  createdAt: string;
};

export type TaviPersistedMessage = {
  id: string;
  role: 'user' | 'tavi';
  text: string;
  packageEligible: boolean;
  translation: string | null;
  translationLabel: string | null;
  coachNote: string | null;
  followUpPrompt: string | null;
  warning: string | null;
  mode: CoachMode | null;
  answerLanguage: CoachAnswerLanguage | null;
  sessionPhase: CoachSessionPhase | null;
  track: LearningTrack | null;
  createdAt: string;
};

export type TaviMessageInput = {
  id?: string;
  role: 'user' | 'tavi';
  text: string;
  packageEligible?: boolean;
  translation?: string | null;
  translationLabel?: string | null;
  coachNote?: string | null;
  followUpPrompt?: string | null;
  warning?: string | null;
  mode?: CoachMode | null;
  answerLanguage?: CoachAnswerLanguage | null;
  sessionPhase?: CoachSessionPhase | null;
  track?: LearningTrack | null;
};

const THREAD_SELECT = 'id,title,session_phase,track,last_message_at,created_at' as const;
const MESSAGE_SELECT =
  'id,role,text,package_eligible,translation,translation_label,coach_note,follow_up_prompt,warning,mode,answer_language,session_phase,track,created_at' as const;

export const isTaviPersistenceUnavailable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /tavi_threads|tavi_messages|schema cache|does not exist|could not find the table/i.test(
    message,
  );
};

const toSessionPhase = (value: string | null): CoachSessionPhase => {
  if (value === 'idle' || value === 'onboarding' || value === 'learning_active') {
    return value;
  }

  return 'idle';
};

const toLearningTrack = (value: string | null): LearningTrack => {
  if (value === 'vocabulary_first' || value === 'daily_conversation' || value === 'pronunciation') {
    return value;
  }

  return 'vocabulary_first';
};

const toCoachMode = (value: string | null): CoachMode | null => {
  if (
    value === 'clarification' ||
    value === 'direct_help' ||
    value === 'learning' ||
    value === 'unsupported'
  ) {
    return value;
  }

  return null;
};

const toAnswerLanguage = (value: string | null): CoachAnswerLanguage | null => {
  if (value === 'en' || value === 'ms' || value === 'semai') {
    return value;
  }

  return null;
};

const mapThread = (row: {
  id: string;
  title: string;
  session_phase: string;
  track: string;
  last_message_at: string;
  created_at: string;
}): TaviThreadSummary => ({
  id: row.id,
  title: row.title,
  sessionPhase: toSessionPhase(row.session_phase),
  track: toLearningTrack(row.track),
  lastMessageAt: row.last_message_at,
  createdAt: row.created_at,
});

const mapMessage = (row: {
  id: string;
  role: string;
  text: string;
  package_eligible: boolean;
  translation: string | null;
  translation_label: string | null;
  coach_note: string | null;
  follow_up_prompt: string | null;
  warning: string | null;
  mode: string | null;
  answer_language: string | null;
  session_phase: string | null;
  track: string | null;
  created_at: string;
}): TaviPersistedMessage => ({
  id: row.id,
  role: row.role === 'user' ? 'user' : 'tavi',
  text: row.text,
  packageEligible: row.package_eligible,
  translation: row.translation,
  translationLabel: row.translation_label,
  coachNote: row.coach_note,
  followUpPrompt: row.follow_up_prompt,
  warning: row.warning,
  mode: toCoachMode(row.mode),
  answerLanguage: toAnswerLanguage(row.answer_language),
  sessionPhase: row.session_phase ? toSessionPhase(row.session_phase) : null,
  track: row.track ? toLearningTrack(row.track) : null,
  createdAt: row.created_at,
});

export const buildThreadTitle = (text: string): string => {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s?!.,'-]/gu, '')
    .trim();

  if (!normalized) {
    return 'New chat';
  }

  return normalized.length > 42 ? `${normalized.slice(0, 39).trim()}...` : normalized;
};

export const listTaviThreads = async (): Promise<TaviThreadSummary[]> => {
  const { data, error } = await supabase
    .from('tavi_threads')
    .select(THREAD_SELECT)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })
    .limit(30);

  if (error) {
    if (isTaviPersistenceUnavailable(error)) {
      console.warn('Tavi chat persistence is not available yet:', error.message);
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []).map(mapThread);
};

export const createTaviThread = async ({
  userId,
  title = 'New chat',
  sessionPhase = 'idle',
  track = 'vocabulary_first',
}: {
  userId: string;
  title?: string;
  sessionPhase?: CoachSessionPhase;
  track?: LearningTrack;
}): Promise<TaviThreadSummary> => {
  const { data, error } = await supabase
    .from('tavi_threads')
    .insert({
      user_id: userId,
      title,
      session_phase: sessionPhase,
      track,
    })
    .select(THREAD_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapThread(data);
};

export const renameTaviThread = async (threadId: string, title: string): Promise<void> => {
  const trimmed = title.trim();
  if (!trimmed) {
    return;
  }

  const { error } = await supabase
    .from('tavi_threads')
    .update({ title: buildThreadTitle(trimmed), updated_at: new Date().toISOString() })
    .eq('id', threadId);

  if (error) {
    throw new Error(error.message);
  }
};

export const softDeleteTaviThread = async (threadId: string): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('tavi_threads')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', threadId);

  if (error) {
    throw new Error(error.message);
  }
};

export const loadTaviMessages = async (threadId: string): Promise<TaviPersistedMessage[]> => {
  const { data, error } = await supabase
    .from('tavi_messages')
    .select(MESSAGE_SELECT)
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(120);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapMessage);
};

export const appendTaviMessage = async ({
  threadId,
  userId,
  message,
}: {
  threadId: string;
  userId: string;
  message: TaviMessageInput;
}): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase.from('tavi_messages').insert({
    id: message.id,
    thread_id: threadId,
    user_id: userId,
    role: message.role,
    text: message.text,
    package_eligible: message.packageEligible ?? false,
    translation: message.translation ?? null,
    translation_label: message.translationLabel ?? null,
    coach_note: message.coachNote ?? null,
    follow_up_prompt: message.followUpPrompt ?? null,
    warning: message.warning ?? null,
    mode: message.mode ?? null,
    answer_language: message.answerLanguage ?? null,
    session_phase: message.sessionPhase ?? null,
    track: message.track ?? null,
    created_at: now,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const updateTaviThreadState = async ({
  threadId,
  sessionPhase,
  track,
  title,
}: {
  threadId: string;
  sessionPhase: CoachSessionPhase;
  track: LearningTrack;
  title?: string;
}): Promise<void> => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('tavi_threads')
    .update({
      session_phase: sessionPhase,
      track,
      last_message_at: now,
      updated_at: now,
      ...(title ? { title: buildThreadTitle(title) } : {}),
    })
    .eq('id', threadId);

  if (error) {
    throw new Error(error.message);
  }
};
