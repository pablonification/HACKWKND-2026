import type { Database } from '../types/database';
import { deriveProfileProgress } from '../utils/profileProgress';
import { updateAuthProfile } from './auth';
import { supabase } from './supabase';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ProfileRole = NonNullable<ProfileRow['role']>;
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type FollowRow = Database['public']['Tables']['follows']['Row'];
const AVATAR_BUCKET = 'avatars' as const;

const toProfileRole = (value: unknown): ProfileRole | null => {
  if (value === 'admin' || value === 'elder' || value === 'learner') return value;
  return null;
};
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PROFILE_SELECT =
  'id,email,full_name,role,avatar_url,bio,village,age,specialty,app_language,indigenous_language,push_notifications_enabled' as const;

const toCount = (count: number | null): number => count ?? 0;

const toNullableTrimmed = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const resolveRole = (role: ProfileRow['role'], fallbackRole?: ProfileRole): ProfileRole => {
  if (role === 'learner' || role === 'elder' || role === 'admin') {
    return role;
  }

  return fallbackRole ?? 'learner';
};

const extractStoragePathFromPublicUrl = (publicUrl: string): string | null => {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const rawPath = parsed.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(rawPath);
  } catch {
    return null;
  }
};

const sanitizeFileExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) {
    return fromName;
  }

  if (file.type === 'image/jpeg') {
    return 'jpg';
  }

  if (file.type === 'image/png') {
    return 'png';
  }

  if (file.type === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
};

const safeCount = async (
  label: string,
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> => {
  const { count, error } = await query;

  if (error) {
    console.warn(`Failed to count ${label}:`, error);
    return 0;
  }

  return toCount(count);
};

export type ProfileDashboard = {
  profile: {
    id: string;
    fullName: string;
    email: string;
    role: ProfileRole;
    avatarUrl: string | null;
    bio: string | null;
    village: string | null;
    age: number | null;
    specialty: string | null;
    appLanguage: string;
    indigenousLanguage: string;
    pushNotificationsEnabled: boolean;
  };
  level: {
    label: string;
    progressPercent: number;
  };
  stats: {
    wordsLearned: number;
    storiesCompleted: number;
    storiesShared: number;
    followerCount: number;
    followingCount: number;
  };
};

export const fetchProfileDashboard = async ({
  userId,
  fallbackRole,
}: {
  userId: string;
  fallbackRole?: ProfileRole;
}): Promise<ProfileDashboard> => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  // New account — profile row not created yet. Auto-create it from auth user metadata.
  if (!profile) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) throw userError;

    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    const autoRole = toProfileRole(meta?.role) ?? fallbackRole ?? 'learner';
    const autoName = typeof meta?.full_name === 'string' ? meta.full_name.trim() || null : null;
    const autoEmail = user?.email ?? null;
    const autoUsername = autoEmail
      ? autoEmail
          .split('@')[0]
          .replace(/[^a-z0-9_]/gi, '')
          .toLowerCase()
      : null;

    const { error: upsertError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email: autoEmail,
        full_name: autoName,
        role: autoRole,
        username: autoUsername,
      },
      { onConflict: 'id' },
    );
    if (upsertError) throw upsertError;

    // Re-fetch after upsert
    const { data: newProfile, error: refetchError } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .single();
    if (refetchError) throw refetchError;

    return fetchProfileDashboard({ userId, fallbackRole: newProfile.role ?? fallbackRole });
  }

  const role = resolveRole(profile.role, fallbackRole);

  const [wordsLearned, authoredStories, uploadedRecordings, followerCount, followingCount] =
    await Promise.all([
      safeCount(
        'words learned',
        supabase
          .from('progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gt('mastery_level', 0),
      ),
      safeCount(
        'stories',
        supabase
          .from('stories')
          .select('*', { count: 'exact', head: true })
          .eq('author_id', userId)
          .eq('is_published', true),
      ),
      safeCount(
        'recordings',
        supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .eq('uploader_id', userId),
      ),
      safeCount(
        'followers',
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),
      ),
      safeCount(
        'following',
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),
      ),
    ]);

  const storiesShared = authoredStories + uploadedRecordings;
  // Story completion is not modeled yet in MVP schema; derive from learning depth for learner profiles.
  const storiesCompleted =
    role === 'learner' ? Math.max(authoredStories, Math.floor(wordsLearned / 70)) : authoredStories;

  const level = deriveProfileProgress({
    role,
    wordsLearned,
    storiesCompleted,
    storiesShared,
    followerCount,
  });

  return {
    profile: {
      id: profile.id,
      fullName: profile.full_name ?? 'Taleka User',
      email: profile.email ?? '',
      role,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      village: profile.village,
      age: profile.age,
      specialty: profile.specialty,
      appLanguage: profile.app_language,
      indigenousLanguage: profile.indigenous_language,
      pushNotificationsEnabled: profile.push_notifications_enabled,
    },
    level: {
      label: level.label,
      progressPercent: level.percentToNextLevel,
    },
    stats: {
      wordsLearned,
      storiesCompleted,
      storiesShared,
      followerCount,
      followingCount,
    },
  };
};

export const updateProfileDetails = async ({
  userId,
  fullName,
  email,
  bio,
  village,
  age,
  specialty,
}: {
  userId: string;
  fullName: string;
  email: string;
  bio?: string | null;
  village?: string | null;
  age?: number | null;
  specialty?: string | null;
}): Promise<boolean> => {
  const {
    data: { user: currentUser },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    throw getUserError;
  }
  const authNeedsUpdate =
    fullName !== currentUser?.user_metadata?.full_name || email !== currentUser?.email;

  if (authNeedsUpdate) {
    await updateAuthProfile({ fullName, email });
  }

  const updatePayload: ProfileUpdate = {};
  let shouldRunProfileUpdate = false;

  if (typeof bio !== 'undefined') {
    updatePayload.bio = toNullableTrimmed(bio);
    shouldRunProfileUpdate = true;
  }

  if (typeof village !== 'undefined') {
    updatePayload.village = toNullableTrimmed(village);
    shouldRunProfileUpdate = true;
  }

  if (typeof age !== 'undefined') {
    updatePayload.age = age;
    shouldRunProfileUpdate = true;
  }

  if (typeof specialty !== 'undefined') {
    updatePayload.specialty = toNullableTrimmed(specialty);
    shouldRunProfileUpdate = true;
  }

  if (!shouldRunProfileUpdate && !authNeedsUpdate) {
    return false;
  }
  if (shouldRunProfileUpdate) {
    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);

    if (error) {
      throw error;
    }
  }

  return true;
};

export const updateProfilePreferences = async ({
  userId,
  appLanguage,
  indigenousLanguage,
  pushNotificationsEnabled,
}: {
  userId: string;
  appLanguage: string;
  indigenousLanguage: string;
  pushNotificationsEnabled: boolean;
}): Promise<void> => {
  const payload: ProfileUpdate = {
    app_language: appLanguage,
    indigenous_language: indigenousLanguage,
    push_notifications_enabled: pushNotificationsEnabled,
  };

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);

  if (error) {
    throw error;
  }
};

export const updatePushNotification = async ({
  userId,
  pushNotificationsEnabled,
}: {
  userId: string;
  pushNotificationsEnabled: boolean;
}): Promise<void> => {
  const { error } = await supabase
    .from('profiles')
    .update({ push_notifications_enabled: pushNotificationsEnabled })
    .eq('id', userId);

  if (error) {
    throw error;
  }
};

export const uploadProfileAvatar = async ({
  userId,
  file,
  currentAvatarUrl,
}: {
  userId: string;
  file: File;
  currentAvatarUrl?: string | null;
}): Promise<string> => {
  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    throw new Error('Please upload a JPG, PNG, or WEBP image.');
  }

  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error('Avatar size must be 5MB or less.');
  }

  const extension = sanitizeFileExtension(file);
  const uniqueId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 12);
  const filePath = `${userId}/${Date.now()}-${uniqueId}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrlData.publicUrl })
    .eq('id', userId);

  if (profileError) {
    await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
    throw profileError;
  }

  if (currentAvatarUrl) {
    const previousPath = extractStoragePathFromPublicUrl(currentAvatarUrl);
    if (previousPath) {
      const { error: removeError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([previousPath]);
      if (removeError) {
        console.warn('Failed to remove previous avatar:', removeError);
      }
    }
  }

  return publicUrlData.publicUrl;
};

export const followProfile = async ({
  followerId,
  followingId,
}: {
  followerId: string;
  followingId: string;
}): Promise<void> => {
  if (followerId === followingId) {
    throw new Error('You cannot follow your own profile.');
  }

  const { error } = await supabase.from('follows').upsert(
    {
      follower_id: followerId,
      following_id: followingId,
    },
    {
      onConflict: 'follower_id,following_id',
    },
  );

  if (error) {
    throw error;
  }
};

export const unfollowProfile = async ({
  followerId,
  followingId,
}: {
  followerId: string;
  followingId: string;
}): Promise<void> => {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    throw error;
  }
};

export const listFollowers = async (profileId: string): Promise<FollowRow[]> => {
  const { data, error } = await supabase
    .from('follows')
    .select('id,follower_id,following_id,created_at')
    .eq('following_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

export const isFollowingProfile = async ({
  followerId,
  followingId,
}: {
  followerId: string;
  followingId: string;
}): Promise<boolean> => {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
};
