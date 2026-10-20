import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Anichin rotated its domain: anichin.cafe is dead (NXDOMAIN, delegation dropped).
// Main site is anichin.moe (anichin.care is only the official landing page).
const API_BASE = 'https://anichin.moe';

// Anichin serves relative paths (/wp-content/..., /slug/) -> make them absolute
// so the CORS proxy gets a full URL.
const absUrl = (url) => {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Jalur utama: proxy SAME-ORIGIN lewat rewrite Vercel (/anichin/* -> anichin.moe).
// Alasan: *.workers.dev di-DNS-hijack sebagian operator (mis. XL Axiata ->
// blockpage.xlaxiata.id), jadi fetch ke worker gagal total dan halaman kosong.
// Same-origin juga menghapus kebutuhan CORS.
const ANICHIN_HOSTS = /(^|\.)anichin\.(moe|care|cafe)$/i;

const anichinPath = (url) => {
  const abs = absUrl(url);
  if (!abs) return '';
  try {
    const u = new URL(abs);
    if (!ANICHIN_HOSTS.test(u.hostname)) return null;
    return `/api/anichin?path=${encodeURIComponent(u.pathname + u.search)}`;
  } catch {
    return null;
  }
};

const getApiUrl = (url) => {
  const same = anichinPath(url);
  if (same) return same;
  return `https://cf.tiyanstores.workers.dev/?url=${encodeURIComponent(absUrl(url))}`;
};

const getProxyUrl = (url) => {
  const abs = absUrl(url);
  if (!abs) return '';
  const same = anichinPath(abs);
  if (same) return same;
  // Host lain (embed/streaming pihak ketiga) tetap lewat worker.
  return `https://cf.tiyanstores.workers.dev/?url=${encodeURIComponent(abs)}`;
};

// Resizer poster.
// Poster asli dari anichin.moe besarnya 60-500 KB (sampai 960x1280 px), padahal
// di kartu cuma dipakai 120x180 px. Browser tetap harus decode resolusi penuh
// (~4,9 MB bitmap per gambar), dan di halaman Donghua ada >100 kartu -> itu
// penyebab utama scroll berat. wsrv.nl bikin versi kecil + webp: payload turun
// ~90% dan beban decode ikut turun drastis.
const wsrvUrl = (url, width) => {
  const abs = absUrl(url);
  if (!abs) return '';
  if (!/^https?:/i.test(abs)) return abs;
  return `https://wsrv.nl/?url=${encodeURIComponent(abs)}&w=${width}&output=webp&q=72&we`;
};

// Kalau resizer gagal (host down / rate limit), <img> balik ke proxy biasa.
// data-fallback menjaga supaya tidak terjadi loop onError tanpa henti.
const onImgError = (e) => {
  const el = e.currentTarget;
  if (!el || el.dataset.fallback === '1') return;
  const raw = el.dataset.raw;
  if (!raw) return;
  el.dataset.fallback = '1';
  el.src = getProxyUrl(raw);
};

const Shimmer = () => (
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] z-10" style={{ transform: 'skewX(-20deg)' }} />
);

const CardSkeleton = () => (
  <div className="min-w-[120px] w-[120px] md:min-w-[145px] md:w-[145px] flex flex-col gap-2 relative shrink-0">
    <div className="aspect-[3/4.5] bg-[#16161a] rounded-xl relative overflow-hidden border border-white/5 shadow-xl">
      <Shimmer />
    </div>
    <div className="w-3/4 h-3 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
    <div className="w-1/2 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
  </div>
);

const HeroBanner = React.memo(function HeroBanner({ slides, isLoading, onOpen }) {
  const [idx, setIdx] = useState(0);
  const total = Math.min(slides.length, 5);

  // Rotasi banner dipindah ke dalam komponen ini. Sebelumnya interval 6 detik
  // ada di komponen halaman -> setiap rotasi me-render ulang SEMUA kartu
  // (>100 kartu) dan membuat scroll tersendat.
  useEffect(() => {
    if (total < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % total), 6000);
    return () => clearInterval(t);
  }, [total]);

  if (isLoading) {
    return (
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
    );
  }

  if (!slides.length) return null;
  const slide = slides[idx] || {};

  return (
    <div className="w-full h-full relative animate-[fadeIn_0.5s_ease-out]">
      {/* Latar: versi 60px saja lalu dibesarkan object-cover -> sudah buram
          sendiri, jadi tidak perlu filter blur yang mahal tiap frame. */}
      <img
        src={wsrvUrl(slide.poster, 60) || getProxyUrl(slide.poster)}
        data-raw={slide.poster}
        onError={onImgError}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover opacity-40 scale-105"
        fetchPriority="low"
        decoding="async"
        alt=""
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent"></div>
      <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 flex items-end gap-4 md:gap-6 z-10 w-[calc(100%-48px)] md:w-[calc(100%-96px)] max-w-7xl mx-auto">
        <img
          src={wsrvUrl(slide.poster, 400) || getProxyUrl(slide.poster)}
          data-raw={slide.poster}
          onError={onImgError}
          referrerPolicy="no-referrer"
          className="w-20 md:w-36 aspect-[3/4.5] object-cover rounded-xl shadow-2xl border border-white/10 shrink-0"
          fetchPriority="high"
          decoding="async"
          alt={slide.title}
        />
        <div className="flex flex-col text-left mb-1 md:mb-2 gap-1 md:gap-2 flex-1 min-w-0">
          <div className="flex gap-2 items-center">
            <span className="bg-[#F6CF80]/20 text-[#F6CF80] text-[9px] md:text-xs font-black uppercase px-2 py-0.5 rounded-full w-max border border-[#F6CF80]/30 tracking-wider">
              Featured Donghua
            </span>
            {slide.status && (
              <span className="bg-white/5 text-white/50 text-[9px] md:text-xs font-black uppercase px-2 py-0.5 rounded-full w-max border border-white/10 tracking-wider">
                {slide.status}
              </span>
            )}
          </div>
          <h2 className="text-base md:text-3xl font-black text-white tracking-tight leading-tight line-clamp-2">
            {slide.title}
          </h2>
          <div className="flex items-center gap-2 mt-1 md:mt-2">
            <button
              onClick={() => onOpen(slide)}
              className="h-8 md:h-10 px-5 md:px-6 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-lg font-black tracking-wider text-[10px] md:text-xs flex items-center justify-center gap-1.5 transition-colors shadow-[0_4px_14px_rgba(246,207,128,0.3)] cursor-pointer"
            >
              <span className="leading-none">Tonton Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

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

const extractSlugFromUrl = (url) => {
  if (!url) return '';
  const clean = url.replace(/\/$/, '');
  const parts = clean.split('/');
  return parts[parts.length - 1];
};

const parseBsxCards = (container) => {
  if (!container) return [];
  const cards = [];
  container.querySelectorAll('.bsx').forEach(el => {
    const a = el.querySelector('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const title = a.getAttribute('title') || el.querySelector('.tt')?.textContent?.trim() || '';
    const img = el.querySelector('img');
    const rawPoster = img?.getAttribute('src') || img?.getAttribute('data-lazy-src') || img?.getAttribute('data-src') || '';
    const poster = absUrl(rawPoster);
    const sub = el.querySelector('.sb')?.textContent?.trim() || '';
    const status = el.querySelector('.epx')?.textContent?.trim() || '';

    cards.push({
      title,
      anichinUrl: href,
      slug: extractSlugFromUrl(href),
      poster,
      sub,
      status
    });
  });
  return cards;
};

const findBixboxByHeader = (doc, titleText) => {
  const bixboxes = doc.querySelectorAll('.bixbox');
  for (const box of bixboxes) {
    const h3 = box.querySelector('h3, h2, h1');
    if (h3 && h3.textContent.toLowerCase().includes(titleText.toLowerCase())) {
      return box;
    }
  }
  return null;
};

export default function Donghua() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'home';
  const activeSlug = searchParams.get('slug') || '';
  const activeUrl = searchParams.get('url') || '';

  // Manual retry trigger to re-fetch on rate-limiting or network issues
  const [retryTrigger, setRetryTrigger] = useState(0);

  const setDonghuaView = (newView, params = {}, options = {}) => {
    const nextParams = new URLSearchParams();
    nextParams.set('view', newView);
    if (newView === 'details' || newView === 'watch') {
      const slugVal = params.slug || activeSlug;
      const urlVal = params.url || activeUrl;
      if (slugVal) nextParams.set('slug', slugVal);
      if (urlVal) nextParams.set('url', urlVal);
    }
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') {
        nextParams.delete(k);
      } else if (k !== 'slug' && k !== 'url') {
        nextParams.set(k, String(v));
      }
    });
    setSearchParams(nextParams, options);
  };

  const hasFetchedRef = useRef(false);
  const localCache = getCachedData('nefusoft_donghua_home_cache_v4');
  const memoryCache = window.__NEFUSOFT_DONGHUA_CACHE__ || localCache;

  // Lists & State
  const [popular, setPopular] = useState(memoryCache?.popular || []);
  const [ongoing, setOngoing] = useState(memoryCache?.ongoing || []);
  const [updates, setUpdates] = useState(memoryCache?.updates || []);
  const [rating, setRating] = useState(memoryCache?.rating || []);
  const [completed, setCompleted] = useState(memoryCache?.completed || []);
  const [genres, setGenres] = useState(memoryCache?.genres || []);
  const [schedule, setSchedule] = useState(memoryCache?.schedule || []);
  const [activeDay, setActiveDay] = useState(memoryCache?.activeDay || '');

  // Loading states
  const [isHomeLoading, setIsHomeLoading] = useState(!memoryCache);

  // Browse/Filter States
  const [browseResults, setBrowseResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('list'); // 'list', 'ongoing', 'completed', 'popular', 'rating', 'update'
  const [browsePage, setBrowsePage] = useState(1);
  const [isBrowseLoading, setIsBrowseLoading] = useState(false);

  // Details States
  const [detailsData, setDetailsData] = useState(null);
  const [episodesList, setEpisodesList] = useState([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [episodeSearch, setEpisodeSearch] = useState('');

  // Watch States
  const [watchData, setWatchData] = useState(null);
  const [isWatchLoading, setIsWatchLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  // Fetch Home Data
  useEffect(() => {
    if (view !== 'home') return;

    // Use lightweight cache if already loaded in session
    if (hasFetchedRef.current && retryTrigger === 0) {
      setIsHomeLoading(false);
      return;
    }

    const fetchHomeData = async () => {
      if (!localCache && popular.length === 0) {
        setIsHomeLoading(true);
      }
      try {
        // Fetch Home, Ongoing and Completed in parallel
        const [homeHtml, ongoingHtml, completedHtml] = await Promise.all([
          fetch(getApiUrl(API_BASE)).then(r => r.text()).catch(() => ''),
          fetch(getApiUrl(`${API_BASE}/ongoing/`)).then(r => r.text()).catch(() => ''),
          fetch(getApiUrl(`${API_BASE}/completed/`)).then(r => r.text()).catch(() => '')
        ]);

        const parser = new DOMParser();

        // 1. Parse Home Elements
        const homeDoc = parser.parseFromString(homeHtml, 'text/html');

        // Banners slider
        const popData = [];
        homeDoc.querySelectorAll('.swiper-slide.item').forEach(el => {
          const backdropEl = el.querySelector('.backdrop');
          let poster = '';
          if (backdropEl) {
            const style = backdropEl.getAttribute('style') || '';
            const match = style.match(/url\(['\"]?([^'\"]+)['\"]?\)/);
            if (match) poster = absUrl(match[1]);
          }
          const a = el.querySelector('h2 a');
          const title = a?.textContent?.trim() || '';
          const href = a?.getAttribute('href') || '';
          if (title && href) {
            popData.push({
              title,
              anichinUrl: href,
              slug: extractSlugFromUrl(href),
              poster,
              status: 'Featured'
            });
          }
        });

        // If swiper slide is empty, fallback to Popular Today section
        const popularTodayBox =
          findBixboxByHeader(homeDoc, 'Popular Today') ||
          findBixboxByHeader(homeDoc, 'Popular Series') ||
          findBixboxByHeader(homeDoc, 'Terpopuler') ||
          findBixboxByHeader(homeDoc, 'Popular');
        const fallbackPopular = parseBsxCards(popularTodayBox);

        // Latest Updates
        const latestBox = findBixboxByHeader(homeDoc, 'Latest Release') || findBixboxByHeader(homeDoc, 'update') || findBixboxByHeader(homeDoc, 'terbaru');
        const updData = parseBsxCards(latestBox);

        // Genres list
        const genData = [];
        const genreUl = homeDoc.querySelector('ul.genre, .genre, ul.taxlist');
        if (genreUl) {
          genreUl.querySelectorAll('li a').forEach(a => {
            genData.push({
              name: a.textContent.trim(),
              slug: extractSlugFromUrl(a.getAttribute('href'))
            });
          });
        }
        // New Anichin layout has no genre <ul> on the homepage: harvest genre
        // links from the series cards instead so the genre filter still works.
        if (genData.length === 0) {
          const seen = new Set();
          homeDoc.querySelectorAll('a[href*="/genres/"]').forEach(a => {
            const name = a.textContent?.trim() || '';
            const slug = extractSlugFromUrl(a.getAttribute('href') || '');
            if (!name || !slug || seen.has(slug)) return;
            seen.add(slug);
            genData.push({ name, slug });
          });
        }

        // 2. Parse Ongoing Elements (from the real /ongoing/ archive list page)
        const ongoingDoc = parser.parseFromString(ongoingHtml, 'text/html');
        const ongoingBox = ongoingDoc.querySelector('.listupd') || ongoingDoc;
        const ongData = parseBsxCards(ongoingBox);

        // 3. Parse Completed Elements (from the real /completed/ archive list page)
        const completedDoc = parser.parseFromString(completedHtml, 'text/html');
        const completedBox = completedDoc.querySelector('.listupd') || completedDoc;
        const compData = parseBsxCards(completedBox);

        // Set states
        setPopular(popData.length > 0 ? popData : fallbackPopular);
        setOngoing(ongData);
        setUpdates(updData.slice(0, 20));
        setGenres(genData);
        setCompleted(compData);
        setRating(fallbackPopular); // Use fallback popular for rating as rating is similar

        // Fetch Schedule & Set Day
        const scheduleHtml = await fetch(getApiUrl(`${API_BASE}/schedule/`)).then(r => r.text()).catch(() => '');
        const scheduleDoc = parser.parseFromString(scheduleHtml, 'text/html');

        const schedData = [];
        const daysEnglish = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        // Loop through all weekday blocks in the schedule HTML
        scheduleDoc.querySelectorAll('.bixbox.schedulepage').forEach(box => {
          const h3 = box.querySelector('h3');
          if (!h3) return;
          const dayName = h3.textContent.trim();
          const donghua_list = parseBsxCards(box);
          if (donghua_list.length > 0) {
            schedData.push({
              day: dayName,
              donghua_list
            });
          }
        });

        // Cache the schedule
        setSchedule(schedData);

        let nextActiveDay = activeDay;
        if (schedData.length > 0) {
          const today = new Date().getDay();
          const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu"];
          const matchDay = schedData.find(s => s.day?.toLowerCase().includes(daysIndo[today].toLowerCase()) || s.day?.toLowerCase().includes(daysEnglish[(today + 6) % 7].toLowerCase()));
          nextActiveDay = matchDay ? matchDay.day : schedData[0].day;
          setActiveDay(nextActiveDay);
        }

        setIsHomeLoading(false);
        hasFetchedRef.current = true;

        const compiled = {
          popular: popData.length > 0 ? popData : fallbackPopular,
          ongoing: ongData,
          // 47 kartu sekaligus bikin DOM + decode gambar meledak. 20 sudah
          // lebih dari cukup untuk slider horizontal.
          updates: updData.slice(0, 20),
          genres: genData,
          rating: fallbackPopular,
          completed: compData,
          schedule: schedData,
          activeDay: nextActiveDay
        };
        window.__NEFUSOFT_DONGHUA_CACHE__ = compiled;
        setCachedData('nefusoft_donghua_home_cache_v4', compiled);
      } catch (e) {
        console.error('Failed to load Donghua Home data', e);
        setIsHomeLoading(false);
      }
    };

    fetchHomeData();
  }, [view, retryTrigger]);

  // Browse and Search API Fetcher
  const fetchBrowseResults = async (page = 1) => {
    setIsBrowseLoading(true);
    try {
      let url = '';
      if (searchQuery.trim()) {
        url = `${API_BASE}/page/${page}/?s=${encodeURIComponent(searchQuery)}`;
      } else if (selectedGenre) {
        const slug = genres.find(g => g.name.toLowerCase() === selectedGenre.toLowerCase())?.slug || selectedGenre.toLowerCase().replace(/\s+/g, '-');
        url = `${API_BASE}/genres/${slug}/page/${page}/`;
      } else {
        if (selectedCategory === 'ongoing') {
          url = `${API_BASE}/ongoing/page/${page}/`;
        } else if (selectedCategory === 'completed') {
          url = `${API_BASE}/completed/page/${page}/`;
        } else {
          url = `${API_BASE}/page/${page}/`;
        }
      }

      const resHtml = await fetch(getApiUrl(url)).then(r => r.text());
      const parser = new DOMParser();
      const doc = parser.parseFromString(resHtml, 'text/html');
      const cards = parseBsxCards(doc);

      setBrowseResults(cards);
      setBrowsePage(page);
    } catch (e) {
      console.error('Failed to fetch browse/search results', e);
      setBrowseResults([]);
    } finally {
      setIsBrowseLoading(false);
    }
  };

  // Trigger browse list load
  useEffect(() => {
    if (view === 'browse') {
      fetchBrowseResults(1);
    }
  }, [view, selectedCategory, selectedGenre]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSelectedGenre('');
    fetchBrowseResults(1);
  };

  // Fetch Series Details
  useEffect(() => {
    if (view === 'details' && activeUrl) {
      const loadDetails = async () => {
        setIsDetailsLoading(true);
        setDetailsData(null);
        setEpisodesList([]);
        setEpisodeSearch('');
        try {
          const resHtml = await fetch(getProxyUrl(activeUrl)).then(r => r.text());
          const parser = new DOMParser();
          const doc = parser.parseFromString(resHtml, 'text/html');

          const title = doc.querySelector('h1.entry-title')?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || '';
          const alt_title = doc.querySelector('.alter')?.textContent?.trim() || '';
          const poster = absUrl(doc.querySelector('.thumb img')?.getAttribute('src') || '');
          const synopsis = doc.querySelector('.entry-content[itemprop="description"]')?.innerHTML?.trim() || doc.querySelector('.entry-content')?.innerHTML?.trim() || '';

          const info = {};
          doc.querySelectorAll('.spe span').forEach(span => {
            const bold = span.querySelector('b');
            if (bold) {
              const key = bold.textContent.replace(':', '').trim().toLowerCase();
              const temp = span.cloneNode(true);
              const bTag = temp.querySelector('b');
              if (bTag) temp.removeChild(bTag);
              const val = temp.textContent.trim();
              info[key] = val;
            }
          });

          const genresList = [];
          doc.querySelectorAll('.genxed a').forEach(a => {
            genresList.push({
              name: a.textContent.trim(),
              slug: extractSlugFromUrl(a.getAttribute('href'))
            });
          });

          const episodes_list = [];
          doc.querySelectorAll('.eplister ul li').forEach(li => {
            const a = li.querySelector('a');
            if (!a) return;
            const href = a.getAttribute('href') || '';
            const num = li.querySelector('.epl-num')?.textContent?.trim() || '';
            const epTitle = li.querySelector('.epl-title')?.textContent?.trim() || '';
            const date = li.querySelector('.epl-date')?.textContent?.trim() || '';

            episodes_list.push({
              episode: `Episode ${num}`,
              anichinUrl: href,
              slug: extractSlugFromUrl(href),
              title: epTitle,
              date
            });
          });

          setDetailsData({
            title,
            alt_title,
            poster,
            synopsis,
            info,
            genres: genresList,
            episodes_list
          });
          setEpisodesList(episodes_list);
        } catch (e) {
          console.error('Failed to fetch series details', e);
        } finally {
          setIsDetailsLoading(false);
        }
      };
      loadDetails();
    }
  }, [view, activeUrl, retryTrigger]);

  // Fetch Episode Watch Info
  useEffect(() => {
    if (view === 'watch' && activeUrl) {
      const loadWatch = async () => {
        setIsWatchLoading(true);
        setWatchData(null);
        setSelectedServer(null);
        try {
          const resHtml = await fetch(getProxyUrl(activeUrl)).then(r => r.text());
          const parser = new DOMParser();
          const doc = parser.parseFromString(resHtml, 'text/html');

          const episodeTitle = doc.querySelector('h1.entry-title')?.textContent?.trim() || doc.querySelector('h1')?.textContent?.trim() || '';
          const mainIframe = doc.querySelector('.player-embed iframe')?.getAttribute('src') || doc.querySelector('#embed_holder iframe')?.getAttribute('src') || '';

          const servers = [];
          doc.querySelectorAll('select.mirror option').forEach(opt => {
            const value = opt.getAttribute('value') || '';
            const label = opt.textContent?.trim() || '';
            if (!value) return; // Skip select video server placeholder

            let url = '';
            try {
              const decodedHtml = atob(value);
              const match = decodedHtml.match(/src=["']([^"']+)["']/i);
              url = match ? match[1] : decodedHtml;
            } catch (e) {
              url = value;
            }

            servers.push({
              name: label,
              url
            });
          });

          const defaultServer = {
            name: 'Default',
            url: mainIframe
          };

          const download_url = {};
          doc.querySelectorAll('.soraurlx').forEach(el => {
            const strong = el.querySelector('strong');
            if (!strong) return;
            const quality = strong.textContent.trim().toLowerCase();
            const links = {};
            el.querySelectorAll('a').forEach(a => {
              const serverName = a.textContent.trim();
              const href = a.getAttribute('href') || '';
              if (href) {
                links[serverName] = href;
              }
            });
            if (Object.keys(links).length > 0) {
              download_url[`download_url_${quality}`] = links;
            }
          });

          const parsedWatchData = {
            episode: episodeTitle,
            streaming: {
              main_url: defaultServer,
              servers: servers.length > 0 ? servers : [defaultServer]
            },
            download_url
          };

          setWatchData(parsedWatchData);

          if (parsedWatchData.streaming?.main_url?.url) {
            setSelectedServer(parsedWatchData.streaming.main_url);
          } else if (parsedWatchData.streaming?.servers?.length > 0) {
            setSelectedServer(parsedWatchData.streaming.servers[0]);
          }

          // If episodesList is empty, let's fetch the detail page of the series to get the navigation
          if (episodesList.length === 0) {
            const allEpisodesUrl = doc.querySelector('.naveps .nvsc a')?.getAttribute('href') || '';
            if (allEpisodesUrl) {
              try {
                const detailHtml = await fetch(getProxyUrl(allEpisodesUrl)).then(r => r.text());
                const detailDoc = parser.parseFromString(detailHtml, 'text/html');
                const eps = [];
                detailDoc.querySelectorAll('.eplister ul li').forEach(li => {
                  const a = li.querySelector('a');
                  if (!a) return;
                  const href = a.getAttribute('href') || '';
                  const num = li.querySelector('.epl-num')?.textContent?.trim() || '';
                  const epTitle = li.querySelector('.epl-title')?.textContent?.trim() || '';
                  const date = li.querySelector('.epl-date')?.textContent?.trim() || '';

                  eps.push({
                    episode: `Episode ${num}`,
                    anichinUrl: href,
                    slug: extractSlugFromUrl(href),
                    title: epTitle,
                    date
                  });
                });
                setEpisodesList(eps);
              } catch (err) {
                console.error('Failed to load sibling episodes', err);
              }
            }
          }

          window.scrollTo(0, 0);
        } catch (e) {
          console.error('Failed to load episode watch data', e);
        } finally {
          setIsWatchLoading(false);
        }
      };
      loadWatch();
    }
  }, [view, activeUrl, retryTrigger]);

  // Navigate Episode inside watch view
  const handleEpisodeNavigate = (direction) => {
    if (!watchData || !episodesList || episodesList.length === 0) return;
    // Extract current index
    const currentEpisodeUrl = activeUrl;
    const currIdx = episodesList.findIndex(ep => ep.anichinUrl === currentEpisodeUrl || ep.href?.includes(encodeURIComponent(currentEpisodeUrl)));
    if (currIdx === -1) return;

    // Notice: episode lists are normally descending (Episode newest first), so:
    // Prev Episode: is actually at index currIdx + 1 (lower episode index)
    // Next Episode: is at index currIdx - 1 (higher episode index)
    let nextEp = null;
    if (direction === 'next' && currIdx > 0) {
      nextEp = episodesList[currIdx - 1];
    } else if (direction === 'prev' && currIdx < episodesList.length - 1) {
      nextEp = episodesList[currIdx + 1];
    }

    if (nextEp) {
      setDonghuaView('watch', { slug: activeSlug, url: nextEp.anichinUrl }, { replace: true });
    }
  };

  // Filter episodes list
  const filteredEpisodes = episodesList.filter(ep => {
    return (ep.episode || '').toLowerCase().includes(episodeSearch.toLowerCase());
  });

  // Extract clean iframe source from dynamic strings
  const getEmbedSrc = (server) => {
    if (!server) return '';
    const rawUrl = server.url;
    if (!rawUrl) return '';
    if (rawUrl.includes('<iframe') || rawUrl.includes('<IFRAME')) {
      const match = rawUrl.match(/src=["']([^"']+)["']/i);
      return match ? match[1] : '';
    }
    return rawUrl;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white relative">

      <Navbar />

      {/* HEADER HERO BANNER FOR HOME */}
      {view === 'home' && (
        <div className="relative w-full aspect-[16/10] md:aspect-video min-h-[250px] md:max-h-[480px] overflow-hidden bg-[#0f0f12]">
          <HeroBanner
            slides={popular}
            isLoading={isHomeLoading}
            onOpen={(slide) => setDonghuaView('details', { slug: slide.slug, url: slide.anichinUrl })}
          />
        </div>
      )}

      {/* VIEW: HOME PORTAL */}
      {view === 'home' && (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6">

          {/* Quick Filter Menu and Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 bg-[#16161a]/40 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <span className="bg-white/5 p-2 rounded-xl border border-white/10">🇨🇳</span>
              <div>
                <h3 className="text-white font-black text-sm uppercase tracking-wide">Portal Donghua</h3>
                <p className="text-white/40 text-[10px] md:text-xs font-bold">Koleksi animasi 3D & 2D China sub Indo terlengkap!</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedCategory('list');
                  setDonghuaView('browse');
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-xs font-black text-[#F6CF80] transition-all cursor-pointer flex items-center gap-1.5"
              >
                🔍 Cari Donghua
              </button>
            </div>
          </div>

          {/* Render sliders */}
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
                    {list.map((item, idx) => {
                      const isPreloadImg = idx < 2;
                      return (
                        <div
                          key={`${item.slug}-${idx}`}
                          onClick={() => setDonghuaView('details', { slug: item.slug, url: item.anichinUrl })}
                          className="min-w-[120px] w-[120px] md:min-w-[145px] md:w-[145px] group cursor-pointer snap-start"
                        >
                          <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-xl border border-white/5 shadow-xl group-hover:border-[#F6CF80]/40">
                            <img
                              src={wsrvUrl(item.poster, 300) || getProxyUrl(item.poster)}
                              data-raw={item.poster}
                              onError={onImgError}
                              referrerPolicy="no-referrer"
                              loading={isPreloadImg ? "eager" : "lazy"}
                              fetchPriority={isPreloadImg ? "high" : "low"}
                              decoding="async"
                              className="w-full h-full object-cover"
                              alt={item.title}
                            />
                            {item.sub && (
                              <div className="absolute top-2 left-2 bg-black/85 text-[#F6CF80] text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
                                🎬 {item.sub}
                              </div>
                            )}
                            {item.status && (
                              <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">
                                {item.status}
                              </div>
                            )}
                          </div>
                          <h3 className="text-[10px] md:text-xs font-bold text-white/80 line-clamp-1 mt-2 group-hover:text-[#F6CF80] transition-colors">
                            {item.title}
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
              popular.length === 0 &&
              ongoing.length === 0 &&
              updates.length === 0;

            if (isHomeEmpty) {
              return (
                <div className="text-center py-12 px-6 bg-[#16161a]/60 border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center gap-4 max-w-md mx-auto shadow-2xl my-10">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl text-red-400">
                    ⚠️
                  </div>
                  <div className="text-center">
                    <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Donghua</h3>
                    <p className="text-white/50 text-[11px] font-bold mt-1 leading-relaxed">
                      Terjadi gangguan koneksi, limit server, atau data gagal diambil dari Portal API. Silakan coba lagi.
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
                {renderSlider('Donghua Sedang Tayang (Ongoing)', 'Update episode rilis mingguan', ongoing)}
                {renderSlider('Donghua Populer', 'Judul terpopuler di kalangan penggemar', popular)}
                {renderSlider('Rilis Episode Terbaru', 'Update rilis sub Indo paling fresh', updates)}
                {renderSlider('Rating Tertinggi', 'Berdasarkan penilaian terbaik audiens', rating)}
                {renderSlider('Donghua Tamat (Completed)', 'Tonton maraton seri yang telah tamat', completed)}

                {/* DAY SCHEDULE SECTION */}
                {schedule.length > 0 && (
                  <section className="mb-10 bg-[#16161a]/20 border border-white/5 rounded-3xl p-6 backdrop-blur-xl lazy-section">
                    <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight leading-none mb-1">Jadwal Rilis Donghua</h2>
                    <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block mb-6">Waktu update rilis mingguan donghua</span>

                    {/* Day tabs */}
                    <div className="flex overflow-x-auto gap-2 pb-4 border-b border-white/5 custom-scrollbar mb-6 no-scrollbar">
                      {schedule.map((s) => (
                        <button
                          key={s.day}
                          onClick={() => setActiveDay(s.day)}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 border ${
                            activeDay === s.day
                              ? 'bg-[#F6CF80] text-black border-[#F6CF80] shadow-[0_4px_12px_rgba(246,207,128,0.25)]'
                              : 'bg-white/5 text-white/70 border-transparent hover:bg-white/10'
                          }`}
                        >
                          {s.day}
                        </button>
                      ))}
                    </div>

                    {/* Day list content */}
                    {(() => {
                      const daySched = schedule.find(s => s.day === activeDay);
                      const list = daySched ? daySched.donghua_list : [];
                      if (!list || list.length === 0) {
                        return (
                          <div className="text-center py-8 text-white/30 text-xs font-bold">
                            Tidak ada rilis terjadwal untuk hari ini.
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {list.map((item, idx) => (
                            <div
                              key={`${item.slug}-${idx}`}
                              onClick={() => setDonghuaView('details', { slug: item.slug, url: item.anichinUrl })}
                              className="group cursor-pointer flex flex-col"
                            >
                              <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-xl border border-white/5 shadow-lg group-hover:border-[#F6CF80]/40">
                                <img
                                  src={wsrvUrl(item.poster, 300) || getProxyUrl(item.poster)}
                                  data-raw={item.poster}
                                  onError={onImgError}
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover"
                                  alt={item.title}
                                />
                                {item.episode && (
                                  <div className="absolute top-2 left-2 bg-black/85 text-[#F6CF80] text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10">
                                    Eps {item.episode}
                                  </div>
                                )}
                              </div>
                              <h3 className="text-[10px] md:text-xs font-bold text-white/80 line-clamp-1 mt-2 group-hover:text-[#F6CF80] transition-colors">
                                {item.title}
                              </h3>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </section>
                )}

                {/* Genre filter list */}
                {genres.length > 0 && (
                  <section className="mb-10 bg-[#16161a]/20 border border-white/5 rounded-3xl p-6 backdrop-blur-xl lazy-section">
                    <h2 className="text-base md:text-lg font-black text-white uppercase tracking-tight mb-4">Temukan Berdasarkan Genre</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                      {genres.map((g) => {
                        // Skip raw alphabetical index tags returned in some endpoints
                        if (g.name.length === 1) return null;
                        return (
                          <button
                            key={g.slug}
                            onClick={() => {
                              setSelectedGenre(g.name);
                              setDonghuaView('browse');
                            }}
                            className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:scale-102 border border-white/5 hover:border-[#F6CF80] rounded-xl px-4 py-3 text-xs font-bold text-white/80 transition-all cursor-pointer text-center truncate"
                          >
                            {g.name}
                          </button>
                        );
                      })}
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

            {/* Left Sidebar Filter Section */}
            <div className="w-full lg:w-64 shrink-0 flex flex-col gap-4">
              <div className="bg-[#16161a] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="text-white font-black text-xs uppercase tracking-wide border-b border-white/5 pb-2">Filter Pencarian</h3>

                {/* Search Text Form */}
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

                {/* Category selectors */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-[9px] font-black uppercase">Kategori</label>
                  <select
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-[#F6CF80]"
                    value={selectedCategory}
                    disabled={!!searchQuery.trim() || !!selectedGenre}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="list">Semua (List)</option>
                    <option value="ongoing">Sedang Tayang (Ongoing)</option>
                    <option value="completed">Tamat (Completed)</option>
                    <option value="popular">Populer (Popular)</option>
                    <option value="update">Update Terbaru</option>
                    <option value="rating">Rating Tertinggi</option>
                  </select>
                </div>

                {/* Genre Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-white/40 text-[9px] font-black uppercase">Genre</label>
                  <select
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/80 outline-none focus:border-[#F6CF80]"
                    value={selectedGenre}
                    onChange={(e) => {
                      setSelectedGenre(e.target.value);
                      if (e.target.value) {
                        setSearchQuery('');
                      }
                    }}
                  >
                    <option value="">Pilih Genre</option>
                    {genres.map(g => {
                      if (g.name.length === 1) return null;
                      return <option key={g.slug} value={g.name}>{g.name}</option>;
                    })}
                  </select>
                </div>

                {/* Actions */}
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGenre('');
                    setSelectedCategory('list');
                  }}
                  className="bg-white/5 hover:bg-white/10 border border-white/5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer text-center"
                >
                  Reset Filter
                </button>

                <button
                  onClick={() => setDonghuaView('home')}
                  className="bg-white/5 hover:bg-[#F6CF80] hover:text-black border border-white/5 py-2.5 rounded-xl text-xs font-bold text-white transition-all cursor-pointer text-center"
                >
                  Kembali ke Dashboard
                </button>
              </div>
            </div>

            {/* Right Main Grid Section */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex justify-between items-center bg-[#16161a] border border-white/5 px-5 py-4 rounded-2xl">
                <span className="text-white font-black text-xs uppercase tracking-wider">
                  {searchQuery.trim()
                    ? `Hasil Pencarian: "${searchQuery}"`
                    : selectedGenre
                      ? `Genre: ${selectedGenre}`
                      : `Daftar Donghua : ${selectedCategory}`}
                </span>
                <span className="text-white/40 text-[10px] font-bold">Halaman {browsePage}</span>
              </div>

              {isBrowseLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : browseResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 lazy-grid">
                  {browseResults.map((item, idx) => (
                    <div
                      key={`${item.slug}-${idx}`}
                      onClick={() => setDonghuaView('details', { slug: item.slug, url: item.anichinUrl })}
                      className="group cursor-pointer flex flex-col"
                    >
                      <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-xl border border-white/5 shadow-xl group-hover:border-[#F6CF80]/40">
                        <img
                          src={wsrvUrl(item.poster, 300) || getProxyUrl(item.poster)}
                          data-raw={item.poster}
                          onError={onImgError}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          alt={item.title}
                        />
                        {item.sub && (
                          <div className="absolute top-2 left-2 bg-black/85 text-[#F6CF80] text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 flex items-center gap-0.5">
                            🎬 {item.sub}
                          </div>
                        )}
                        {item.status && (
                          <div className="absolute bottom-2 right-2 bg-black/85 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10 uppercase">
                            {item.status}
                          </div>
                        )}
                      </div>
                      <h3 className="text-[10px] md:text-xs font-bold text-white/80 line-clamp-1 mt-2 group-hover:text-[#F6CF80] transition-colors">
                        {item.title}
                      </h3>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-white/30 text-xs font-bold bg-[#16161a]/20 border border-white/5 rounded-3xl">
                  Donghua tidak ditemukan dengan filter di atas.
                </div>
              )}

              {/* Browse Pagination */}
              {!searchQuery.trim() && (
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
                    disabled={browseResults.length < 30}
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

          <div className="mb-4">
            <button
              onClick={() => setDonghuaView('home')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-[#F6CF80] transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:scale-102 active:scale-98"
            >
              <svg className="w-4 h-4 text-[#F6CF80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali ke Dashboard</span>
            </button>
          </div>

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
            const info = detailsData.info || {};
            return (
              <div className="flex flex-col gap-6">
                {/* Details Header Info Block */}
                <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 relative overflow-hidden shadow-2xl animate-[fadeIn_0.5s_ease-out]">

                  <img
                    src={wsrvUrl(detailsData.poster, 520) || getProxyUrl(detailsData.poster)}
                    data-raw={detailsData.poster}
                    onError={onImgError}
                    referrerPolicy="no-referrer"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="w-full md:w-52 aspect-[3/4.5] object-cover rounded-2xl border border-white/10 shrink-0 z-10 shadow-lg"
                    alt={detailsData.title}
                  />

                  <div className="flex-1 flex flex-col gap-3 text-left z-10">
                    <div className="flex gap-2 items-center flex-wrap">
                      {info.type && (
                        <span className="bg-[#F6CF80]/20 text-[#F6CF80] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-[#F6CF80]/30 tracking-wider">
                          {info.type}
                        </span>
                      )}
                      {info.status && (
                        <span className="bg-white/5 text-white/60 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-white/10 tracking-wider">
                          {info.status}
                        </span>
                      )}
                      {info.country && (
                        <span className="bg-white/5 text-white/50 text-[10px] font-bold px-2 py-0.5 rounded border border-white/5">
                          {info.country}
                        </span>
                      )}
                    </div>

                    <h1 className="text-xl md:text-3xl font-black text-white tracking-tight leading-tight">
                      {detailsData.title}
                    </h1>

                    {detailsData.alt_title && (
                      <p className="text-white/40 text-[10px] md:text-xs font-bold leading-none">
                        {detailsData.alt_title}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-white/60 border-t border-b border-white/5 py-3">
                      {info.released && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider block">Dirilis</span> {info.released}</p>
                      )}
                      {info.duration && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider block">Durasi</span> {info.duration}</p>
                      )}
                      {info.episodes && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider block">Total Episode</span> {info.episodes}</p>
                      )}
                      {info.network && (
                        <p><span className="font-bold text-white/40 uppercase text-[9px] tracking-wider block">Network</span> {info.network}</p>
                      )}
                    </div>

                    {/* Genres */}
                    {detailsData.genres && detailsData.genres.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {detailsData.genres.map(g => (
                          <span
                            key={g.slug}
                            className="bg-white/5 border border-white/5 text-white/80 text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-lg"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Episodes List panel */}
                <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-4 shadow-2xl">
                  <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-white/5 pb-4">
                    <h2 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                      🎬 Daftar Episode ({episodesList.length})
                    </h2>
                    <input
                      type="text"
                      placeholder="Cari episode..."
                      className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-[#F6CF80] w-full md:w-48"
                      value={episodeSearch}
                      onChange={(e) => setEpisodeSearch(e.target.value)}
                    />
                  </div>

                  {filteredEpisodes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                      {filteredEpisodes.map((ep, idx) => {
                        return (
                          <button
                            key={`${ep.slug}-${idx}`}
                            onClick={() => setDonghuaView('watch', { slug: activeSlug, url: ep.anichinUrl })}
                            className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] border border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-white/80 text-left transition-all cursor-pointer truncate"
                          >
                            <span>{ep.episode}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-white/30 text-xs font-bold">
                      Episode tidak ditemukan.
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
                <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Detail Donghua</h3>
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

      {/* VIEW: WATCH VIEW */}
      {view === 'watch' && (
        <div className="max-w-4xl mx-auto px-4 mt-6">

          <div className="mb-4 flex justify-between items-center">
            <button
              onClick={() => {
                setDonghuaView('home');
              }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black text-[#F6CF80] transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:scale-102 active:scale-98"
            >
              <svg className="w-4 h-4 text-[#F6CF80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Kembali ke Dashboard</span>
            </button>
          </div>

          {isWatchLoading ? (
            <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-6 animate-pulse">
              <div className="w-full aspect-video bg-white/5 rounded-2xl"></div>
              <div className="w-1/2 h-6 bg-white/5 rounded"></div>
              <div className="w-full h-12 bg-white/5 rounded"></div>
            </div>
          ) : watchData ? (() => {
            const embedSrc = getEmbedSrc(selectedServer);
            const downloadUrl = watchData.download_url || {};
            const servers = watchData.streaming?.servers || [];
            return (
              <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out]">

                {/* Video streaming box container */}
                <div className="bg-black border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
                  {embedSrc ? (
                    <div className="w-full aspect-video">
                      <iframe
                        src={embedSrc}
                        className="w-full h-full"
                        allowFullScreen
                        scrolling="no"
                        frameBorder="0"
                        title={watchData.episode || "Donghua Streaming"}
                      ></iframe>
                    </div>
                  ) : (
                    <div className="w-full aspect-video flex flex-col items-center justify-center gap-4 bg-[#111] p-6 text-center">
                      <p className="text-white/40 text-xs font-bold">Link streaming tidak tersedia langsung di server ini.</p>
                      {selectedServer?.url && (
                        <a
                          href={selectedServer.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-xl text-xs font-black cursor-pointer shadow-lg"
                        >
                          Buka Link Eksternal
                        </a>
                      )}
                    </div>
                  )}

                  {/* Watch details footer */}
                  <div className="p-4 md:p-6 bg-[#16161a] border-t border-white/5 text-left">
                    <h1 className="text-white font-black text-sm md:text-lg tracking-tight">
                      {watchData.episode}
                    </h1>
                  </div>
                </div>

                {/* Server selection mirror links */}
                {servers.length > 0 && (
                  <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 shadow-2xl text-left">
                    <span className="font-black text-white/40 uppercase text-[9px] tracking-wider block mb-3">PILIH SERVER MIRROR</span>
                    <div className="flex flex-wrap gap-2">
                      {servers.map((srv, idx) => (
                        <button
                          key={`${srv.name}-${idx}`}
                          onClick={() => setSelectedServer(srv)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            selectedServer?.name === srv.name
                              ? 'bg-[#F6CF80] text-black border-[#F6CF80] shadow-[0_4px_10px_rgba(246,207,128,0.2)]'
                              : 'bg-white/5 text-white/80 border-transparent hover:bg-white/10 hover:border-white/10'
                          }`}
                        >
                          {srv.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episode navigation controls */}
                <div className="flex justify-between items-center gap-4 bg-[#16161a] border border-white/5 rounded-2xl p-4 shadow-xl">
                  <button
                    onClick={() => handleEpisodeNavigate('prev')}
                    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 flex-1 justify-center"
                  >
                    ◀️ Episode Sblm
                  </button>
                  <button
                    onClick={() => handleEpisodeNavigate('next')}
                    className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 flex-1 justify-center"
                  >
                    Episode Brkt ▶️
                  </button>
                </div>

                {/* Download url section */}
                {Object.keys(downloadUrl).length > 0 && (
                  <div className="bg-[#16161a] border border-white/5 rounded-3xl p-6 shadow-2xl text-left">
                    <h3 className="font-black text-white uppercase text-xs tracking-wider mb-4 border-b border-white/5 pb-2">
                      💾 Link Download
                    </h3>

                    <div className="flex flex-col gap-4">
                      {Object.entries(downloadUrl).map(([quality, links]) => {
                        const cleanQuality = quality.replace('download_url_', '').toUpperCase();
                        if (!links || typeof links !== 'object') return null;
                        return (
                          <div key={quality} className="flex flex-col gap-2 border-b border-white/5 last:border-b-0 pb-3 last:pb-0">
                            <span className="text-[#F6CF80] font-black text-xs">{cleanQuality}</span>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(links).map(([serverName, url]) => (
                                <a
                                  key={serverName}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-white/5 hover:bg-white/10 border border-white/5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/80 transition-all cursor-pointer"
                                >
                                  {serverName}
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="text-center py-12 px-6 bg-[#16161a]/60 border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center gap-4 max-w-md mx-auto shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl text-red-400">
                ⚠️
              </div>
              <div className="text-center">
                <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Episode Watch</h3>
                <p className="text-white/50 text-[11px] font-bold mt-1 leading-relaxed">
                  Terjadi gangguan koneksi, limit server, atau video gagal diambil dari Portal. Silakan coba lagi.
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

      <Footer />
    </div>
  );
}
