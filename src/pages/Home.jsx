import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { mediaUrl } from '../utils/media';

const Shimmer = () => (
  <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />
);

const getProxyUrl = mediaUrl;

const HeroSkeleton = () => (
  <div className="w-full h-full bg-[#16161a] relative overflow-hidden flex items-end p-6 md:p-12 gap-4 md:gap-6">
    <div className="w-24 md:w-40 aspect-[3/4.2] bg-white/5 relative overflow-hidden rounded-md shrink-0"><Shimmer /></div>
    <div className="flex flex-col gap-1 md:gap-1.5 flex-1 pb-1 md:pb-2 min-w-0">
      <div className="w-24 h-2 md:h-3 bg-white/5 relative overflow-hidden rounded-sm"><Shimmer /></div>
      <div className="w-1/2 h-6 md:h-8 bg-white/5 relative overflow-hidden rounded-sm"><Shimmer /></div>
      <div className="w-1/3 h-3 md:h-4 bg-white/5 relative overflow-hidden rounded-sm"><Shimmer /></div>
    </div>
  </div>
);

const CardSkeleton = () => (
  <div className="min-w-[105px] flex flex-col gap-2 relative">
    <div className="aspect-[3/4.5] bg-[#16161a] rounded-sm relative overflow-hidden shadow-xl"><Shimmer /></div>
    <div className="w-3/4 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
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

const Home = () => {
  const navigate = useNavigate();
  const localCache = getCachedData('nefusoft_home_cache_v3');
  const [schedule, setSchedule] = useState(window.__NEFUSOFT_CACHE__?.schedule || localCache?.schedule || {});
  const [ongoing, setOngoing] = useState(window.__NEFUSOFT_CACHE__?.ongoing || localCache?.ongoing || []);
  const [popular, setPopular] = useState(window.__NEFUSOFT_CACHE__?.popular || localCache?.popular || []);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isLoading, setIsLoading] = useState(!window.__NEFUSOFT_CACHE__ && !localCache);
  const [copyToast, setCopyToast] = useState(false);
  
  const ongoingCardRefs = useRef([]);
  const todayCardRefs = useRef([]);
  const popularCardRefs = useRef([]);
  const ongoingScrollRef = useRef(null);
  const todayScrollRef = useRef(null);

  const shuffleArray = (array) => {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    // Smart background prefetching for Watch and Explore routes
    const timer = setTimeout(() => {
      import('./Watch').catch(() => {});
      import('./Explore').catch(() => {});
    }, 1500);

    if (window.__NEFUSOFT_CACHE__) return () => clearTimeout(timer);
    
    let isMounted = true;
    const fetchData = async () => {
      if (!localCache) {
        setIsLoading(true);
      }
      try {
        const [schRes, ongRes, popRes] = await Promise.all([
          fetch('/api/v1/schedule').then(r => r.json()),
          fetch('/api/v1/ongoing').then(r => r.json()),
          fetch('/api/v1/popular').then(r => r.json())
        ]);
        if (!isMounted) return;
        
        const schData = schRes.data || {};
        const ongData = ongRes.data || [];
        const popData = popRes.data || [];
        
        const shuffledOngoing = shuffleArray(ongData);

        setSchedule(schData);
        setOngoing(shuffledOngoing);
        setPopular(popData);
        window.__NEFUSOFT_CACHE__ = { schedule: schData, ongoing: shuffledOngoing, popular: popData };
        setCachedData('nefusoft_home_cache_v3', { schedule: schData, ongoing: shuffledOngoing, popular: popData });
      } catch (e) {
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const todayAnime = (schedule[days[new Date().getDay()]] || []).filter(a => a.status === "ONGOING");
  const carouselItems = todayAnime.length > 0 ? [...todayAnime, todayAnime[0]] : [];

  useEffect(() => {
    if (todayAnime.length > 0) {
      const itv = setInterval(() => setHeroIndex(p => p + 1), 6000);
      return () => clearInterval(itv);
    }
  }, [todayAnime]);

  useEffect(() => {
    if (todayAnime.length > 0 && heroIndex === todayAnime.length) {
      const tm = setTimeout(() => {
        setIsTransitioning(false);
        setHeroIndex(0);
      }, 750);
      return () => clearTimeout(tm);
    }
  }, [heroIndex, todayAnime.length]);

  useEffect(() => {
    if (!isTransitioning && heroIndex === 0) {
      const tm = setTimeout(() => {
        setIsTransitioning(true);
      }, 50);
      return () => clearTimeout(tm);
    }
  }, [isTransitioning, heroIndex]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('opacity-0', 'blur-xl', 'translate-y-4');
            entry.target.classList.add('opacity-100', 'blur-none', 'translate-y-0');
          }
        });
      },
      { threshold: 0.1 }
    );
    ongoingCardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    todayCardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    popularCardRefs.current.forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [ongoing, schedule, popular, isLoading]);

  const scroll = (ref, direction) => {
    if (ref.current) {
      const scrollAmount = 300;
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleShare = async (platform) => {
    const url = window.location.href;
    const text = 'Ajak temanmu nonton anime favorit bareng di NefuSoft, gratis dan tanpa iklan!!';
    const encodedText = encodeURIComponent(text);
    
    if (platform === 'api') {
      if (navigator.share) {
        try { await navigator.share({ title: 'NefuSoft', text: text, url }); } catch (e) {}
      }
      return;
    }

    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(`${text} \n\n${url}`);
        setCopyToast(true);
        setTimeout(() => setCopyToast(false), 2000);
      } catch(e) {}
      return;
    }
    const encodedUrl = encodeURIComponent(url);
    if (platform === 'fb') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
    if (platform === 'x') window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank');
    if (platform === 'tg') window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white relative">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px) translateX(-50%); } to { opacity: 1; transform: translateY(0) translateX(-50%); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; overscroll-behavior-y: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; cursor: pointer; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
      `}</style>
      
      {copyToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black px-6 py-3 rounded-full font-black text-sm z-[999] shadow-[0_10px_30px_rgba(246,207,128,0.3)] animate-[fadeIn_0.3s_ease-out_forwards]">
          Tautan berhasil disalin!
        </div>
      )}

      <Navbar />
      <header className="relative w-full aspect-[16/10] md:aspect-video min-h-[300px] md:max-h-[550px] overflow-hidden bg-[#0f0f12]">
        {isLoading ? <HeroSkeleton /> : (
          <div className={`flex h-full ${isTransitioning ? 'transition-transform duration-700' : ''}`} style={{ transform: `translate3d(-${heroIndex * 100}%, 0, 0)` }}>
            {carouselItems.map((a, i) => (
              <div key={i} className="min-w-full h-full relative">
                <img
                  src={getProxyUrl(a.image_cover || a.image_poster)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-60"
                  fetchPriority={i === 0 ? "high" : "low"}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding={i === 0 ? "sync" : "async"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent"></div>
                <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 flex items-end gap-4 md:gap-6 z-10 w-[calc(100%-48px)] md:w-[calc(100%-96px)] max-w-7xl mx-auto pr-8 md:pr-0">
                  <img
                    src={getProxyUrl(a.image_poster || a.image_cover)}
                    referrerPolicy="no-referrer"
                    className="w-24 md:w-40 aspect-[3/4.2] object-cover rounded-md shadow-2xl shrink-0"
                    fetchPriority={i === 0 ? "high" : "low"}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding={i === 0 ? "sync" : "async"}
                  />
                  <div className="flex flex-col text-left mb-1 md:mb-2 gap-1 md:gap-1.5 flex-1 min-w-0">
                    <h2 className="text-lg md:text-3xl font-black text-white tracking-tight leading-tight line-clamp-2">{a.title}</h2>
                    <p className="text-[10px] md:text-xs text-white/50 line-clamp-2 max-w-2xl leading-relaxed">{a.synopsis}</p>
                    <div className="flex items-center gap-2 mt-1 md:mt-2">
                      <button onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: a } })} className="h-8 md:h-10 px-5 md:px-6 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded font-black tracking-wider text-[10px] md:text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors">
                        <svg className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        <span className="leading-none pt-[1px] md:pt-[2px]">Tonton</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isLoading && todayAnime.length > 0 && (
          <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 flex items-center gap-2 z-20">
            <span className="text-[10px] md:text-xs font-black text-white">{(heroIndex % todayAnime.length) + 1} / {todayAnime.length}</span>
            <div className="w-8 md:w-10 h-[2px] bg-white/20 rounded-full"></div>
            <button onClick={() => { if (isTransitioning && heroIndex < todayAnime.length) setHeroIndex(p => p + 1); }} className="text-white hover:text-[#F6CF80] transition-colors">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        )}
      </header>

      <section className="max-w-7xl mx-auto px-6 mt-10">
        <div className="relative bg-[#16161a] p-6 md:p-8 rounded-xl border border-white/5 overflow-hidden shadow-xl">
           <div className="absolute inset-0 z-0">
              <img src="https://raw.githubusercontent.com/alip-jmbd/alipp/main/bc.jpg" className="w-full h-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/95 to-[#16161a]/40"></div>
           </div>
           <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
             <div>
               <h3 className="text-white font-black uppercase text-sm md:text-base mb-1 tracking-tight">Sebarkan Keseruan Ini!</h3>
               <p className="text-white/60 text-[10px] md:text-xs font-medium">Ajak teman-temanmu marathon anime favorit bareng di NefuSoft.</p>
             </div>
             <div className="flex gap-2.5 flex-wrap">
                <button onClick={() => handleShare('copy')} className="bg-white/5 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-black text-[11px] text-white">
                   <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                   Salin Link
                </button>
                <button onClick={() => handleShare('fb')} className="bg-[#1877F2]/10 hover:bg-[#1877F2] border border-[#1877F2]/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                   <svg className="w-3.5 h-3.5 fill-[#1877F2] group-hover:fill-white transition-colors" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </button>
                <button onClick={() => handleShare('x')} className="bg-white/5 hover:bg-white border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                   <svg className="w-3.5 h-3.5 fill-white group-hover:fill-black transition-colors" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </button>
                <button onClick={() => handleShare('tg')} className="bg-[#229ED9]/10 hover:bg-[#229ED9] border border-[#229ED9]/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-all group">
                   <svg className="w-3.5 h-3.5 fill-[#229ED9] group-hover:fill-white transition-colors" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 2.022-.963 6.925-1.36 9.194-.167.957-.5 1.28-.823 1.312-.738.073-1.303-.482-2.02-.953-1.121-.735-1.754-1.194-2.844-1.91-.122-.08-.266-.174-.407-.272-1.16-.807-.444-1.251.275-1.996.188-.195 3.461-3.17 3.523-3.44.008-.034.016-.159-.06-.225-.074-.066-.183-.043-.263-.025-.114.025-1.91 1.215-5.394 3.565-.51.35-1.02.522-1.479.513-.412-.008-1.206-.233-1.796-.425-2.008-.65-2.585-1.077-2.585-1.077-.286-.226.541-1.042 1.488-1.42 5.093-2.028 8.683-3.526 10.771-4.394 1.078-.445 1.583-.618 1.91-.62z"/></svg>
                </button>
                <button onClick={() => handleShare('api')} className="bg-white/5 hover:bg-white hover:text-black border border-white/10 px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-black text-[11px] text-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                  Lainnya
                </button>
             </div>
           </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-12">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex flex-col cursor-pointer group" onClick={() => navigate('/ongoing')}>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase leading-none group-hover:text-[#F6CF80] transition-colors tracking-tight">Ongoing</h2>
              <svg className="w-5 h-5 text-white/40 group-hover:text-[#F6CF80] transition-colors" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </div>
            <span className="text-[10px] text-white/40 mt-1 font-bold uppercase tracking-widest">Anime yang sedang tayang</span>
          </div>
          <div className="flex gap-2">
             <button onClick={() => scroll(ongoingScrollRef, 'left')} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-full group hover:bg-white/20 transition-colors"><svg className="w-4 h-4 text-white/50 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg></button>
             <button onClick={() => scroll(ongoingScrollRef, 'right')} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-full group hover:bg-white/20 transition-colors"><svg className="w-4 h-4 text-white/50 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg></button>
          </div>
        </div>
        <div ref={ongoingScrollRef} className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-2">
          {isLoading ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />) : 
            ongoing.map((a, i) => (
              <div key={a.id || i} ref={el => ongoingCardRefs.current[i] = el} onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: a } })} className="min-w-[105px] w-[105px] group cursor-pointer snap-start transition-all duration-700 opacity-0 blur-xl translate-y-4 active:scale-95 flex flex-col gap-2">
                <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
                  <img
                    src={getProxyUrl(a.image_poster)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    fetchPriority={i < 3 ? "high" : "low"}
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding={i < 3 ? "sync" : "async"}
                  />
                </div>
                <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 capitalize group-hover:text-[#F6CF80] transition-colors">{a.title.toLowerCase()}</h3>
              </div>
            ))
          }
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-10 relative lazy-section">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex flex-col cursor-pointer group" onClick={() => navigate('/schedule')}>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white uppercase leading-none group-hover:text-[#F6CF80] transition-colors tracking-tight">Today</h2>
              <svg className="w-5 h-5 text-white/40 group-hover:text-[#F6CF80] transition-colors" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </div>
            <span className="text-[10px] text-white/40 mt-1 font-bold uppercase tracking-widest">Anime hari ini</span>
          </div>
          <div className="flex gap-2">
             <button onClick={() => scroll(todayScrollRef, 'left')} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-full group hover:bg-white/20 transition-colors"><svg className="w-4 h-4 text-white/50 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg></button>
             <button onClick={() => scroll(todayScrollRef, 'right')} className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-full group hover:bg-white/20 transition-colors"><svg className="w-4 h-4 text-white/50 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg></button>
          </div>
        </div>
        <div ref={todayScrollRef} className="flex overflow-x-auto gap-3 pb-4 custom-scrollbar snap-x px-2">
          {isLoading ? [...Array(8)].map((_, i) => <CardSkeleton key={i} />) :
            todayAnime.map((a, i) => (
              <div key={a.id || i} ref={el => todayCardRefs.current[i] = el} onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: a } })} className="min-w-[105px] w-[105px] group cursor-pointer snap-start transition-all duration-700 opacity-0 blur-xl translate-y-4 active:scale-95 flex flex-col gap-2">
                <div className="relative aspect-[3/4.5] overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
                  <img
                    src={getProxyUrl(a.image_poster)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    fetchPriority={i < 3 ? "high" : "low"}
                    loading={i < 3 ? "eager" : "lazy"}
                    decoding={i < 3 ? "sync" : "async"}
                  />
                </div>
                <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 capitalize group-hover:text-[#F6CF80] transition-colors">{a.title.toLowerCase()}</h3>
              </div>
            ))
          }
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 mt-10 lazy-section">
        <div className="flex flex-col mb-6 px-2">
          <h2 className="text-lg font-black text-white uppercase tracking-tight">Top 10 Anime</h2>
          <span className="text-[10px] text-white/40 mt-1 font-bold uppercase tracking-widest">Anime populer sepanjang waktu</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
          {isLoading ? [...Array(10)].map((_, i) => <div key={i} className="h-24 bg-[#16161a] rounded-xl relative overflow-hidden"><Shimmer /></div>) :
            popular.slice(0, 10).map((anime, index) => (
              <div key={anime.id} ref={el => popularCardRefs.current[index] = el} onClick={() => navigate(`/anime/${anime.id}-${(anime.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: anime } })} className={`group cursor-pointer relative h-24 md:h-28 rounded-2xl flex items-center px-5 overflow-hidden transition-all duration-700 opacity-0 blur-xl translate-y-4 active:scale-95 shadow-lg ${index < 3 ? 'bg-gradient-to-r from-[#F6CF80]/20 via-[#16161a] to-[#16161a] border border-[#F6CF80]/20' : 'bg-[#16161a] border border-white/5 hover:border-white/20'}`}>
                <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-1/3 z-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/80 to-transparent z-10"></div>
                  <img
                    src={getProxyUrl(anime.image_cover)}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="relative z-20 flex items-center gap-5 w-full">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-black text-sm md:text-base shrink-0 shadow-lg ${index < 3 ? 'bg-[#F6CF80] text-[#0a0a0c]' : 'text-white/30 border border-white/10 bg-white/5'}`}>{index + 1}</div>
                  <div className="flex flex-col">
                    <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 group-hover:text-[#F6CF80] transition-colors">{anime.title}</h3>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Home;