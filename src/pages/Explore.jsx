import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { mediaUrl } from '../utils/media';

const Shimmer = () => <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />;

const CardSkeleton = () => (
  <div className="w-full flex flex-col gap-2 relative">
    <div className="aspect-[3/4.5] bg-[#16161a] rounded-sm relative overflow-hidden shadow-xl"><Shimmer /></div>
    <div className="w-3/4 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
  </div>
);

const AnimeCard = ({ a, onClick, index }) => {
  const [isVisible, setIsVisible] = useState(false);
  const getProxyUrl = mediaUrl;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), (index % 15) * 40);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div onClick={onClick} className={`w-full flex flex-col gap-2 group cursor-pointer active:scale-95 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 blur-none translate-y-0' : 'opacity-0 blur-xl translate-y-4'}`}>
      <div className="relative aspect-[3/4.5] w-full overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
        <img
          src={getProxyUrl(a.image_poster)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          fetchPriority={index < 4 ? "high" : "low"}
          loading={index < 4 ? "eager" : "lazy"}
          decoding={index < 4 ? "sync" : "async"}
        />
      </div>
      <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 capitalize group-hover:text-[#F6CF80] transition-colors">{a.title.toLowerCase()}</h3>
    </div>
  );
};

const Pagination = ({ page, setPage, hasMore }) => {
  if (page === 0 && !hasMore) return null;

  const generatePages = () => {
    const pages = [];
    if (page > 1) {
      pages.push(0);
      if (page > 2) pages.push('...');
    }
    if (page > 0) {
      pages.push(page - 1);
    }
    pages.push(page);
    if (hasMore) {
      pages.push(page + 1);
      pages.push('...');
    }
    return pages;
  };

  const pages = generatePages();
  const handlePageChange = (newPage) => {
    if (newPage !== '...' && newPage >= 0) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-12 mb-4 flex-wrap">
      <button onClick={() => handlePageChange(page - 1)} disabled={page === 0} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#16161a] border border-white/10 text-white rounded-none disabled:opacity-20 disabled:cursor-not-allowed hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors font-bold shadow-lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      {pages.map((p, i) => (
        <button key={`${p}-${i}`} onClick={() => handlePageChange(p)} disabled={p === '...'} className={`w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-none font-black text-xs md:text-sm transition-all shadow-lg ${p === page ? 'bg-[#F6CF80] border border-[#F6CF80] text-black shadow-[0_0_15px_rgba(246,207,128,0.2)]' : p === '...' ? 'bg-transparent text-white/40 cursor-default border-none' : 'bg-[#16161a] border border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}>
          {p === '...' ? '...' : p + 1}
        </button>
      ))}
      <button onClick={() => handlePageChange(page + 1)} disabled={!hasMore} className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center bg-[#16161a] border border-white/10 text-white rounded-none disabled:opacity-20 disabled:cursor-not-allowed hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors font-bold shadow-lg">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
  );
};

const Explore = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const navigate = useNavigate();
  
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch genres with caching
  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;
    
    // Cek cache dulu
    if (window.__NEFUSOFT_CACHE__?.genres) {
      setGenres(window.__NEFUSOFT_CACHE__.genres);
      return;
    }
    
    fetch('/api/v1/genre')
      .then(r => r.json())
      .then(d => { 
        if (isMounted) {
          const fetchedGenres = d.data || [];
          setGenres(fetchedGenres);
          // Simpan ke cache
          if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
          window.__NEFUSOFT_CACHE__.genres = fetchedGenres;
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Reset page when query or genres change
  useEffect(() => {
    setPage(0);
  }, [query, selectedGenres]);

  // Fetch results with caching
  useEffect(() => {
    let isMounted = true;
    const fetchResults = async () => {
      // Cek cache untuk popular results
      if (!query && selectedGenres.length === 0 && page === 0 && window.__NEFUSOFT_CACHE__?.popular) {
        setResults(window.__NEFUSOFT_CACHE__.popular);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        let url = `/api/v1/popular?page=${page}`;
        if (query) {
          url = `/api/v1/search?q=${encodeURIComponent(query)}&page=${page}`;
        } else if (selectedGenres.length > 0) {
          const genreQuery = selectedGenres.map(id => `id=${id}`).join('&');
          url = `/api/v1/genre?${genreQuery}&page=${page}`;
        }
        
        const res = await fetch(url).then(r => r.json());
        if (isMounted) {
          const fetchedData = res.data || [];
          setResults(fetchedData);
          // Cache popular results
          if (!query && selectedGenres.length === 0 && page === 0) {
            if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
            window.__NEFUSOFT_CACHE__.popular = fetchedData;
          }
        }
      } catch (e) {
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchResults();
    return () => { isMounted = false; };
  }, [page, query, selectedGenres]);

  const toggleGenre = (id) => {
    setSelectedGenres(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; overscroll-behavior-y: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      <Navbar />

      <div className="pt-24 max-w-7xl mx-auto px-6">
        {!query && genres.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white font-black uppercase mb-4 text-sm tracking-wide">Filter Genre</h2>
            <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
              {genres.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)} className={`px-4 py-2 text-[10px] whitespace-nowrap font-bold rounded-xl transition-colors ${selectedGenres.includes(g.id) ? 'bg-[#F6CF80] text-black shadow-lg shadow-[#F6CF80]/20' : 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {query && (
          <div className="mb-8">
            <h2 className="text-white/40 text-xs font-bold uppercase tracking-widest">Menampilkan hasil untuk:</h2>
            <span className="text-[#F6CF80] text-2xl font-black uppercase tracking-tighter line-clamp-1">"{query}"</span>
          </div>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(95px,1fr))] gap-3 px-2">
          {isLoading ? [...Array(18)].map((_, i) => <CardSkeleton key={`shimmer-${i}`} />) : results.map((a, index) => (
            <AnimeCard key={a.id} a={a} index={index} onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)} />
          ))}
        </div>
        
        {!isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <svg className="w-16 h-16 text-white/5 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p className="text-white/40 font-bold text-sm tracking-wide">Tidak ditemukan</p>
          </div>
        )}

        {!isLoading && <Pagination page={page} setPage={setPage} hasMore={results.length === 60} />}
      </div>
    </div>
  );
};

export default Explore;
