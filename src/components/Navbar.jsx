import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { isFavorite, saveFavorite, removeFavorite } from '../utils/favoritesManager';
import { getHistory } from '../utils/historyManager';
import { getProfile, updateProfile, syncProfileLevel, calculateLevel, setupProfileRealtime } from '../utils/profileManager';
import { mediaUrl } from '../utils/media';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentAnime, setCurrentAnime] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    const handleAnimeUpdate = () => {
      const anime = window.__CURRENT_ANIME__;
      if (anime && location.pathname.startsWith('/anime/')) {
        setCurrentAnime(anime);
        setIsFavorited(isFavorite(anime.anime_id));
      } else {
        setCurrentAnime(null);
        setIsFavorited(false);
      }
    };

    const handleFavoritesUpdate = () => {
      if (window.__CURRENT_ANIME__ && location.pathname.startsWith('/anime/')) {
        setIsFavorited(isFavorite(window.__CURRENT_ANIME__.anime_id));
      } else {
        setIsFavorited(false);
      }
    };

    handleAnimeUpdate();

    window.addEventListener('nefusoft-anime-updated', handleAnimeUpdate);
    window.addEventListener('nefusoft-favorites-updated', handleFavoritesUpdate);
    return () => {
      window.removeEventListener('nefusoft-anime-updated', handleAnimeUpdate);
      window.removeEventListener('nefusoft-favorites-updated', handleFavoritesUpdate);
    };
  }, [location.pathname]);

  const handleToggleFavoriteNavbar = () => {
    if (!currentAnime) return;
    if (isFavorited) {
      removeFavorite(currentAnime.anime_id);
    } else {
      saveFavorite(currentAnime);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [liveResults, setLiveResults] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [user, setUser] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Search History States
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('nefusoft_search_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [isInputFocused, setIsInputFocused] = useState(false);

  const addSearchTerm = (term) => {
    if (!term || !term.trim()) return;
    const trimmed = term.trim();
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      localStorage.setItem('nefusoft_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteHistoryItem = (term) => {
    setSearchHistory(prev => {
      const updated = prev.filter(item => item !== term);
      localStorage.setItem('nefusoft_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('nefusoft_search_history');
  };

  const [profile, setProfile] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [localHistoryCount, setLocalHistoryCount] = useState(0);

  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 150; // 150x150 square
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Center-crop calculation
        let srcX = 0;
        let srcY = 0;
        let srcWidth = img.width;
        let srcHeight = img.height;

        if (img.width > img.height) {
          srcWidth = img.height;
          srcX = (img.width - img.height) / 2;
        } else if (img.height > img.width) {
          srcHeight = img.width;
          srcY = (img.height - img.width) / 2;
        }

        ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, size, size);

        // Compress as image/jpeg, quality 0.7 to keep it lightweight (approx ~10-20KB)
        const base64Url = canvas.toDataURL('image/jpeg', 0.7);
        setEditAvatarUrl(base64Url);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const loadUserProfile = async (currentUser) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
    try {
      const history = await getHistory();
      const count = history.length;
      setLocalHistoryCount(count);

      const userProf = await getProfile(currentUser.id, currentUser.user_metadata);
      if (userProf) {
        setProfile(userProf);
        setEditUsername(userProf.username || '');
        setEditAvatarUrl(userProf.avatar_url || '');

        // Sync the level
        const syncedProf = await syncProfileLevel(currentUser.id, count);
        if (syncedProf) {
          setProfile(syncedProf);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!editUsername.trim()) {
      alert('Nama pengguna tidak boleh kosong!');
      return;
    }
    setIsSavingProfile(true);
    try {
      const updated = await updateProfile(user.id, {
        username: editUsername.trim(),
        avatar_url: editAvatarUrl.trim(),
      });
      if (updated) {
        setProfile(updated);
        // Sync custom state metadata on authentication context
        await supabase.auth.updateUser({
          data: {
            full_name: editUsername.trim(),
            avatar_url: editAvatarUrl.trim(),
          }
        });
        alert('Profil berhasil diperbarui!');
        setShowProfileModal(false);
      }
    } catch (err) {
      alert('Gagal menyimpan profil: ' + err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDesc = params.get('error_description');
    if (error) {
      alert(
        `Gagal Login dengan Google!\n\n` +
        `Penyebab: ${errorDesc || error}\n\n` +
        `Saran Solusi:\n` +
        `1. Pastikan fitur "Google" Provider sudah aktif (Enabled) di dashboard Supabase Anda (Authentication -> Providers -> Google).\n` +
        `2. Pastikan Client ID dan Client Secret yang dipasang di Supabase sudah benar.\n` +
        `3. Pastikan "Authorized redirect URIs" di Google Cloud Console diatur ke callback URL Supabase Anda (misal: https://<project-id>.supabase.co/auth/v1/callback) dan BUKAN domain web Anda.\n` +
        `4. Pastikan domain web Anda (${window.location.origin}) sudah didaftarkan di dashboard Supabase -> Authentication -> URL Configuration -> Redirect URLs.`
      );
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadUserProfile(user);
      setupProfileRealtime(user.id, (updatedProfile) => {
        setProfile(updatedProfile);
      });
    } else {
      setProfile(null);
      setupProfileRealtime(null);
    }
  }, [user]);

  useEffect(() => {
    const handleProfileUpdate = (e) => {
      if (e.detail) {
        setProfile(e.detail);
      }
    };
    window.addEventListener('nefusoft-profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('nefusoft-profile-updated', handleProfileUpdate);
    };
  }, []);

  useEffect(() => {
    const handleHistoryUpdate = () => {
      if (user) {
        loadUserProfile(user);
      }
    };
    window.addEventListener('nefusoft-history-updated', handleHistoryUpdate);
    return () => {
      window.removeEventListener('nefusoft-history-updated', handleHistoryUpdate);
    };
  }, [user]);

  // Handle click outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    } else {
      setSearchQuery('');
      setLiveResults([]);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2) {
        setIsLiveLoading(true);
        try {
          const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
          setLiveResults(res.data || []);
        } catch (e) {
          setLiveResults([]);
        }
        setIsLiveLoading(false);
      } else {
        setLiveResults([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addSearchTerm(searchQuery);
      navigate(`/explore?q=${encodeURIComponent(searchQuery)}`);
      setIsSearchOpen(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/home',
        },
      });
      if (error) throw error;
    } catch (e) {
      console.error('Google Auth Error:', e.message);
      alert('Gagal login dengan Google: ' + e.message);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setShowLoginPopup(false);
      setShowProfileDropdown(false);
      navigate('/home');
    } catch (e) {
      console.error('Logout Error:', e.message);
    }
  };

  const navLinks = [
    { path: '/home', label: 'Home', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/> },
    { path: '/donghua', label: 'Donghua', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm4 4l5 3-5 3V8z" /> },
    { path: '/manga', label: 'Manga', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
    { path: '/settings', label: 'Setting', icon: <g><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></g> },
    { path: '/favorites', label: 'Favorit', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> },
    { path: '/explore', label: 'Explore', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/> },
    { path: '/history', label: 'History', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/> },
    { path: '/ongoing', label: 'Ongoing', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/> },
    { path: '/schedule', label: 'Schedule', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/> }
  ];

  const getProxyUrl = mediaUrl;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px) scaleY(0.95); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }
      `}</style>
      <nav className="fixed top-2 inset-x-4 z-[100] max-w-7xl mx-auto">
        <div className="bg-black/60 h-16 px-6 rounded-2xl flex items-center justify-between border border-white/5 shadow-lg relative overflow-hidden">
          <div className="flex items-center shrink-0 z-10">
            <img src="/img/nefusoft.webp" className="w-10 md:w-14 aspect-square object-contain cursor-pointer" alt="NefuSoft" onClick={() => navigate('/home')} />
          </div>
          
          <div className="flex items-center justify-end flex-1 gap-3 z-10">
            {currentAnime && (
              <button
                onClick={handleToggleFavoriteNavbar}
                className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-white cursor-pointer border border-white/10 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shrink-0"
                title={isFavorited ? "Hapus dari Favorit" : "Tambah ke Favorit"}
              >
                <svg className="w-4 h-4" fill={isFavorited ? "#ef4444" : "none"} stroke={isFavorited ? "#ef4444" : "currentColor"} strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              </button>
            )}
            <div className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-white cursor-pointer border border-white/10 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors shrink-0" onClick={() => setIsSearchOpen(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="w-9 h-9 rounded-full overflow-hidden border border-[#F6CF80] cursor-pointer hover:scale-105 transition-transform flex items-center justify-center bg-[#16161a]"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[#F6CF80] text-xs font-black uppercase">
                      {(profile?.username || user.email)?.charAt(0) || 'U'}
                    </span>
                  )}
                </button>
                {showProfileDropdown && (
                  <div className="absolute right-0 top-11 bg-[#16161a] border border-white/10 rounded-xl shadow-2xl p-4 w-56 flex flex-col gap-2 z-[110] animate-[slideDown_0.2s_ease-out]">
                    <div className="border-b border-white/5 pb-2 mb-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-white font-black text-xs truncate max-w-[110px]">
                          {profile?.username || user.user_metadata?.full_name || 'User Nefu'}
                        </p>
                        <span className="bg-[#F6CF80] text-black text-[9px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                          Lv.{profile?.level || 1}
                        </span>
                      </div>
                      <p className="text-white/40 text-[10px] truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setShowProfileModal(true); setShowProfileDropdown(false); }}
                      className="text-[#F6CF80] hover:text-[#F6CF80]/80 text-left text-xs font-black py-1.5 transition-colors"
                    >
                      Pengaturan Profil
                    </button>
                    <button
                      onClick={() => { navigate('/history'); setShowProfileDropdown(false); }}
                      className="text-white/70 hover:text-[#F6CF80] text-left text-xs font-bold py-1.5 transition-colors"
                    >
                      Riwayat Nonton
                    </button>
                    <button
                      onClick={handleLogout}
                      className="text-red-400 hover:text-red-500 text-left text-xs font-black py-1.5 transition-colors border-t border-white/5 pt-2"
                    >
                      Keluar / Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div onClick={() => setShowLoginPopup(true)} className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center text-white cursor-pointer border border-white/10 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              </div>
            )}
          </div>

          <div className={`absolute inset-0 bg-[#16161a] z-20 flex items-center px-4 transition-all duration-300 ease-out ${isSearchOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'}`}>
            <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-3">
              <button type="submit" className="text-[#F6CF80] shrink-0 p-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </button>
              <input 
                ref={searchInputRef}
                type="text" 
                className="flex-1 bg-transparent text-white text-sm outline-none font-bold placeholder-white/30"
                placeholder="Cari anime..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setTimeout(() => setIsInputFocused(false), 250)}
              />
              <button type="button" onClick={() => setIsSearchOpen(false)} className="text-white/40 hover:text-white p-2 shrink-0 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </form>
          </div>
        </div>

        {isSearchOpen && (isInputFocused || searchQuery) && (
          <div className="absolute top-20 left-4 right-4 md:left-auto md:right-0 md:w-96 bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl z-[110] max-h-[60vh] overflow-y-auto custom-scrollbar origin-top animate-[slideDown_0.2s_ease-out]">
            {/* Search History Section */}
            {(() => {
              const filteredHistory = searchQuery.trim()
                ? searchHistory.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()))
                : searchHistory;

              if (filteredHistory.length === 0) return null;

              return (
                <div className="flex flex-col border-b border-white/5 pb-2">
                  <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-white/50">
                    <span>Riwayat Pencarian</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearAllHistory();
                      }}
                      className="text-[#F6CF80] hover:text-[#F6CF80]/80 transition-colors normal-case text-[10px] font-bold cursor-pointer"
                    >
                      Hapus Semua
                    </button>
                  </div>
                  <div className="flex flex-col">
                    {filteredHistory.map((item, idx) => (
                      <div
                        key={`${item}-${idx}`}
                        className="flex items-center justify-between px-4 py-2 hover:bg-white/5 group/history cursor-pointer transition-colors"
                        onClick={() => {
                          setSearchQuery(item);
                          addSearchTerm(item);
                          navigate(`/explore?q=${encodeURIComponent(item)}`);
                          setIsSearchOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <svg className="w-4 h-4 text-white/30 shrink-0 group-hover/history:text-[#F6CF80] transition-colors" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-white/80 font-bold text-xs truncate group-hover/history:text-white transition-colors">
                            {item}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHistoryItem(item);
                          }}
                          className="text-white/30 hover:text-red-400 hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer ml-2"
                          title="Hapus"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Live Search Results Section */}
            {searchQuery.length > 2 && (
              <div className="flex flex-col">
                <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-white/50">
                  Hasil Anime
                </div>
                {isLiveLoading ? (
                  <div className="p-6 text-center text-[#F6CF80] text-xs font-bold animate-pulse">mencari...</div>
                ) : liveResults.length > 0 ? (
                  liveResults.map(r => (
                    <div
                      key={r.id}
                      onClick={() => {
                        addSearchTerm(r.title);
                        navigate(`/anime/${r.id}-${(r.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: r } });
                        setIsSearchOpen(false);
                      }}
                      className="flex items-center gap-4 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                    >
                      <img src={getProxyUrl(r.image_poster)} referrerPolicy="no-referrer" className="w-10 aspect-[3/4.5] object-cover rounded-md shadow-md" />
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-xs line-clamp-1">{r.title}</span>
                        <span className="text-white/40 font-bold text-[9px] mt-1">{r.type} • {r.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-white/40 text-xs font-bold">anime tidak ditemukan</div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="fixed bottom-4 left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-black/80 border border-white/10 rounded-full flex justify-between items-center px-3 md:px-6 py-3 shadow-2xl z-[90]">
        {navLinks.map((link) => {
          const isActive = link.path === '/settings' ? showProfileModal : location.pathname.includes(link.path);
          return (
            <div 
              key={link.path} 
              onClick={() => {
                if (link.path === '/settings') {
                  if (user) {
                    setShowProfileModal(true);
                  } else {
                    setShowLoginPopup(true);
                  }
                } else {
                  navigate(link.path);
                }
              }}
              className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${isActive ? 'text-[#F6CF80]' : 'text-white/40 hover:text-white/80'}`}
            >
              <div className={`p-1.5 rounded-full ${isActive ? 'bg-[#F6CF80]/20' : 'bg-transparent'}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  {link.icon}
                </svg>
              </div>
              <span className={`text-[9px] font-bold ${isActive ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>{link.label}</span>
            </div>
          );
        })}
      </div>

      {showLoginPopup && (
        <div className="fixed inset-0 z-[999] bg-[#0a0a0c]/90 flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#16161a] border border-white/10 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center relative shadow-2xl">
            <button onClick={() => setShowLoginPopup(false)} className="absolute top-5 right-5 text-white/30 hover:text-[#F6CF80] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <img src="https://raw.githubusercontent.com/alip-jmbd/alipp/main/irohaplenger.jpg" alt="Login Banner" className="w-28 h-28 object-cover rounded-full mb-6 shadow-[0_0_30px_rgba(246,207,128,0.15)] border-4 border-[#F6CF80]/20" />

            <h3 className="text-white font-black text-2xl mb-2 text-center tracking-tight">Masuk ke NefuSoft</h3>
            <p className="text-white/50 text-xs font-medium text-center leading-relaxed mb-6">
              Masuk menggunakan akun Google Anda untuk dapat ikut berpartisipasi dalam obrolan Live Chat.
            </p>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-white/90 text-black py-3 px-4 rounded-xl font-black text-sm transition-all shadow-[0_10px_20px_rgba(255,255,255,0.05)] cursor-pointer"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Masuk dengan Google
            </button>
          </div>
        </div>
      )}

      {showProfileModal && user && (
        <div className="fixed inset-0 z-[999] bg-[#0a0a0c]/90 flex items-center justify-center p-4 overflow-y-auto animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-[#16161a] border border-white/10 rounded-3xl p-6 md:p-8 max-w-md w-full flex flex-col relative shadow-2xl">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-5 right-5 text-white/30 hover:text-[#F6CF80] transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>

            <h3 className="text-white font-black text-xl md:text-2xl mb-4 tracking-tight">Pengaturan Profil</h3>

            {/* Level & XP Info */}
            {(() => {
              const levelInfo = calculateLevel(localHistoryCount);
              return (
                <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-4 mb-6 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-[10px] font-black uppercase tracking-wider">Level Akun</span>
                    <span className="bg-[#F6CF80] text-black text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-[0_0_10px_rgba(246,207,128,0.2)]">
                      Lv. {levelInfo.level}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-white/40 font-bold mb-1.5">
                      <span>Progres Naik Level</span>
                      <span className="text-[#F6CF80]">{levelInfo.watchedCount} / {levelInfo.level * levelInfo.level} Episode</span>
                    </div>
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-[#F6CF80] rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(246,207,128,0.3)]"
                        style={{ width: `${levelInfo.percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  <p className="text-[10px] text-white/50 font-semibold leading-relaxed">
                    * Level akun Anda meningkat dengan terus menonton episode anime di NefuSoft. Semakin tinggi level Anda, semakin lama/banyak episode yang dibutuhkan untuk naik level berikutnya!
                  </p>
                </div>
              );
            })()}

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              {/* Profile Image Preview */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#F6CF80] flex-shrink-0 bg-[#0a0a0c]">
                  {editAvatarUrl ? (
                    <img src={editAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://raw.githubusercontent.com/alip-jmbd/alipp/main/irohaplenger.jpg'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#F6CF80] text-xl font-black">
                      {editUsername?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-white font-black text-sm">{editUsername || 'User Nefu'}</span>
                  <span className="text-white/40 text-[10px]">{user.email}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#F6CF80] hover:bg-[#F6CF80]/90 text-black text-[10px] font-black px-2.5 py-1 rounded-md transition-all cursor-pointer inline-flex items-center gap-1 w-max"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0016.5 4.5H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25z"/>
                    </svg>
                    Upload Gambar
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Username Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-white/50 text-[10px] font-black uppercase tracking-wider">Nama Pengguna (Username)</label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan username baru..."
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="bg-[#0a0a0c] border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-[#F6CF80]/40 transition-colors"
                  maxLength={30}
                />
              </div>

              {/* Avatar URL Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-white/50 text-[10px] font-black uppercase tracking-wider">URL Foto Profil (Avatar URL)</label>
                <input
                  type="text"
                  placeholder="Masukkan URL foto profil..."
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  className="bg-[#0a0a0c] border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-[#F6CF80]/40 transition-colors"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 mt-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black text-xs py-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 bg-[#F6CF80] hover:bg-[#F6CF80]/90 text-black font-black text-xs py-3 rounded-xl transition-all cursor-pointer disabled:opacity-50 text-center"
                  >
                    {isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setShowProfileModal(false);
                  }}
                  className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 hover:border-transparent font-black text-xs py-3 rounded-xl transition-all cursor-pointer text-center mt-2"
                >
                  Keluar / Logout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;