import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mediaUrl } from '../utils/media';

const Welcome = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const[liveResults, setLiveResults] = useState([]);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);

    // Background programmatic prefetching for Home, Explore, Manga, and Donghua lazy chunks
    const timer = setTimeout(() => {
      const prefetchHome = import('./Home');
      const prefetchExplore = import('./Explore');
      const prefetchManga = import('./Manga');
      const prefetchDonghua = import('./Donghua');
      Promise.all([prefetchHome, prefetchExplore, prefetchManga, prefetchDonghua]).catch(() => {});
    }, 1000);

    // Prefetch Home Anime API data in background to ensure zero-delay transitions
    const apiTimer = setTimeout(async () => {
      try {
        const cacheKey = 'nefusoft_home_cache_v3';
        let compiled = window.__NEFUSOFT_CACHE__;
        if (!compiled) {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              compiled = JSON.parse(cached);
              window.__NEFUSOFT_CACHE__ = compiled;
            } catch (e) {}
          }
        }

        if (!compiled) {
          const shuffleArray = (array) => {
            const newArr = [...array];
            for (let i = newArr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
            return newArr;
          };

          const [schRes, ongRes, popRes] = await Promise.all([
            fetch('/api/v1/schedule').then(r => r.json()),
            fetch('/api/v1/ongoing').then(r => r.json()),
            fetch('/api/v1/popular').then(r => r.json())
          ]);

          const schData = schRes.data || {};
          const ongData = ongRes.data || [];
          const popData = popRes.data || [];
          const shuffledOngoing = shuffleArray(ongData);

          compiled = { schedule: schData, ongoing: shuffledOngoing, popular: popData };
          window.__NEFUSOFT_CACHE__ = compiled;
          localStorage.setItem(cacheKey, JSON.stringify(compiled));
        }

        // Preload first anime cover and poster of Home Page's Carousel to achieve 0ms LCP on navigation
        if (compiled && compiled.schedule) {
          const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
          const todayAnime = (compiled.schedule[days[new Date().getDay()]] || []).filter(a => a.status === "ONGOING");
          if (todayAnime.length > 0) {
            const firstAnime = todayAnime[0];
            const firstCover = firstAnime.image_cover || firstAnime.image_poster;
            const firstPoster = firstAnime.image_poster || firstAnime.image_cover;

            if (firstCover) {
              const img = new Image();
              img.src = mediaUrl(firstCover);
            }
            if (firstPoster) {
              const img = new Image();
              img.src = mediaUrl(firstPoster);
            }
          }
        }
      } catch (e) {
        console.error('Failed to pre-cache Home data in background', e);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      clearTimeout(apiTimer);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) { 
      setLiveResults([]); 
      return; 
    }
    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsLiveLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json());
        if (isMounted) setLiveResults(res.data ||[]);
      } catch (e) { 
        if (isMounted) setLiveResults([]); 
      } finally {
        if (isMounted) setIsLiveLoading(false);
      }
    }, 350);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const navLinks = useMemo(() =>[
    { label: 'Home', path: '/home', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/> },
    { label: 'Explore', path: '/explore', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/> },
    { label: 'Ongoing', path: '/ongoing', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/> },
    { label: 'Schedule', path: '/schedule', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/> }
  ],[]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] flex flex-col text-white">
      <nav className="w-full h-24 px-6 md:px-12 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/img/nefusoft.webp" alt="NefuSoft Logo" width="100" height="100" className="w-16 md:w-24 object-contain" fetchPriority="high" />
        </div>
        <div className="flex gap-4 md:gap-6 bg-transparent border border-white/10 px-5 py-2.5 rounded-full shadow-lg">
          {navLinks.map((link, i) => (
            <button key={i} aria-label={link.label} onClick={() => navigate(link.path)} className="text-white hover:text-[#F6CF80] transition-colors p-1">
              <svg className="w-6 h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">{link.icon}</svg>
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-4 pt-2">
        <div className="relative w-full max-w-5xl rounded-[2.5rem] overflow-hidden border border-white/5 shadow-2xl bg-[#0f0f12]">
          <img src="/img/welcomebanner.webp" alt="Hero Banner" width="800" height="450" fetchPriority="high" className="w-full object-cover aspect-square md:aspect-video" />
          <div className="absolute inset-0 bg-black/40"></div>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg relative">
              <div className="flex items-center bg-white rounded-full px-5 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all">
                <svg className="w-5 h-5 text-gray-500 mr-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input type="text" className="w-full bg-transparent text-black text-sm outline-none font-bold placeholder-gray-500" placeholder="Ketik anime yang ingin kamu tonton..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && navigate(searchQuery ? `/explore?q=${searchQuery}` : '/home')} />
                <button onClick={() => navigate('/explore')} className="text-gray-600 font-black text-[10px] ml-2 border-l border-gray-300 pl-3 hover:text-black uppercase tracking-widest flex items-center gap-1 shrink-0 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
                  FILTER
                </button>
              </div>
              {liveResults.length > 0 && (
                <div className="absolute top-[60px] inset-x-0 bg-white rounded-2xl overflow-hidden z-[100] max-h-64 shadow-2xl overflow-y-auto custom-scrollbar">
                  {(() => {
                    const getProxyUrl = mediaUrl;
                    return liveResults.map(r => (
                      <div key={r.id} onClick={() => navigate(`/anime/${r.id}-${(r.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: r } })} className="flex items-center gap-4 p-3 hover:bg-gray-100 border-b border-gray-100 cursor-pointer text-left transition-colors">
                        <img src={getProxyUrl(r.image_poster)} referrerPolicy="no-referrer" alt={r.title} width="40" height="55" loading="lazy" decoding="async" className="w-10 rounded-md shadow-sm" />
                        <div className="flex flex-col"><span className="text-black font-black text-xs line-clamp-1">{r.title}</span><span className="text-gray-500 font-bold text-[9px] uppercase mt-1 tracking-wider">{r.type} • {r.status}</span></div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
          <div className="absolute bottom-10 left-0 right-0 flex justify-center">
             <button onClick={() => navigate('/home')} className="bg-[#F6CF80] hover:bg-[#ebd59b] text-black font-extrabold px-14 py-3.5 rounded-full active:scale-95 transition-all shadow-[0_10px_30px_rgba(246,207,128,0.3)] tracking-widest text-xs uppercase">Masuk Beranda</button>
          </div>
        </div>

        <div className="mt-16 mb-24 flex flex-col items-center text-center px-6">
          <img src="/img/kaguya.webp" alt="Kaguya" width="120" height="120" loading="lazy" decoding="async" className="w-28 md:w-32 object-contain mb-6 drop-shadow-2xl" />
          <h2 className="text-3xl md:text-5xl font-[900] tracking-tighter mb-5">Nefu<span className="text-[#F6CF80]">Soft</span></h2>
          <p className="text-white/60 text-sm md:text-base font-medium leading-relaxed max-w-2xl">NefuSoft provides zero-ad free streaming access to thousands of anime titles. Enjoy streaming anime with high quality subtitles from 360p to 1080p, completely free of charge!</p>
        </div>
      </main>

      <footer className="w-full py-8 px-6 border-t border-white/5 flex flex-col items-center">
        <p className="text-[10px] md:text-[11px] text-white/50 font-bold leading-relaxed max-w-2xl text-center tracking-wide">NefuSoft adalah platform streaming anime pihak ketiga. Kami tidak mengunggah atau menyimpan file video apa pun di server kami. Semua konten disediakan oleh pihak ketiga yang tidak terafiliasi dengan kami.</p>
      </footer>
    </div>
  );
};

export default Welcome;