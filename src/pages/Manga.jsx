import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { mediaUrl } from '../utils/media';

const API_BASE = 'https://komikindo.ch/wp-json/apk';

const getApiUrl = (url) => {
  return `https://cf.tiyanstores.workers.dev/?url=${encodeURIComponent(url)}`;
};

// Helper to secure referrer policy / image proxy (worker = fallback terakhir)
const getMangaImg = (url) => mediaUrl(url);

// Poster versi kecil.
// Kartu cuma butuh 120-180 px, tapi halaman detail memakai cover ASLI (PNG
// sampai 230 KB) dan kartu komikindo mengirim thumb ~22 KB per gambar.
// wsrv.nl mengubahnya jadi webp kecil: cover 230 KB -> 27 KB, thumb -> 15 KB.
// Bonus: wsrv.nl tidak kena blokir DNS operator (workers.dev diblokir XL).
const wsrvImg = (url, width) => {
  if (!url) return '';
  if (!/^https?:/i.test(url)) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&output=webp&q=72&we`;
};

// Kalau resizer gagal, <img> balik ke proxy worker (sekali saja, anti-loop).
const onImgError = (e) => {
  const el = e.currentTarget;
  if (!el || el.dataset.fallback === '1') return;
  const raw = el.dataset.raw;
  if (!raw) return;
  el.dataset.fallback = '1';
  el.src = getMangaImg(raw);
};

// API komikindo mengirim header CORS sendiri, jadi bisa di-fetch LANGSUNG
// tanpa proxy. Proxy worker hanya dipakai kalau direct gagal (dev/CORS/
// jaringan yang memblokir). Ini melepas ketergantungan penuh ke
// *.workers.dev yang diblokir DNS sebagian operator (mis. XL Axiata).
const mangaFetch = async (url) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return fetch(getApiUrl(url)).then((r) => r.json());
  }
};

// Component for rendering chapter pages with multi-source fallback
const ChapterImage = ({ imgUrl, pageNum }) => {
  const sources = React.useMemo(() => {
    if (!imgUrl) return [];
    return [
      imgUrl,
      `https://wsrv.nl/?url=${encodeURIComponent(imgUrl)}`,
      `https://cf.tiyanstores.workers.dev/?url=${encodeURIComponent(imgUrl)}`
    ];
  }, [imgUrl]);

  const [srcIndex, setSrcIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSrcIndex(0);
    setHasError(false);
  }, [imgUrl]);

  const handleError = () => {
    if (srcIndex + 1 < sources.length) {
      setSrcIndex(prev => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentSrc = sources[srcIndex];

  if (hasError) {
    return (
      <div className="w-full aspect-[3/4] max-w-lg bg-[#16161a] border border-white/5 rounded-xl flex flex-col items-center justify-center p-4 my-2 text-center">
        <span className="text-xl mb-1">🖼️</span>
        <p className="text-white/60 text-xs font-bold mb-2">Halaman {pageNum} gagal dimuat</p>
        <button
          onClick={() => {
            setHasError(false);
            setSrcIndex(0);
          }}
          className="px-3 py-1.5 bg-[#F6CF80] hover:bg-[#ebd59b] text-black text-[10px] font-black rounded-lg transition-all cursor-pointer"
        >
          🔄 Coba Muat Ulang Halaman
        </button>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      referrerPolicy="no-referrer"
      className="w-full max-w-full h-auto object-contain block select-none bg-black"
      loading={pageNum <= 3 ? "eager" : "lazy"}
      alt={`Halaman ${pageNum}`}
      onError={handleError}
    />
  );
};

// Extractor helper to parse numeric ID from kmkindo.click URLs
const getIdFromUrl = (url) => {
  if (!url) return '';
  const match = url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : '';
};

const POPULAR_GENRES = [
  { id: 'action', name: 'Action' },
  { id: 'adventure', name: 'Adventure' },
  { id: 'comedy', name: 'Comedy' },
  { id: 'drama', name: 'Drama' },
  { id: 'fantasy', name: 'Fantasy' },
  { id: 'romance', name: 'Romance' },
  { id: 'slice-of-life', name: 'Slice of Life' },
  { id: 'supernatural', name: 'Supernatural' },
  { id: 'martial-arts', name: 'Martial Arts' },
  { id: 'historical', name: 'Historical' },
  { id: 'mystery', name: 'Mystery' },
  { id: 'isekai', name: 'Isekai' }
];

const Shimmer = () => (
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] z-10" style={{ transform: 'skewX(-20deg)' }} />
);

const CardSkeleton = () => (
  <div className="min-w-[120px] w-[120px] md:min-w-[140px] md:w-[140px] flex flex-col gap-2 relative shrink-0">
    <div className="aspect-[3/4.5] bg-[#16161a] rounded-xl relative overflow-hidden border border-white/5 shadow-xl">
      <Shimmer />
    </div>
    <div className="w-3/4 h-3 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
    <div className="w-1/2 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
  </div>
);

const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

// Banner hero dipisah jadi komponen memo dengan state rotasi internal.
// Dulu rotasi 5 detik memanggil setBannerIdx di komponen halaman -> SELURUH
// halaman (9 slider + grid) ikut di-render ulang tiap 5 detik.
const HeroBanner = React.memo(({ banners, onOpen }) => {
  const total = Array.isArray(banners) ? banners.length : 0;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % total), 6000);
    return () => clearInterval(t);
  }, [total]);

  if (total === 0) return null;
  const activeBanner = banners[idx] || {};

  return (
    <div className="w-full h-full relative">
      {/* latar: cukup gambar 60 px (di-blur oleh overlay gradien) */}
      <img
        src={wsrvImg(activeBanner.coverImage, 60) || getMangaImg(activeBanner.coverImage)}
        data-raw={activeBanner.coverImage || ''}
        onError={onImgError}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover opacity-50"
        fetchPriority="high"
        decoding="async"
        alt="Banner Background"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent"></div>
      <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 flex items-end gap-4 md:gap-6 z-10 w-[calc(100%-48px)] md:w-[calc(100%-96px)] max-w-7xl mx-auto">
        <img
          src={wsrvImg(activeBanner.coverImage, 320) || getMangaImg(activeBanner.coverImage)}
          data-raw={activeBanner.coverImage || ''}
          onError={onImgError}
          referrerPolicy="no-referrer"
          className="w-20 md:w-36 aspect-[3/4.5] object-cover rounded-xl shadow-2xl border border-white/10 shrink-0"
          fetchPriority="high"
          decoding="async"
          alt={activeBanner.title}
        />
        <div className="flex flex-col text-left mb-1 md:mb-2 gap-1 md:gap-2 flex-1 min-w-0">
          <span className="bg-[#F6CF80]/20 text-[#F6CF80] text-[9px] md:text-xs font-black uppercase px-2 py-0.5 rounded-full w-max border border-[#F6CF80]/30 tracking-wider">
            {activeBanner.format || 'Manga'}
          </span>
          <h2 className="text-base md:text-3xl font-black text-white tracking-tight leading-tight line-clamp-2">
            {activeBanner.title}
          </h2>
          <p className="text-[10px] md:text-xs text-white/50 line-clamp-2 max-w-2xl leading-relaxed">
            Manga terpopuler dengan {activeBanner.views || 'banyak'} pembaca setia di NefuManga! {activeBanner.chapter ? `Update terbaru: Chapter ${activeBanner.chapter}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-1 md:mt-2">
            <button
              onClick={() => onOpen(activeBanner.slug)}
              className="h-8 md:h-10 px-5 md:px-6 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-lg font-black tracking-wider text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-colors shadow-[0_4px_14px_rgba(246,207,128,0.3)] cursor-pointer"
            >
              <span className="leading-none">Baca Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Manga() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'home';
  const activeSlug = searchParams.get('slug') || '';
  const activeChapterIndexRaw = searchParams.get('chapter');
  const activeChapterIndex = activeChapterIndexRaw ? Number(activeChapterIndexRaw) : null;

  // Manual retry trigger to re-fetch on rate-limiting or network issues
  const [retryTrigger, setRetryTrigger] = useState(0);

  const setMangaView = (newView, params = {}, options = {}) => {
    const nextParams = new URLSearchParams();
    nextParams.set('view', newView);
    if (newView === 'details' || newView === 'reader') {
      const slugVal = params.slug || activeSlug;
      if (slugVal) nextParams.set('slug', slugVal);
    }
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        nextParams.delete(k);
      } else if (k !== 'slug') {
        nextParams.set(k, String(v));
      }
    });
    setSearchParams(nextParams, options);
  };

  const hasFetchedRef = useRef(false);
  const localCache = getCachedData('nefusoft_manga_home_cache_v2');
  const memoryCache = window.__NEFUSOFT_MANGA_CACHE__ || localCache;

  // Cache & Lists
  const [banners, setBanners] = useState(memoryCache?.banners || []);
  const [genres, setGenres] = useState(POPULAR_GENRES);
  const [popular, setPopular] = useState(memoryCache?.popular || []);
  const [latest, setLatest] = useState(memoryCache?.latest || []);
  const [trending, setTrending] = useState(memoryCache?.trending || []);
  const [recommendations, setRecommendations] = useState(memoryCache?.recommendations || []);
  const [mostBookmarked, setMostBookmarked] = useState(memoryCache?.mostBookmarked || []);
  const [mostRead, setMostRead] = useState(memoryCache?.mostRead || []);
  const [topManhwa, setTopManhwa] = useState(memoryCache?.topManhwa || []);
  const [topManhua, setTopManhua] = useState(memoryCache?.topManhua || []);
  const [topManga, setTopManga] = useState(memoryCache?.topManga || []);
  const [topAnime, setTopAnime] = useState(memoryCache?.topAnime || []);

  // Loading states
  const [isHomeLoading, setIsHomeLoading] = useState(!memoryCache);

  // Browse/Search States
  const [browseResults, setBrowseResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(''); // 'manga', 'manhwa', 'manhua' etc
  const [sortType, setSortType] = useState('latest'); // 'latest', 'popular', 'trending'
  const [sortOrder, setSortOrder] = useState('desc');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);

  // Details States
  const [detailsData, setDetailsData] = useState(null);
  const [chaptersData, setChaptersData] = useState([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');

  // Reader States
  const [readerData, setReaderData] = useState(null);
  const [isReaderLoading, setIsReaderLoading] = useState(false);

  // Fetch Home Data
  useEffect(() => {
    if (view !== 'home') return;

    // Use lightweight cache if already loaded in session
    if (hasFetchedRef.current && retryTrigger === 0) {
      setIsHomeLoading(false);
      return;
    }

    const fetchHomeData = async () => {
      if (!localCache && banners.length === 0) {
        setIsHomeLoading(true);
      }
      try {
        const [
          rekomendasi1, rekomendasi2, terpopuler1, terpopuler2, latestRes,
          colorizedColored, colorizedBW, manhwaRes, manhuaRes, mangaRes
        ] = await Promise.all([
          mangaFetch(`${API_BASE}/v2/rekomendasi/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/rekomendasi/2`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/terpopuler/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/terpopuler/2`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/latest/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/colorized/1/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/colorized/0/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/type/Manhwa/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/type/Manhua/1`).catch(() => []),
          mangaFetch(`${API_BASE}/v2/type/Manga/1`).catch(() => [])
        ]);

        const mapMangaItem = (item) => ({
          title: item.title || '',
          coverImage: item.img || '',
          slug: getIdFromUrl(item.url) || '',
          format: item.type || 'Manga',
          rating: item.score || '7.5',
          views: item.views || '',
          status: item.status || '',
          chapter: item.chapter || item.data?.chapter || ''
        });

        const banData = (Array.isArray(rekomendasi1) ? rekomendasi1 : []).map(mapMangaItem);
        const recData = (Array.isArray(rekomendasi2) ? rekomendasi2 : []).map(mapMangaItem);
        const popData = (Array.isArray(terpopuler1) ? terpopuler1 : []).map(mapMangaItem);
        const treData = (Array.isArray(terpopuler2) ? terpopuler2 : []).map(mapMangaItem);
        const latData = (Array.isArray(latestRes) ? latestRes : []).map(mapMangaItem);
        const bokData = (Array.isArray(colorizedColored) ? colorizedColored : []).map(mapMangaItem);
        const reaData = (Array.isArray(colorizedBW) ? colorizedBW : []).map(mapMangaItem);
        const mhwData = (Array.isArray(manhwaRes) ? manhwaRes : []).map(mapMangaItem);
        const mhnData = (Array.isArray(manhuaRes) ? manhuaRes : []).map(mapMangaItem);
        const mngData = (Array.isArray(mangaRes) ? mangaRes : []).map(mapMangaItem);

        setBanners(banData);
        setPopular(popData);
        setLatest(latData);
        setTrending(treData);
        setRecommendations(recData);
        setMostBookmarked(bokData);
        setMostRead(reaData);
        setTopManhwa(mhwData);
        setTopManhua(mhnData);
        setTopManga(mngData);
        setTopAnime(recData); // reuse recData for anime adaptations / extra variety

        hasFetchedRef.current = true;
        const compiled = {
          banners: banData,
          genres: POPULAR_GENRES,
          popular: popData,
          latest: latData,
          trending: treData,
          recommendations: recData,
          mostBookmarked: bokData,
          mostRead: reaData,
          topManhwa: mhwData,
          topManhua: mhnData,
          topManga: mngData,
          topAnime: recData
        };
        window.__NEFUSOFT_MANGA_CACHE__ = compiled;
        setCachedData('nefusoft_manga_home_cache_v2', compiled);
      } catch (e) {
        console.error('Failed to load Manga Home data', e);
      } finally {
        setIsHomeLoading(false);
      }
    };

    fetchHomeData();
  }, [view, retryTrigger]);

  // Browse and Search API Fetcher
  const fetchBrowseResults = async (page = 1, append = false) => {
    setIsBrowseLoading(true);
    try {
      let endpoint = '';
      if (searchQuery.trim()) {
        endpoint = `${API_BASE}/v2/search?s=${encodeURIComponent(searchQuery)}&paged=${page}`;
      } else if (selectedGenre || selectedFormat) {
        endpoint = `${API_BASE}/v2/filter?paged=${page}`;
        if (selectedGenre) {
          endpoint += `&genre=${selectedGenre.toLowerCase()}`;
        }
        if (selectedFormat) {
          const formattedType = selectedFormat.charAt(0).toUpperCase() + selectedFormat.slice(1);
          endpoint += `&type=${formattedType}`;
        }
        if (sortType) {
          endpoint += `&order=${sortType === 'popular' ? 'popular' : 'update'}`;
        }
      } else {
        endpoint = `${API_BASE}/v2/latest/${page}`;
      }

      const res = await mangaFetch(endpoint);
      const rawList = Array.isArray(res) ? res : [];

      const mappedResults = rawList.map(item => ({
        title: item.title || '',
        coverImage: item.img || '',
        slug: getIdFromUrl(item.url) || '',
        format: item.type || 'Manga',
        rating: item.score || '7.5',
        views: item.views || '',
        status: item.status || '',
        chapter: item.chapter || item.data?.chapter || ''
      }));

      if (append) {
        setBrowseResults(prev => [...prev, ...mappedResults]);
      } else {
        setBrowseResults(mappedResults);
      }
      setBrowseTotalPages(mappedResults.length === 10 ? page + 1 : page);
      setBrowsePage(page);
    } catch (e) {
      console.error('Failed to fetch browse/search results', e);
    } finally {
      setIsBrowseLoading(false);
    }
  };

  // Trigger browse search whenever filters or search query changes
  useEffect(() => {
    if (view === 'browse') {
      fetchBrowseResults(1, false);
    }
  }, [view, selectedGenre, selectedFormat, sortType, sortOrder]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBrowseResults(1, false);
  };

  // Fetch Details with useEffect reactive hooks
  useEffect(() => {
    if ((view === 'details' || view === 'reader') && activeSlug) {
      const loadDetails = async () => {
        setIsDetailsLoading(true);
        setDetailsData(null);
        setChaptersData([]);
        setChapterSearch('');
        try {
          const detailRes = await mangaFetch(`${API_BASE}/v2/manga/${activeSlug}`).catch(() => null);
          const rawDetail = Array.isArray(detailRes) && detailRes.length > 0 ? detailRes[0] : null;

          if (rawDetail) {
            const compiledDetails = {
              title: rawDetail.title || '',
              coverImage: rawDetail.cover || rawDetail.img || '',
              backgroundImage: rawDetail.cover || rawDetail.img || '',
              format: rawDetail.type || 'Manga',
              status: rawDetail.status || 'Ongoing',
              rating: rawDetail.score || '7.5',
              author: Array.isArray(rawDetail.author) ? rawDetail.author.map(a => a.name).join(', ') : rawDetail.author || '',
              releaseDate: rawDetail.released || '',
              synopsis: rawDetail.synopsis || '',
              genres: Array.isArray(rawDetail.genre) ? rawDetail.genre.map((g, index) => ({ id: index, name: g.name })) : []
            };

            setDetailsData(compiledDetails);
            setChaptersData(Array.isArray(rawDetail.data) ? rawDetail.data : []);
          } else {
            setDetailsData(null);
            setChaptersData([]);
          }
        } catch (e) {
          console.error('Failed to fetch series details', e);
          setChaptersData([]);
        } finally {
          setIsDetailsLoading(false);
        }
      };
      loadDetails();
    }
  }, [view, activeSlug, retryTrigger]);

  // Fetch Chapter with useEffect reactive hooks
  useEffect(() => {
    if (view === 'reader' && activeSlug && activeChapterIndex !== null) {
      const loadChapter = async () => {
        setIsReaderLoading(true);
        setReaderData(null);
        try {
          const res = await mangaFetch(`${API_BASE}/v2/chapter/${activeChapterIndex}`);
          setReaderData(res || null);
          window.scrollTo(0, 0);
        } catch (e) {
          console.error('Failed to load chapter reader', e);
        } finally {
          setIsReaderLoading(false);
        }
      };
      loadChapter();
    }
  }, [view, activeSlug, activeChapterIndex, retryTrigger]);

  // Navigation helpers for Reader usingSearchParams
  const navigateChapter = (dir) => {
    if (!chaptersData || chaptersData.length === 0) return;
    const currPos = chaptersData.findIndex(ch => String(getIdFromUrl(ch.url)) === String(activeChapterIndex));
    if (currPos === -1) return;

    if (dir === 'next' && currPos > 0) {
      // Newer chapter in array
      const nextCh = chaptersData[currPos - 1];
      setMangaView('reader', { slug: activeSlug, chapter: getIdFromUrl(nextCh.url) }, { replace: true });
    } else if (dir === 'prev' && currPos < chaptersData.length - 1) {
      // Older chapter in array
      const prevCh = chaptersData[currPos + 1];
      setMangaView('reader', { slug: activeSlug, chapter: getIdFromUrl(prevCh.url) }, { replace: true });
    }
  };

  // Filtered Chapters list in details view
  const filteredChapters = chaptersData.filter(ch => {
    const chStr = String(ch.chapter || '');
    return chStr.includes(chapterSearch);
  });

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white relative">
      <Navbar />

      {/* HEADER BANNER OR VIEW HERO */}
      {view === 'home' && (
        <div className="relative w-full aspect-[16/10] md:aspect-video min-h-[250px] md:max-h-[480px] overflow-hidden bg-[#0f0f12]">
          {isHomeLoading ? (
            <div className="w-full h-full bg-[#16161a] relative flex items-end p-6 md:p-12 gap-6">
              <Shimmer />
              <div className="w-24 md:w-36 aspect-[3/4.2] bg-white/5 rounded-lg shrink-0 overflow-hidden relative">
                <Shimmer />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="w-24 h-4 bg-white/5 rounded-sm relative overflow-hidden"><Shimmer /></div>
                <div className="w-1/2 h-8 bg-white/5 rounded-sm relative overflow-hidden"><Shimmer /></div>
                <div className="w-2/3 h-4 bg-white/5 rounded-sm relative overflow-hidden"><Shimmer /></div>
              </div>
            </div>
          ) : (
            <HeroBanner banners={banners} onOpen={(slug) => setMangaView('details', { slug })} />
          )}
        </div>
      )}

      {/* VIEW: HOME DASHBOARD */}
      {view === 'home' && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">

          {/* Quick Navigate & Browse genres */}
          <div className="flex items-center justify-between gap-4 mb-8 bg-[#16161a]/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="bg-white/5 p-2 rounded-xl border border-white/10">📚</span>
              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide">Jelajahi Ribuan Komik</h3>
                <p className="text-white/40 text-[10px] md:text-xs font-bold">Cari Manhwa, Manhua, atau Manga favoritmu disini!</p>
              </div>
            </div>
            <button
              onClick={() => setMangaView('browse')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-black text-[#F6CF80] transition-all cursor-pointer flex items-center gap-1.5"
            >
              🔍 Cari Komik
            </button>
          </div>

          {/* Slider helper */}
          {(() => {
            const renderSlider = (title, subtitle, list) => {
              if (!list || !Array.isArray(list) || list.length === 0) return null;
              return (
                <section className="mb-10 lazy-section">
                  <div className="flex justify-between items-end mb-4 px-2">
                    <div>
                      <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight leading-none">{title}</h2>
                      <span className="text-[9px] md:text-[10px] text-white/40 font-bold uppercase tracking-wider block mt-1">{subtitle}</span>
                    </div>
                  </div>
                  <div className="flex overflow-x-auto gap-3.5 pb-4 custom-scrollbar snap-x px-2">
                    {list.map((manga, idx) => {
                      const finalTitle = manga.title || '';
                      const finalCover = manga.coverImage || '';
                      const finalSlug = manga.slug || '';
                      const finalFormat = manga.format || 'Manga';
                      const finalRating = manga.rating || '7.5';
                      const isPreloadImg = idx < 4;
                      return (
                        <div
                          key={`${finalSlug}-${idx}`}
                          onClick={() => setMangaView('details', { slug: finalSlug })}
                          className="min-w-[120px] w-[120px] md:min-w-[145px] md:w-[145px] group cursor-pointer snap-start hover:-translate-y-1"
                        >
                          <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-xl border border-white/5 shadow-xl">
                            <img
                              src={wsrvImg(finalCover, 300) || getMangaImg(finalCover)}
                              data-raw={finalCover || ''}
                              onError={onImgError}
                              referrerPolicy="no-referrer"
                              loading={isPreloadImg ? "eager" : "lazy"}
                              fetchPriority={isPreloadImg ? "high" : "low"}
                              decoding={isPreloadImg ? "sync" : "async"}
                              className="w-full h-full object-cover"
                              alt={finalTitle}
                            />
                            <div className="absolute top-2 left-2 bg-black/85 text-[#F6CF80] text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
                              ⭐ {finalRating}
                            </div>
                            <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">
                              {finalFormat}
                            </div>
                          </div>
                          <h3 className="text-[10px] md:text-xs font-bold text-white/80 line-clamp-1 mt-2 group-hover:text-[#F6CF80] transition-colors">
                            {finalTitle}
                          </h3>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            };

            if (isHomeLoading) {
              return (
                <div className="flex flex-col gap-8">
                  {[...Array(3)].map((_, s) => (
                    <div key={s}>
                      <div className="w-48 h-5 bg-[#16161a] rounded-md mb-4 relative overflow-hidden"><Shimmer /></div>
                      <div className="flex gap-4 overflow-x-hidden">
                        {[...Array(6)].map((_, c) => <CardSkeleton key={c} />)}
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            const isHomeEmpty = !isHomeLoading &&
              banners.length === 0 &&
              popular.length === 0 &&
              latest.length === 0 &&
              trending.length === 0;

            if (isHomeEmpty) {
              return (
                <div className="text-center py-12 px-6 bg-[#16161a]/60 border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center gap-4 max-w-md mx-auto shadow-2xl my-10 animate-[fadeIn_0.5s_ease-out]">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl text-red-400">
                    ⚠️
                  </div>
                  <div className="text-center animate-[fadeIn_0.5s_ease-out_0.2s_both]">
                    <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Komik</h3>
                    <p className="text-white/50 text-[11px] font-bold mt-1 leading-relaxed">
                      Terjadi gangguan koneksi, limit server, atau data gagal diambil dari KomikIndo API. Silakan coba lagi.
                    </p>
                  </div>
                  <button
                    onClick={() => setRetryTrigger(prev => prev + 1)}
                    className="w-full h-10 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-xl font-black tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_12px_rgba(246,207,128,0.2)] active:scale-95"
                  >
                    🔄 Coba Lagi
                  </button>
                </div>
              );
            }

            return (
              <>
                {renderSlider('Populer Sekarang', 'Rekomendasi komik terpopuler minggu ini', popular)}
                {renderSlider('Komik Terbaru', 'Update rilis chapter paling fresh', latest)}
                {renderSlider('Trending Hari Ini', 'Komik dengan pembaca terbanyak saat ini', trending)}
                {renderSlider('Rekomendasi Untukmu', 'Pilihan terbaik tim editor NefuManga', recommendations)}
                {renderSlider('Komik Berwarna', 'Koleksi komik full color paling seru', mostBookmarked)}
                {renderSlider('Komik Hitam Putih / Klasik', 'Koleksi komik klasik bergaya otentik', mostRead)}
                {renderSlider('Top Manhwa (Korea)', 'Koleksi komik Korea terbaik', topManhwa)}
                {renderSlider('Top Manhua (China)', 'Koleksi komik Mandarin terbaik', topManhua)}
                {renderSlider('Top Manga (Jepang)', 'Koleksi komik Jepang klasik & modern', topManga)}
                {renderSlider('Pilihan Alternatif', 'Rekomendasi serial ekstra seru lainnya', topAnime)}

                {/* Genres Grid */}
                {genres.length > 0 && (
                  <section className="mb-10 bg-[#16161a]/20 border border-white/5 rounded-3xl p-6 backdrop-blur-xl lazy-section">
                    <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight mb-4">Temukan Berdasarkan Genre</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {genres.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            setSelectedGenre(g.id);
                            setMangaView('browse');
                          }}
                          className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:scale-102 border border-white/5 hover:border-[#F6CF80] rounded-xl px-4 py-3 text-xs font-bold text-white/80 transition-all cursor-pointer text-center truncate"
                        >
                          {g.name}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* VIEW: BROWSE / SEARCH */}
      {view === 'browse' && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left Sidebar Filters */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
              <div className="bg-[#16161a] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="text-white font-black text-xs uppercase tracking-wide border-b border-white/5 pb-2">Filter Pencarian</h3>

                {/* Search Form */}
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2">
                  <label className="text-white/40 text-[9px] font-black uppercase">Kata Kunci</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Cari judul..."
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#F6CF80] flex-1"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="bg-[#F6CF80] text-black px-3 py-2 rounded-xl text-xs font-black hover:opacity-90 cursor-pointer">
                      Cari
                    </button>
                  </div>
                </form>

                {/* Genre Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-[9px] font-black uppercase">Genre</label>
                  <select
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-[#F6CF80]"
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                  >
                    <option value="">Semua Genre</option>
                    {genres.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                {/* Format Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-[9px] font-black uppercase">Format / Jenis</label>
                  <select
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-[#F6CF80]"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                  >
                    <option value="">Semua</option>
                    <option value="manga">Manga</option>
                    <option value="manhwa">Manhwa</option>
                    <option value="manhua">Manhua</option>
                  </select>
                </div>

                {/* Sort Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-[9px] font-black uppercase">Urutkan</label>
                  <select
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-[#F6CF80]"
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value)}
                  >
                    <option value="latest">Terbaru</option>
                    <option value="popular">Terpopuler</option>
                  </select>
                </div>

                {/* Reset Buttons */}
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGenre('');
                    setSelectedFormat('');
                    setSortType('latest');
                    setSortOrder('desc');
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer text-center"
                >
                  Reset Filter
                </button>

                <button
                  onClick={() => setMangaView('home')}
                  className="bg-white/5 hover:bg-[#F6CF80] hover:text-black border border-white/5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer text-center"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            </div>

            {/* Right Main Grid */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl">
                <span className="text-white font-black text-xs uppercase tracking-wider">Hasil Jelajah</span>
                <span className="text-white/40 text-[10px] font-bold">Halaman {browsePage}</span>
              </div>

              {isBrowseLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : browseResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 lazy-grid">
                  {browseResults.map((manga, idx) => {
                    const finalTitle = manga.title || '';
                    const finalCover = manga.coverImage || '';
                    const finalSlug = manga.slug || '';
                    const finalFormat = manga.format || 'Manga';
                    const finalRating = manga.rating || '7.5';
                    return (
                      <div
                        key={`${finalSlug}-${idx}`}
                        onClick={() => setMangaView('details', { slug: finalSlug })}
                        className="group cursor-pointer hover:-translate-y-1 flex flex-col"
                      >
                        <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-xl border border-white/5 shadow-xl">
                          <img
                            src={wsrvImg(finalCover, 300) || getMangaImg(finalCover)}
                            data-raw={finalCover || ''}
                            onError={onImgError}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                            alt={finalTitle}
                          />
                          <div className="absolute top-2 left-2 bg-black/85 text-[#F6CF80] text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
                            ⭐ {finalRating}
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">
                            {finalFormat}
                          </div>
                        </div>
                        <h3 className="text-[10px] md:text-xs font-bold text-white/80 line-clamp-1 mt-2 group-hover:text-[#F6CF80] transition-colors">
                          {finalTitle}
                        </h3>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20 text-white/30 text-xs font-bold bg-[#16161a]/20 border border-white/5 rounded-3xl">
                  Komik tidak ditemukan dengan filter di atas.
                </div>
              )}

              {/* Pagination Controls */}
              {(browseResults.length >= 10 || browsePage > 1) && (
                <div className="flex justify-center items-center gap-4 mt-4 bg-[#16161a] border border-white/5 px-5 py-3 rounded-2xl w-max mx-auto">
                  <button
                    disabled={browsePage <= 1}
                    onClick={() => fetchBrowseResults(browsePage - 1)}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-[#F6CF80] font-black text-xs">{browsePage}</span>
                  <button
                    disabled={browseResults.length < 10}
                    onClick={() => fetchBrowseResults(browsePage + 1)}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
                  >
                    Selanjutnya
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DETAILS VIEW */}
      {view === 'details' && (
        <div className="max-w-4xl mx-auto px-4 mt-6">

          {isDetailsLoading ? (
            <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 relative overflow-hidden animate-pulse">
              <div className="w-full md:w-48 aspect-[3/4.5] bg-white/5 rounded-2xl shrink-0"></div>
              <div className="flex-1 flex flex-col gap-3">
                <div className="w-1/3 h-4 bg-white/5 rounded"></div>
                <div className="w-2/3 h-8 bg-white/5 rounded"></div>
                <div className="w-full h-16 bg-white/5 rounded"></div>
                <div className="w-1/2 h-4 bg-white/5 rounded"></div>
              </div>
            </div>
          ) : detailsData ? (() => {
            const finalDetails = detailsData;
            return (
              <div className="flex flex-col gap-6">
                {/* Detailed Header Card */}
                <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 relative overflow-hidden shadow-2xl">

                  {finalDetails.backgroundImage && (
                    <div className="absolute inset-0 opacity-5 blur-2xl pointer-events-none z-0">
                      <img
                        src={wsrvImg(finalDetails.backgroundImage, 60) || getMangaImg(finalDetails.backgroundImage)}
                        data-raw={finalDetails.backgroundImage || ''}
                        onError={onImgError}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        alt="backdrop"
                      />
                    </div>
                  )}

                  <img
                    src={wsrvImg(finalDetails.coverImage, 400) || getMangaImg(finalDetails.coverImage)}
                    data-raw={finalDetails.coverImage || ''}
                    onError={onImgError}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    className="w-full md:w-52 aspect-[3/4.5] object-cover rounded-2xl border border-white/10 shrink-0 z-10 shadow-lg"
                    alt={finalDetails.title}
                  />

                  <div className="flex-1 flex flex-col gap-3 text-left z-10">
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="bg-[#F6CF80]/20 text-[#F6CF80] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#F6CF80]/30 tracking-wider">
                        {finalDetails.format || 'Manga'}
                      </span>
                      <span className="bg-white/5 text-white/60 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/10 tracking-wider">
                        {finalDetails.status || 'Ongoing'}
                      </span>
                      <span className="text-[#F6CF80] font-black text-xs flex items-center gap-0.5">
                        ⭐ {finalDetails.rating || '7.5'}
                      </span>
                    </div>

                    <h1 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">
                      {finalDetails.title}
                    </h1>

                    <div className="flex flex-col gap-1 text-xs text-white/60">
                      {finalDetails.author && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider mr-2">Penulis:</span> {finalDetails.author}</p>
                      )}
                      {finalDetails.releaseDate && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider mr-2">Tahun Rilis:</span> {finalDetails.releaseDate}</p>
                      )}
                    </div>

                    {finalDetails.synopsis && (
                      <div className="bg-black/30 border border-white/5 rounded-2xl p-4 mt-2">
                        <span className="font-black text-white/40 uppercase text-[9px] tracking-wider block mb-1">Sinopsis</span>
                        <p className="text-[11px] md:text-xs text-white/70 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar pr-1">
                          {finalDetails.synopsis}
                        </p>
                      </div>
                    )}

                    {/* Genres in detail */}
                    {finalDetails.genres && finalDetails.genres.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {finalDetails.genres.map(g => (
                          <span
                            key={g.id}
                            className="bg-white/5 border border-white/5 text-white/80 text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-lg"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chapters List Section */}
                <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-4 shadow-2xl">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-white/5 pb-4">
                    <h2 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                      📖 Daftar Chapter ({chaptersData.length})
                    </h2>
                    <input
                      type="text"
                      placeholder="Cari chapter..."
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-[#F6CF80] w-full md:w-48"
                      value={chapterSearch}
                      onChange={(e) => setChapterSearch(e.target.value)}
                    />
                  </div>

                  {filteredChapters.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1" id="chapter-grid-container">
                      {filteredChapters.map((ch, idx) => {
                        const chId = getIdFromUrl(ch.url);
                        return (
                          <button
                            key={`${chId}-${idx}`}
                            onClick={() => setMangaView('reader', { slug: activeSlug, chapter: chId })}
                            className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white/80 transition-all cursor-pointer text-center truncate"
                          >
                            <span>Chapter {ch.chapter}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-white/30 text-xs font-bold">
                      Chapter tidak ditemukan.
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="text-center py-12 px-6 bg-[#16161a]/60 border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center gap-4 max-w-md mx-auto shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl text-red-400">
                ⚠️
              </div>
              <div className="text-center">
                <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Detail Komik</h3>
                <p className="text-white/50 text-[11px] font-bold mt-1 leading-relaxed">
                  Terjadi gangguan koneksi, limit server, atau data gagal diambil. Silakan coba memuat kembali halaman ini.
                </p>
              </div>
              <button
                onClick={() => setRetryTrigger(prev => prev + 1)}
                className="w-full h-10 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-xl font-black tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_12px_rgba(246,207,128,0.2)] active:scale-95"
              >
                🔄 Coba Lagi
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW: IMERSIVE CHAPTER READER */}
      {view === 'reader' && (
        <div className="max-w-2xl mx-auto px-4 mt-6">

          {/* Reader Top Bar Controls */}
          <div className="flex flex-col gap-2 bg-[#16161a] border border-white/5 rounded-2xl p-3 mb-6 shadow-xl sticky top-20 z-50">
            <div className="flex justify-between items-center gap-2">
              <div className="text-center min-w-0 flex-1">
                <span className="text-[#F6CF80] font-black text-sm block truncate">
                  {readerData?.title || `Chapter ID ${activeChapterIndex}`}
                </span>
              </div>
            </div>
          </div>

          {/* Chapter Image Render Stack */}
          <div className="flex flex-col gap-1 items-center bg-black rounded-3xl overflow-hidden py-4 border border-white/5 relative min-h-[400px]" id="reader-images-container">
            {isReaderLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-[#F6CF80] text-xs font-black animate-pulse">Memuat lembar chapter...</div>
              </div>
            ) : readerData && readerData.image ? (() => {
              const imagesList = readerData.image || [];
              return (
                <>
                  {imagesList.map((imgUrl, i) => (
                    <ChapterImage key={`${imgUrl}-${i}`} imgUrl={imgUrl} pageNum={i + 1} />
                  ))}
                </>
              );
            })() : (
              <div className="text-center py-12 px-6 flex flex-col items-center justify-center gap-4 max-w-md mx-auto my-auto">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-xl text-red-400">
                  ⚠️
                </div>
                <div className="text-center">
                  <h4 className="text-white font-black text-xs tracking-wide">Gambar Gagal Dimuat</h4>
                  <p className="text-white/40 text-[10px] font-bold mt-1 leading-relaxed">
                    Lembar gambar chapter gagal diambil dari server. Silakan coba memuat kembali chapter ini.
                  </p>
                </div>
                <button
                  onClick={() => setRetryTrigger(prev => prev + 1)}
                  className="px-6 h-9 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-lg font-black tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-[0_4px_10px_rgba(246,207,128,0.2)] active:scale-95"
                >
                  🔄 Coba Lagi
                </button>
              </div>
            )}
          </div>

          {/* Bottom Chapter Navigation Controls */}
          {!isReaderLoading && readerData && readerData.image && (
            <div className="flex justify-between items-center gap-4 bg-[#16161a] border border-white/5 rounded-2xl p-4 mt-6 mb-10 shadow-xl">
              <button
                onClick={() => navigateChapter('prev')}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 flex-1 justify-center"
              >
                ◀️ Chapter Sblm
              </button>
              <button
                onClick={() => navigateChapter('next')}
                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 flex-1 justify-center"
              >
                Chapter Brkt ▶️
              </button>
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  );
}
