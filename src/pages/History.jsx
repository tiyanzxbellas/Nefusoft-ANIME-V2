import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { getHistory, deleteHistoryItem, clearAllHistory } from '../utils/historyManager';
import { supabase } from '../utils/supabaseClient';
import { mediaUrl } from '../utils/media';

const HistoryCard = ({ ep, group, isLatest, navigate, handleDeleteEpisode, formatTime, getProxyUrl }) => {
  const cardRef = React.useRef(null);

  React.useEffect(() => {
    if (isLatest && cardRef.current && cardRef.current.parentElement) {
      const container = cardRef.current.parentElement;
      const cardLeft = cardRef.current.offsetLeft;
      const cardWidth = cardRef.current.offsetWidth;
      const containerWidth = container.offsetWidth;
      container.scrollLeft = cardLeft - containerWidth / 2 + cardWidth / 2;
    }
  }, [isLatest]);

  const progressPercentage = ep.duration > 0 ? (ep.current_time / ep.duration) * 100 : 0;

  return (
    <div
      ref={cardRef}
      onClick={() => navigate(`/anime/${ep.anime_id}-${ep.anime_slug}/${ep.episode_index}`)}
      className="flex-shrink-0 w-[180px] md:w-[220px] group/ep relative cursor-pointer rounded-xl bg-black/40 border border-white/5 overflow-hidden p-2 hover:border-[#F6CF80]/40 transition-all hover:bg-black/60"
    >
      <div className="relative aspect-video w-full rounded-lg overflow-hidden mb-2 bg-black">
        <img
          src={getProxyUrl(ep.anime_image)}
          alt={`${group.anime_title} Episode ${ep.episode_index}`}
          className="w-full h-full object-cover group-hover/ep:scale-105 transition-transform duration-500 opacity-70"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

        {/* Individual Episode delete */}
        <button
          onClick={(e) => handleDeleteEpisode(ep.anime_id, ep.episode_index, e)}
          className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10 opacity-0 group-hover/ep:opacity-100"
          title="Hapus episode ini"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <span className="absolute bottom-1.5 left-2 bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase">
          EPS {ep.episode_index}
        </span>

        <span className="absolute bottom-1.5 right-2 text-white text-[9px] font-bold">
          {formatTime(ep.current_time)}
        </span>
      </div>

      {/* Progress info */}
      <div className="px-1">
        <div className="flex justify-between items-center text-[10px] text-white/50 font-bold mb-1.5">
          <span>Durasi: {formatTime(ep.duration)}</span>
          <span className="text-[#F6CF80]">{Math.round(progressPercentage)}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F6CF80] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPercentage))}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

const History = () => {
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getHistory();
      setHistoryList(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    // Check if user is logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
      loadHistory();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
      loadHistory();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDeleteEpisode = async (animeId, episodeIndex, e) => {
    e.stopPropagation();
    try {
      await deleteHistoryItem(animeId, episodeIndex);
      setHistoryList(prev => prev.filter(item => !(item.anime_id === animeId && item.episode_index === episodeIndex)));
      showToast(`Episode ${episodeIndex} berhasil dihapus dari riwayat`);
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus episode');
    }
  };

  const handleDeleteAnimeGroup = (group, e) => {
    e?.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Riwayat Anime?',
      message: `Apakah Anda yakin ingin menghapus seluruh riwayat tontonan untuk "${group.anime_title}"?`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteHistoryItem(group.anime_id);
          setHistoryList(prev => prev.filter(item => item.anime_id !== group.anime_id));
          showToast('Riwayat anime berhasil dihapus');
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus riwayat anime');
        }
      }
    });
  };

  const handleClearAll = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Bersihkan Semua Riwayat?',
      message: 'Apakah Anda yakin ingin menghapus seluruh riwayat tontonan Anda? Semua data riwayat tontonan lokal akan dibersihkan.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await clearAllHistory();
          setHistoryList([]);
          showToast('Seluruh riwayat berhasil dibersihkan');
        } catch (err) {
          console.error(err);
          showToast('Gagal membersihkan seluruh riwayat');
        }
      }
    });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const getProxyUrl = mediaUrl;

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds) || timeInSeconds === null) return "00:00";
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper to group history by anime ID
  const groupHistoryByAnime = (list) => {
    const groups = {};
    list.forEach(item => {
      if (!groups[item.anime_id]) {
        groups[item.anime_id] = {
          anime_id: item.anime_id,
          anime_title: item.anime_title,
          anime_image: item.anime_image,
          anime_slug: item.anime_slug,
          latest_updated_at: item.updated_at,
          latest_episode_index: item.episode_index,
          highest_episode_index: Number(item.episode_index) || 0,
          episodes: []
        };
      }

      if (new Date(item.updated_at) > new Date(groups[item.anime_id].latest_updated_at)) {
        groups[item.anime_id].latest_updated_at = item.updated_at;
        groups[item.anime_id].latest_episode_index = item.episode_index;
      }

      const epNum = Number(item.episode_index) || 0;
      if (epNum > groups[item.anime_id].highest_episode_index) {
        groups[item.anime_id].highest_episode_index = epNum;
      }

      // Prevent duplicates in episodes list if any
      const exists = groups[item.anime_id].episodes.some(ep => ep.episode_index === item.episode_index);
      if (!exists) {
        groups[item.anime_id].episodes.push(item);
      }
    });

    // Sort the anime groups by their latest activity
    const sortedGroups = Object.values(groups).sort((a, b) => {
      return new Date(b.latest_updated_at) - new Date(a.latest_updated_at);
    });

    // Sort episodes within each group by episode_index ascending (kiri ke kanan)
    sortedGroups.forEach(group => {
      group.episodes.sort((a, b) => (Number(a.episode_index) || 0) - (Number(b.episode_index) || 0));
    });

    return sortedGroups;
  };

  const groupedHistory = groupHistoryByAnime(historyList);

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black font-black text-xs md:text-sm px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(246,207,128,0.3)] z-[999] animate-[fadeIn_0.3s_ease-out]">
          {toast}
        </div>
      )}

      <div className="pt-24 max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-white font-black uppercase text-lg">Riwayat Nonton</h2>
            <span className="text-[10px] text-white/50 font-bold">Lanjutkan anime yang sedang kamu tonton</span>
          </div>

          {!isLoading && historyList.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 px-4 py-2 rounded-lg text-red-400 font-black text-xs transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Bersihkan Semua
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 border-4 border-t-[#F6CF80] border-white/5 rounded-full animate-spin mb-4"></div>
            <p className="text-white/40 font-bold text-sm">memuat riwayat tontonan...</p>
          </div>
        ) : groupedHistory.length > 0 ? (
          <div className="flex flex-col gap-6">
            {groupedHistory.map((group) => (
              <div
                key={group.anime_id}
                className="bg-[#16161a] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col gap-4 hover:border-white/10 transition-all shadow-lg"
              >
                {/* Anime Header Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={getProxyUrl(group.anime_image)}
                      alt={group.anime_title}
                      className="w-12 h-16 md:w-14 md:h-20 object-cover rounded-lg border border-white/10 shadow-md flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h3
                        onClick={() => navigate(`/anime/${group.anime_id}-${group.anime_slug}/${group.latest_episode_index || group.episodes[group.episodes.length - 1]?.episode_index || 1}`)}
                        className="text-white font-extrabold text-sm md:text-base line-clamp-1 hover:text-[#F6CF80] cursor-pointer transition-colors"
                      >
                        {group.anime_title}
                      </h3>
                      <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-wider">
                        {group.highest_episode_index || group.episodes.length} Episode ditonton
                      </p>
                    </div>
                  </div>

                  {/* Delete entire anime from history */}
                  <button
                    onClick={(e) => handleDeleteAnimeGroup(group, e)}
                    className="text-white/40 hover:text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-500/10 flex items-center gap-1.5 text-xs font-bold"
                    title="Hapus anime ini dari riwayat"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span className="hidden sm:inline">Hapus Anime</span>
                  </button>
                </div>

                {/* Horizontal Episode List */}
                <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {group.episodes.map((ep) => {
                    const isLatest = String(ep.episode_index) === String(group.latest_episode_index);
                    return (
                      <HistoryCard
                        key={ep.episode_index}
                        ep={ep}
                        group={group}
                        isLatest={isLatest}
                        navigate={navigate}
                        handleDeleteEpisode={handleDeleteEpisode}
                        formatTime={formatTime}
                        getProxyUrl={getProxyUrl}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-white/5 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-white/40 font-bold text-sm">Belum ada riwayat tontonan</p>
            <p className="text-white/20 text-xs font-bold mt-2">
              Riwayat tontonan Anda tersimpan dengan aman secara lokal di peramban (browser) ini.
            </p>
          </div>
        )}
      </div>

      <Footer />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Hapus"
        cancelText="Batal"
        isDanger={true}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default History;