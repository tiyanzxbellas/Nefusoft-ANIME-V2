import { supabase } from './supabaseClient';

const LOCAL_HISTORY_KEY = 'nefusoft_watch_history';
const LOCAL_HISTORY_SNAPSHOT_KEY = 'nefusoft_watch_history_cloud_snapshot';
const LOCAL_HISTORY_PENDING_KEY = 'nefusoft_watch_history_pending';

function readJsonArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Failed to read ${key} from local storage:`, err);
    return [];
  }
}

/**
 * Normalizes history items structure.
 */
function normalizeItem(item) {
  return {
    anime_id: item.anime_id || item.animeId || '',
    anime_slug: item.anime_slug || item.animeSlug || '',
    anime_title: item.anime_title || item.animeTitle || '',
    anime_image: item.anime_image || item.animeImage || '',
    episode_index: item.episode_index !== undefined ? item.episode_index : (item.episodeIndex !== undefined ? item.episodeIndex : '1'),
    episode_id: item.episode_id || item.episodeId || '',
    current_time: item.current_time !== undefined ? item.current_time : (item.currentTime !== undefined ? item.currentTime : 0),
    duration: item.duration !== undefined ? item.duration : 0,
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
  };
}

function historyItemKey(item) {
  return `${item.anime_id}__${String(item.episode_index)}`;
}

function readPendingHistoryKeys() {
  return new Set(readJsonArray(LOCAL_HISTORY_PENDING_KEY));
}

function writePendingHistoryKeys(pending) {
  localStorage.setItem(LOCAL_HISTORY_PENDING_KEY, JSON.stringify(Array.from(pending)));
}

/**
 * Get watch history from local storage.
 */
export async function getHistory() {
  try {
    const localData = readJsonArray(LOCAL_HISTORY_KEY);
    const localHistory = localData.map(normalizeItem);
    return localHistory.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  } catch (err) {
    console.error('Failed to get watch history from local storage:', err);
    return [];
  }
}

/**
 * Saves or updates a history item in local storage and syncs with Supabase if authenticated.
 */
export async function saveHistoryItem(item) {
  try {
    const normalized = normalizeItem({
      ...item,
      updated_at: new Date().toISOString(),
    });

    const key = historyItemKey(normalized);
    const pending = readPendingHistoryKeys();
    pending.add(key);
    writePendingHistoryKeys(pending);

    let localHistory = readJsonArray(LOCAL_HISTORY_KEY).map(normalizeItem);

    // Remove existing entry for same anime and same episode
    localHistory = localHistory.filter(i => historyItemKey(i) !== key);

    // Add new to front
    localHistory.unshift(normalized);

    // Keep max 50 items
    if (localHistory.length > 50) {
      localHistory = localHistory.slice(0, 50);
    }

    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(localHistory));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { error } = await supabase.from('watch_history').upsert(
        {
          user_id: session.user.id,
          anime_id: normalized.anime_id,
          anime_slug: normalized.anime_slug,
          anime_title: normalized.anime_title,
          anime_image: normalized.anime_image,
          episode_index: String(normalized.episode_index),
          episode_id: normalized.episode_id,
          current_time: normalized.current_time,
          duration: normalized.duration,
          updated_at: normalized.updated_at,
        },
        { onConflict: 'user_id,anime_id,episode_index' }
      );

      if (!error) {
        pending.delete(key);
        writePendingHistoryKeys(pending);
      }
    }
  } catch (err) {
    console.error('Failed to save watch history:', err);
  }
}

/**
 * Removes history items of a specific anime_id.
 * If episodeIndex is provided, removes only that episode.
 */
export async function deleteHistoryItem(animeId, episodeIndex) {
  try {
    let localHistory = readJsonArray(LOCAL_HISTORY_KEY);
    const pending = readPendingHistoryKeys();

    if (episodeIndex !== undefined && episodeIndex !== null) {
      localHistory = localHistory.filter(i => !((i.anime_id || i.animeId) === animeId && String(i.episode_index || i.episodeIndex || '1') === String(episodeIndex)));
      pending.delete(`${animeId}__${String(episodeIndex)}`);
    } else {
      localHistory = localHistory.filter(i => (i.anime_id || i.animeId) !== animeId);
      [...pending].forEach(key => {
        if (key.startsWith(`${animeId}__`)) pending.delete(key);
      });
    }

    writePendingHistoryKeys(pending);
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(localHistory));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      let query = supabase.from('watch_history').delete().eq('user_id', session.user.id).eq('anime_id', animeId);
      if (episodeIndex !== undefined && episodeIndex !== null) {
        query = query.eq('episode_index', String(episodeIndex));
      }
      await query;
    }
  } catch (err) {
    console.error('Failed to delete history item:', err);
    throw err;
  }
}

/**
 * Clears entire watch history from local storage and Supabase.
 */
export async function clearAllHistory() {
  try {
    localStorage.removeItem(LOCAL_HISTORY_KEY);
    localStorage.removeItem(LOCAL_HISTORY_PENDING_KEY);
    localStorage.removeItem(LOCAL_HISTORY_SNAPSHOT_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-history-updated'));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('watch_history').delete().eq('user_id', session.user.id);
    }
  } catch (err) {
    console.error('Failed to clear watch history:', err);
    throw err;
  }
}

/**
 * Sync watch history from Supabase cloud database into local storage.
 *
 * Like the favorites sync, the cloud is the source of truth for history items
 * that were already synced. If an item exists in the previous cloud snapshot but
 * is no longer in the cloud, it was deleted from another device and must be
 * removed locally instead of being uploaded again.
 */
export async function syncHistoryFromCloud(userId) {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from('watch_history')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    if (data) {
      const localHistory = readJsonArray(LOCAL_HISTORY_KEY).map(normalizeItem);
      const cloudHistory = data.map(normalizeItem);
      const cloudKeys = new Set(cloudHistory.map(historyItemKey));
      const previousCloudKeys = new Set(readJsonArray(LOCAL_HISTORY_SNAPSHOT_KEY));
      const pendingKeys = readPendingHistoryKeys();
      const hasCloudSnapshot = localStorage.getItem(LOCAL_HISTORY_SNAPSHOT_KEY) !== null;
      const cloudHasData = cloudKeys.size > 0;

      // Drop items that were previously synced from the cloud but have since been
      // deleted remotely. Keep genuinely local/new items or pending uploads.
      const localToKeep = localHistory.filter(item => {
        const key = historyItemKey(item);
        if (cloudKeys.has(key) || pendingKeys.has(key)) return true;
        if (!hasCloudSnapshot) return !cloudHasData;
        return !previousCloudKeys.has(key);
      });

      const map = new Map();

      cloudHistory.forEach(item => {
        map.set(historyItemKey(item), item);
      });

      localToKeep.forEach(item => {
        const key = historyItemKey(item);
        if (!map.has(key)) {
          map.set(key, item);
          supabase.from('watch_history').upsert(
            {
              user_id: userId,
              anime_id: item.anime_id,
              anime_slug: item.anime_slug,
              anime_title: item.anime_title,
              anime_image: item.anime_image,
              episode_index: String(item.episode_index),
              episode_id: item.episode_id,
              current_time: item.current_time,
              duration: item.duration,
              updated_at: item.updated_at,
            },
            { onConflict: 'user_id,anime_id,episode_index' }
          ).then();
        }
      });

      let merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      if (merged.length > 50) {
        merged = merged.slice(0, 50);
      }

      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(merged));

      // Remember which history items were present in the cloud at this sync.
      localStorage.setItem(LOCAL_HISTORY_SNAPSHOT_KEY, JSON.stringify(Array.from(cloudKeys)));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nefusoft-history-updated'));
      }
    }
  } catch (err) {
    console.warn('Cloud history sync warning:', err);
  }
}

/**
 * Real-time subscription setup for watch_history table in Supabase.
 */
let historyChannel = null;

export function setupHistoryRealtime(userId) {
  if (!userId) {
    if (historyChannel) {
      supabase.removeChannel(historyChannel);
      historyChannel = null;
    }
    return;
  }

  if (historyChannel) {
    supabase.removeChannel(historyChannel);
  }

  // Initial cloud sync
  syncHistoryFromCloud(userId);

  historyChannel = supabase
    .channel(`public:watch_history:user_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'watch_history',
        filter: `user_id=eq.${userId}`,
      },
      (_payload) => {
        syncHistoryFromCloud(userId);
      }
    )
    .subscribe();
}

// Auto setup Realtime & sync when auth state changes
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setupHistoryRealtime(session.user.id);
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setupHistoryRealtime(session.user.id);
    } else {
      setupHistoryRealtime(null);
    }
  });
}
