import { supabase } from './supabaseClient';

const LOCAL_FAVORITES_KEY = 'nefusoft_favorites';
const LOCAL_FAVORITES_SNAPSHOT_KEY = 'nefusoft_favorites_cloud_snapshot';
const LOCAL_FAVORITES_PENDING_KEY = 'nefusoft_favorites_pending';

function readJsonArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Failed to read ${key} from local storage:`, err);
    return [];
  }
}

function normalizeFavorite(item) {
  return {
    anime_id: item.anime_id || item.animeId || '',
    anime_slug: item.anime_slug || item.animeSlug || '',
    anime_title: item.anime_title || item.animeTitle || '',
    anime_image: item.anime_image || item.animeImage || '',
    type: item.type || '',
    status: item.status || '',
    added_at: item.added_at || item.addedAt || item.created_at || new Date().toISOString(),
  };
}

/**
 * Get current favorites from local storage.
 */
export function getFavorites() {
  try {
    const localData = readJsonArray(LOCAL_FAVORITES_KEY);
    const normalized = localData.map(normalizeFavorite);
    return normalized.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
  } catch (err) {
    console.error('Failed to get favorites from local storage:', err);
    return [];
  }
}

function getPendingFavoriteIds() {
  return new Set(readJsonArray(LOCAL_FAVORITES_PENDING_KEY));
}

function setPendingFavoriteIds(pending) {
  localStorage.setItem(LOCAL_FAVORITES_PENDING_KEY, JSON.stringify(Array.from(pending)));
}

/**
 * Save favorite to local storage and sync to Supabase if authenticated.
 */
export async function saveFavorite(anime) {
  try {
    const normalized = normalizeFavorite({
      ...anime,
      added_at: new Date().toISOString()
    });

    const pending = getPendingFavoriteIds();
    pending.add(normalized.anime_id);
    setPendingFavoriteIds(pending);

    let favorites = getFavorites();
    favorites = favorites.filter(f => f.anime_id !== normalized.anime_id);
    favorites.unshift(normalized);

    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-favorites-updated'));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { error } = await supabase.from('favorites').upsert(
        {
          user_id: session.user.id,
          anime_id: normalized.anime_id,
          anime_slug: normalized.anime_slug,
          anime_title: normalized.anime_title,
          anime_image: normalized.anime_image,
          type: normalized.type,
          status: normalized.status,
          created_at: normalized.added_at,
        },
        { onConflict: 'user_id,anime_id' }
      );

      if (!error) {
        pending.delete(normalized.anime_id);
        setPendingFavoriteIds(pending);
      }
    }
  } catch (err) {
    console.error('Failed to save favorite:', err);
  }
}

/**
 * Remove favorite from local storage and sync to Supabase if authenticated.
 */
export async function removeFavorite(animeId) {
  try {
    const pending = getPendingFavoriteIds();
    pending.delete(animeId);
    setPendingFavoriteIds(pending);

    let favorites = getFavorites();
    favorites = favorites.filter(f => f.anime_id !== animeId);
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favorites));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nefusoft-favorites-updated'));
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', session.user.id)
        .eq('anime_id', animeId);
    }
  } catch (err) {
    console.error('Failed to remove favorite:', err);
  }
}

export function isFavorite(animeId) {
  try {
    const favorites = getFavorites();
    return favorites.some(f => f.anime_id === animeId);
  } catch (err) {
    console.error('Failed to check favorite status:', err);
    return false;
  }
}

/**
 * Sync favorites from Supabase cloud database into local storage.
 *
 * The cloud is treated as the source of truth for items that were already synced
 * before. If a favorite exists in the previous cloud snapshot but is no longer in
 * the cloud, it was deleted from another device and we must remove it locally
 * instead of uploading it back. Only items that are genuinely new or still
 * pending upload on this device are uploaded to the cloud.
 */
export async function syncFavoritesFromCloud(userId) {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (data) {
      const localFavorites = getFavorites();
      const cloudFavorites = data.map(normalizeFavorite);
      const cloudIds = new Set(cloudFavorites.map(f => f.anime_id));
      const previousCloudIds = new Set(readJsonArray(LOCAL_FAVORITES_SNAPSHOT_KEY));
      const pendingIds = getPendingFavoriteIds();
      const hasCloudSnapshot = localStorage.getItem(LOCAL_FAVORITES_SNAPSHOT_KEY) !== null;
      const cloudHasData = cloudIds.size > 0;

      // Keep an item locally when:
      // 1. It still exists in the cloud, OR
      // 2. It is still pending upload on this device, OR
      // 3. On the very first cloud sync with no cloud data yet, keep local-only
      //    items so that offline favorites can still be uploaded.
      // 4. On later syncs, keep items that were never known to be in the cloud.
      // Otherwise it was deleted from the cloud on another device -> drop it.
      const localToKeep = localFavorites.filter(item => {
        const id = item.anime_id;
        if (cloudIds.has(id) || pendingIds.has(id)) return true;
        if (!hasCloudSnapshot) return !cloudHasData;
        return !previousCloudIds.has(id);
      });

      const map = new Map();
      cloudFavorites.forEach(item => map.set(item.anime_id, item));

      localToKeep.forEach(item => {
        if (!map.has(item.anime_id)) {
          map.set(item.anime_id, item);
          // Upload local-only items to cloud (e.g. offline favorites).
          supabase.from('favorites').upsert(
            {
              user_id: userId,
              anime_id: item.anime_id,
              anime_slug: item.anime_slug,
              anime_title: item.anime_title,
              anime_image: item.anime_image,
              type: item.type,
              status: item.status,
              created_at: item.added_at,
            },
            { onConflict: 'user_id,anime_id' }
          ).then();
        }
      });

      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
      );

      localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(merged));

      // Remember which favorites were present in the cloud at this sync.
      localStorage.setItem(LOCAL_FAVORITES_SNAPSHOT_KEY, JSON.stringify(Array.from(cloudIds)));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nefusoft-favorites-updated'));
      }
    }
  } catch (err) {
    console.warn('Cloud favorites sync warning:', err);
  }
}

/**
 * Real-time subscription setup for favorites table in Supabase.
 */
let favoritesChannel = null;

export function setupFavoritesRealtime(userId) {
  if (!userId) {
    if (favoritesChannel) {
      supabase.removeChannel(favoritesChannel);
      favoritesChannel = null;
    }
    return;
  }

  if (favoritesChannel) {
    supabase.removeChannel(favoritesChannel);
  }

  // Initial cloud sync
  syncFavoritesFromCloud(userId);

  favoritesChannel = supabase
    .channel(`public:favorites:user_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'favorites',
        filter: `user_id=eq.${userId}`,
      },
      (_payload) => {
        syncFavoritesFromCloud(userId);
      }
    )
    .subscribe();
}

// Auto setup Realtime & sync when auth state changes
if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setupFavoritesRealtime(session.user.id);
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      setupFavoritesRealtime(session.user.id);
    } else {
      setupFavoritesRealtime(null);
    }
  });
}
