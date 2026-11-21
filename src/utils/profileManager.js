import { supabase } from './supabaseClient';

/**
 * Calculates user level based on unique/episodes watched count.
 * Level 1: 0 episodes
 * Level 2: 2 episodes
 * Level 3: 6 episodes
 * Level 4: 12 episodes
 * Level 5: 20 episodes
 * Level 6: 30 episodes
 * Level 7: 42 episodes
 * Level 8: 56 episodes
 * Level 9: 72 episodes
 * Level 10: 90 episodes
 * Formula: Cumulative watched count for Level L is L * (L - 1)
 */
export function calculateLevel(watchedCount) {
  let level = 1;
  while (level * (level - 1) <= watchedCount) {
    level++;
  }
  level = level - 1; // Actual current level

  const currentLevelEpisodes = level * (level - 1);
  const nextLevelEpisodes = (level + 1) * level;
  const neededForNext = nextLevelEpisodes - currentLevelEpisodes;
  const progressInLevel = watchedCount - currentLevelEpisodes;

  return {
    level,
    watchedCount,
    progressInLevel,
    neededForNext,
    percentage: Math.min(100, Math.floor((progressInLevel / neededForNext) * 100)),
  };
}

/**
 * Fetches the user profile from database. If it does not exist,
 * creates and registers a default one using user auth details.
 */
export async function getProfile(userId, userMetadata = {}) {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return data;
    }

    // Profile doesn't exist, let's create a default profile row
    const defaultUsername = userMetadata.full_name || userMetadata.name || 'User Nefu';
    const defaultAvatarUrl = userMetadata.avatar_url || userMetadata.picture || '';

    const newProfile = {
      id: userId,
      username: defaultUsername,
      avatar_url: defaultAvatarUrl,
      level: 1,
      watched_count: 0,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .upsert([newProfile], { onConflict: 'id' })
      .select()
      .single();

    if (insertError) throw insertError;
    return inserted;
  } catch (err) {
    console.error('Failed to get/create profile:', err);
    // Return a dummy profile if database profiles table or RLS is not ready yet
    return {
      id: userId,
      username: userMetadata.full_name || 'User Nefu',
      avatar_url: userMetadata.avatar_url || '',
      level: 1,
      watched_count: 0,
    };
  }
}

/**
 * Updates profile fields (username and/or avatar_url) in Supabase.
 */
export async function updateProfile(userId, { username, avatar_url }) {
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        username,
        avatar_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nefusoft-profile-updated', { detail: data }));
    }
    return data;
  } catch (err) {
    console.error('Failed to update profile:', err);
    throw err;
  }
}

/**
 * Synchronizes user level in Supabase with watch history episode count.
 */
export async function syncProfileLevel(userId, localHistoryCount) {
  if (!userId) return null;

  try {
    const { level } = calculateLevel(localHistoryCount);

    const { data, error } = await supabase
      .from('profiles')
      .update({
        level,
        watched_count: localHistoryCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nefusoft-profile-updated', { detail: data }));
    }
    return data;
  } catch (err) {
    console.warn('Could not sync level to profiles database. This is normal if database is not fully configured yet.', err);
    return null;
  }
}

/**
 * Real-time subscription for profiles table.
 */
let profilesChannel = null;

export function setupProfileRealtime(userId, onUpdateCallback) {
  if (!userId) {
    if (profilesChannel) {
      supabase.removeChannel(profilesChannel);
      profilesChannel = null;
    }
    return;
  }

  if (profilesChannel) {
    supabase.removeChannel(profilesChannel);
  }

  profilesChannel = supabase
    .channel(`public:profiles:id_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          if (onUpdateCallback) onUpdateCallback(payload.new);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nefusoft-profile-updated', { detail: payload.new }));
          }
        }
      }
    )
    .subscribe();
}
