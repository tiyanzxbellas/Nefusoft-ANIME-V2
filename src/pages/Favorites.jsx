import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ConfirmModal from '../components/ConfirmModal';
import { getFavorites, removeFavorite } from '../utils/favoritesManager';
import { mediaUrl } from '../utils/media';

const Favorites = () => {
  const navigate = useNavigate();
  const [favoritesList, setFavoritesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const loadFavorites = () => {
    setIsLoading(true);
    try {
      const data = getFavorites();
      setFavoritesList(data);
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadFavorites();
    window.addEventListener('nefusoft-favorites-updated', loadFavorites);
    return () => {
      window.removeEventListener('nefusoft-favorites-updated', loadFavorites);
    };
  }, []);

  const handleRemoveFavorite = (anime, e) => {
    e?.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Hapus dari Favorit?',
      message: `Apakah Anda yakin ingin menghapus "${anime.anime_title}" dari daftar favorit Anda?`,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          removeFavorite(anime.anime_id);
          setFavoritesList(prev => prev.filter(item => item.anime_id !== anime.anime_id));
          showToast('Anime berhasil dihapus dari favorit');
        } catch (err) {
          console.error(err);
          showToast('Gagal menghapus favorit');
        }
      }
    });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const getProxyUrl = mediaUrl;

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <Navbar />

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black font-black text-xs md:text-sm px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(246,207,128,0.3)] z-[999] animate-[fadeIn_0.3s_ease-out]">
          {toast}
        </div>
      )}

      <div className="pt-24 max-w-7xl mx-auto px-4 md:px-6">
        <div className="mb-8 flex flex-col">
          <h2 className="text-white font-black uppercase text-lg">Daftar Favorit</h2>
          <span className="text-[10px] text-white/50 font-bold">Koleksi anime favorit pilihan kamu</span>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 border-4 border-t-[#F6CF80] border-white/5 rounded-full animate-spin mb-4"></div>
            <p className="text-white/40 font-bold text-sm">memuat daftar favorit...</p>
          </div>
        ) : favoritesList.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 md:gap-6 animate-[fadeIn_0.3s_ease-out]">
            {favoritesList.map((anime) => (
              <div
                key={anime.anime_id}
                onClick={() => navigate(`/anime/${anime.anime_id}-${anime.anime_slug}`, {
                  state: {
                    anime: {
                      id: anime.anime_id,
                      title: anime.anime_title,
                      image_poster: anime.anime_image,
                      image_cover: anime.anime_image,
                      type: anime.type,
                      status: anime.status
                    }
                  }
                })}
                className="group relative cursor-pointer rounded-2xl bg-[#16161a] border border-white/5 overflow-hidden flex flex-col gap-3 p-3 hover:border-[#F6CF80]/40 hover:scale-[1.02] transition-all duration-300 shadow-lg"
              >
                {/* Poster Container */}
                <div className="relative aspect-[3/4.2] w-full rounded-xl overflow-hidden bg-black shadow-md">
                  <img
                    src={getProxyUrl(anime.anime_image)}
                    alt={anime.anime_title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {/* Remove Favorite Button */}
                  <button
                    onClick={(e) => handleRemoveFavorite(anime, e)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 hover:bg-red-500 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-all border border-white/10 shadow-lg opacity-0 group-hover:opacity-100 focus:opacity-100 z-20 cursor-pointer"
                    title="Hapus dari favorit"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Type / Badge */}
                  {anime.type && (
                    <span className="absolute bottom-2 left-2 bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest shadow-sm">
                      {anime.type}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 min-w-0 px-1">
                  <h3 className="text-white font-extrabold text-xs md:text-sm line-clamp-2 leading-snug group-hover:text-[#F6CF80] transition-colors">
                    {anime.anime_title}
                  </h3>
                  {anime.status && (
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">
                      {anime.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-16 h-16 text-white/5 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <p className="text-white/40 font-bold text-sm">Belum ada anime favorit</p>
            <p className="text-white/20 text-xs font-bold mt-2 max-w-sm leading-relaxed">
              Daftar favorit Anda tersimpan dengan aman secara lokal di peramban (browser) ini. Klik tombol hati pada anime untuk menambahkannya ke sini!
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

export default Favorites;