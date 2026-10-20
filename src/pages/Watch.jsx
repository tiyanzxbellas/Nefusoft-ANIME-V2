import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { saveHistoryItem, getHistory } from '../utils/historyManager';
import { isFavorite, saveFavorite, removeFavorite } from '../utils/favoritesManager';
import { mediaUrl } from '../utils/media';

const ShimmerEffect = () => (
  <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />
);

const WatchSkeleton = () => (
  <div className="animate-pulse w-full">
    <div className="w-full aspect-video bg-[#16161a] rounded-sm relative overflow-hidden mb-4 flex flex-col items-center justify-center border border-white/5">
      <ShimmerEffect />
      <img src="/img/kaguya.webp" alt="Loading" className="w-24 md:w-32 object-contain relative z-20 mb-4 opacity-50" />
      <p className="text-[#F6CF80] text-xs md:text-sm font-bold text-center px-4 relative z-20">sabar yaa, server kami butuh waktu untuk merespon 😖</p>
    </div>
    
    <div className="flex flex-col gap-3 w-full mb-8">
      <div className="flex gap-3 w-full">
        <div className="flex-1 h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
        <div className="flex-1 h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
      </div>
      <div className="w-full h-12 md:h-14 bg-[#16161a] rounded-lg relative overflow-hidden border border-white/5"><ShimmerEffect /></div>
    </div>

    <div className="bg-[#16161a] p-5 md:p-6 rounded-xl border border-white/5 mb-8 relative overflow-hidden shadow-xl h-28 md:h-24">
      <ShimmerEffect />
    </div>

    <div className="bg-[#16161a] p-4 md:p-6 rounded-sm border border-white/5 mb-8 relative overflow-hidden shadow-xl">
      <ShimmerEffect />
      <div className="w-32 h-4 bg-white/10 rounded mb-4"></div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(45px,1fr))] gap-2">
        {[...Array(15)].map((_, i) => <div key={i} className="aspect-square bg-white/5 rounded-sm shrink-0"></div>)}
      </div>
    </div>

    <div className="bg-[#16161a] rounded-sm border border-white/5 p-6 flex flex-col md:flex-row gap-6 relative overflow-hidden mb-10 shadow-xl">
      <ShimmerEffect />
      <div className="w-32 md:w-48 aspect-[3/4.2] bg-white/5 rounded-sm shrink-0 z-10 shadow-2xl mx-auto md:mx-0"></div>
      <div className="flex flex-col flex-1 w-full gap-4 z-10 items-center md:items-start mt-2">
        <div className="w-3/4 h-6 md:h-8 bg-white/10 rounded-sm mb-1"></div>
        <div className="flex gap-2 mb-4">
          <div className="w-12 h-5 bg-white/10 rounded-sm"></div>
          <div className="w-16 h-5 bg-white/10 rounded-sm"></div>
        </div>
        <div className="w-full h-2.5 bg-white/5 rounded-sm"></div>
        <div className="w-full h-2.5 bg-white/5 rounded-sm"></div>
        <div className="w-4/5 h-2.5 bg-white/5 rounded-sm mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 w-full">
          <div className="w-full h-4 bg-white/5 rounded-sm"></div>
          <div className="w-full h-4 bg-white/5 rounded-sm"></div>
          <div className="w-full h-4 bg-white/5 rounded-sm"></div>
        </div>
      </div>
    </div>
  </div>
);

const formatTime = (timeInSeconds) => {
  if (isNaN(timeInSeconds)) return "00:00";
  const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const Watch = () => {
  const { slug, episode } = useParams();
  const id = slug ? slug.split('-')[0] : null;
  const navigate = useNavigate();
  const location = useLocation();

  const initialAnime = location.state?.anime;

  // Cache helpers for SWR detail fetching
  const getCachedDetail = (targetId) => {
    if (!targetId) return null;
    if (window.__NEFUSOFT_CACHE__?.details?.[targetId]) {
      return window.__NEFUSOFT_CACHE__.details[targetId];
    }
    try {
      const stored = localStorage.getItem(`nefusoft_anime_detail_${targetId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 && parsed.data) {
          if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
          if (!window.__NEFUSOFT_CACHE__.details) window.__NEFUSOFT_CACHE__.details = {};
          window.__NEFUSOFT_CACHE__.details[targetId] = parsed.data;
          return parsed.data;
        }
      }
    } catch (e) {}
    return null;
  };

  const saveDetailToCache = (targetId, data) => {
    if (!targetId || !data) return;
    if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
    if (!window.__NEFUSOFT_CACHE__.details) window.__NEFUSOFT_CACHE__.details = {};
    window.__NEFUSOFT_CACHE__.details[targetId] = data;
    try {
      localStorage.setItem(`nefusoft_anime_detail_${targetId}`, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (e) {}
  };

  const cachedDetail = getCachedDetail(id);

  const [anime, setAnime] = useState(() => {
    if (cachedDetail) {
      return cachedDetail;
    }
    if (initialAnime && String(initialAnime.id) === String(id)) {
      return {
        id: initialAnime.id,
        title: initialAnime.title,
        image_poster: initialAnime.image_poster,
        image_cover: initialAnime.image_cover || initialAnime.image_poster,
        type: initialAnime.type,
        status: initialAnime.status,
        synopsis: initialAnime.synopsis || "",
        studio: initialAnime.studio || "",
        year: initialAnime.year || "",
        genre: initialAnime.genre || "",
        day: initialAnime.day || "",
        favorites: initialAnime.favorites || 0,
        synonyms: initialAnime.synonyms || "",
        aired_start: initialAnime.aired_start || ""
      };
    }
    return null;
  });

  const [episodes, setEpisodes] = useState(() => {
    if (cachedDetail && cachedDetail.episode_list) {
      return cachedDetail.episode_list;
    }
    return [];
  });
  const [currentEpId, setCurrentEpId] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const isDirectMp4 = selectedServer &&
    selectedServer.link &&
    selectedServer.type === 'direct' &&
    !selectedServer.link.includes('embed=true') &&
    selectedServer.link.split('?')[0].endsWith('.mp4');
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(() => {
    if (cachedDetail) return false;
    if (initialAnime && String(initialAnime.id) === String(id)) {
      return false;
    }
    return true;
  });
  const [isFavorited, setIsFavorited] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    if (!id) return;
    const handleFavUpdate = () => {
      setIsFavorited(isFavorite(id));
    };
    setIsFavorited(isFavorite(id));
    window.addEventListener('nefusoft-favorites-updated', handleFavUpdate);
    return () => {
      window.removeEventListener('nefusoft-favorites-updated', handleFavUpdate);
    };
  }, [id]);

  useEffect(() => {
    return () => {
      window.__CURRENT_ANIME__ = null;
      window.dispatchEvent(new Event('nefusoft-anime-updated'));
    };
  }, []);
  const [isEpLoading, setIsEpLoading] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [toast, setToast] = useState('');

  const videoRef = useRef(null);
  const hiddenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const playerContainerRef = useRef(null);
  const progressContainerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const wasTransitionedFromEndRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showResolutions, setShowResolutions] = useState(false);
  const [showSpeeds, setShowSpeeds] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [autoNext, setAutoNext] = useState(() => localStorage.getItem('nefusoft_autonext') === 'true');
  
  const [hoverPos, setHoverPos] = useState({ x: 0, time: 0, show: false });
  const [seekPopup, setSeekPopup] = useState(null);
  const [skipMode, setSkipMode] = useState('intro');

  const controlsTimeoutRef = useRef(null);
  const skipBuffer = useRef(0);
  const skipTimeout = useRef(null);
  const hoverTimeoutRef = useRef(null);

  // Resume state
  const hasResumedRef = useRef(false);

  const latestTimeRef = useRef(0);
  const latestDurationRef = useRef(0);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    hasStartedRef.current = hasStarted;
  }, [hasStarted]);

  useEffect(() => {
    window.scrollTo(0, 0);
    hasResumedRef.current = false;
    wasTransitionedFromEndRef.current = location.state?.fromAutoNext || false;
  }, [id, episode, location.state]);

  useEffect(() => {
    if (!id) return;
    
    const updateMetaTags = (title, desc, image) => {
      document.title = title;
      const tags = [
        { attr: 'property', key: 'og:title', val: title },
        { attr: 'property', key: 'og:description', val: desc },
        { attr: 'property', key: 'og:image', val: image },
        { attr: 'property', key: 'og:image:secure_url', val: image },
        { attr: 'name', key: 'twitter:title', val: title },
        { attr: 'name', key: 'twitter:description', val: desc },
        { attr: 'name', key: 'twitter:image', val: image },
      ];

      tags.forEach(({ attr, key, val }) => {
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute('content', val);
      });
    };

    // Hydrate immediately from cache on ID change if present
    const existingCache = getCachedDetail(id);
    if (existingCache) {
      setAnime(existingCache);
      setEpisodes(existingCache.episode_list || []);
      setIsLoading(false);
      window.__CURRENT_ANIME__ = {
        anime_id: id,
        anime_slug: slug,
        anime_title: existingCache.title,
        anime_image: existingCache.image_poster || existingCache.image_cover,
        type: existingCache.type,
        status: existingCache.status,
      };
      window.dispatchEvent(new Event('nefusoft-anime-updated'));
      const shareTitle = `Tonton ${existingCache.title} - NefuSoft`;
      const shareDesc = existingCache.synopsis ? existingCache.synopsis.substring(0, 150) + '...' : 'Streaming anime subtitle Indonesia gratis.';
      const shareImg = existingCache.image_poster || existingCache.image_cover;
      updateMetaTags(shareTitle, shareDesc, shareImg);
    }

    const fetchDetail = async () => {
      if (!anime && !existingCache) {
        setIsLoading(true);
      }
      try {
        const res = await fetch(`/api/v1/detail?id=${id}`).then(r => r.json());
        if (res.status && res.data) {
          setAnime(res.data);
          setEpisodes(res.data.episode_list || []);
          saveDetailToCache(id, res.data);

          window.__CURRENT_ANIME__ = {
            anime_id: id,
            anime_slug: slug,
            anime_title: res.data.title,
            anime_image: res.data.image_poster || res.data.image_cover,
            type: res.data.type,
            status: res.data.status,
          };
          window.dispatchEvent(new Event('nefusoft-anime-updated'));

          const shareTitle = `Tonton ${res.data.title} - NefuSoft`;
          const shareDesc = res.data.synopsis ? res.data.synopsis.substring(0, 150) + '...' : 'Streaming anime subtitle Indonesia gratis.';
          const shareImg = res.data.image_poster || res.data.image_cover;
          
          updateMetaTags(shareTitle, shareDesc, shareImg);
        }
      } catch (e) {}
      setIsLoading(false);
    };

    const fetchRecs = async () => {
      try {
        const recRes = await fetch('/api/v1/popular?page=1').then(r => r.json());
        if (recRes.status && recRes.data) {
          setRecommendations(recRes.data.slice(0, 5));
        }
      } catch (e) {}
    };

    fetchDetail();
    fetchRecs();

    return () => {
      updateMetaTags(
        'NefuSoft - Streaming Anime Sub Indo Gratis',
        'Nonton ribuan anime subtitle Indonesia secara gratis tanpa gangguan iklan di NefuSoft dengan kualitas tinggi.',
        'https://raw.githubusercontent.com/alip-jmbd/alipp/main/icons-full.jpg'
      );
    };
  }, [id, retryTrigger]);

  useEffect(() => {
    if (episodes.length > 0) {
      if (episode) {
        const targetEp = episodes.find(e => e.index.toString() === episode);
        if (targetEp && targetEp.id !== currentEpId) setCurrentEpId(targetEp.id);
      } else {
        getHistory().then((historyItems) => {
          const historyItem = historyItems.find(item => item.anime_id === id);
          let targetEp = null;
          if (historyItem && historyItem.episode_index) {
            targetEp = episodes.find(e => e.index.toString() === String(historyItem.episode_index));
          }
          if (!targetEp) {
            targetEp = episodes[episodes.length - 1];
          }
          if (targetEp && targetEp.id !== currentEpId) {
            setCurrentEpId(targetEp.id);
          }
        }).catch(() => {
          const targetEp = episodes[episodes.length - 1];
          if (targetEp && targetEp.id !== currentEpId) setCurrentEpId(targetEp.id);
        });
      }
    }
  }, [episode, episodes, currentEpId, id]);

  const changeEpisode = (epObj, fromAutoNext = false) => {
    navigate(`/anime/${slug}/${epObj.index}`, { replace: true, state: { anime, fromAutoNext } });
  };

  useEffect(() => {
    if (!currentEpId) return;
    setSkipMode('intro');
    const fetchEpisode = async () => {
      setIsEpLoading(true);
      setIsVideoReady(false);
      setHasStarted(false);
      setIsPlaying(false);
      setIsBuffering(false);
      setProgress(0);
      setCurrentTime(0);
      try {
        const res = await fetch(`/api/v1/episode?id=${currentEpId}`).then(r => r.json());
        if (res.status && res.data) {
          // 1. First choice: direct .mp4 links
          let targetServers = (res.data.server || []).filter(s => s.link && s.type === 'direct' && !s.link.includes('embed=true') && s.link.split('?')[0].endsWith('.mp4'));

          // 2. Second choice: any other direct links
          if (targetServers.length === 0) {
            targetServers = (res.data.server || []).filter(s => s.link && s.type === 'direct');
          }

          // 3. Third choice: any links (embeds/iframes/etc)
          if (targetServers.length === 0) {
            targetServers = (res.data.server || []).filter(s => s.link);
          }

          const uniqueServers = Array.from(new Map(targetServers.map(s => [s.id || s.link || s.quality, s])).values());
          
          setServers(uniqueServers);
          if (uniqueServers.length > 0) {
            const direct720p = uniqueServers.find(s => s.quality === '720p' && s.type === 'direct');
            const any720p = uniqueServers.find(s => s.quality === '720p');
            const targetSel = direct720p || any720p || uniqueServers[0];
            setSelectedServer(targetSel);

            const isDirect = targetSel &&
              targetSel.link &&
              targetSel.type === 'direct' &&
              !targetSel.link.includes('embed=true') &&
              targetSel.link.split('?')[0].endsWith('.mp4');

            if (!isDirect) {
              setIsVideoReady(true);
              setHasStarted(true);
            }
          } else {
            setSelectedServer(null);
          }
        }
      } catch (e) {}
      setIsEpLoading(false);
    };
    fetchEpisode();
  }, [currentEpId]);

  // Attempt to resume watch progress once video metadata loads
  const handleLoadedMetadata = async () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (dur > 0) {
        latestDurationRef.current = dur;
      }
      setIsVideoReady(true);

      // Only attempt resume once per episode session
      if (!hasResumedRef.current && id) {
        hasResumedRef.current = true;
        try {
          const historyItems = await getHistory();
          const targetItem = historyItems.find(item => item.anime_id === id);
          const currentEpNum = episodes.find(e => e.id === currentEpId)?.index || '0';

          if (targetItem && String(targetItem.episode_index) === String(currentEpNum)) {
            const savedTime = targetItem.current_time;
            // If progress was not at the very end (98%), restore it
            if (savedTime > 5 && savedTime < dur * 0.98) {
              videoRef.current.currentTime = savedTime;
              setCurrentTime(savedTime);
              setProgress((savedTime / dur) * 100);
              setToast(`Melanjutkan menonton dari ${formatTime(savedTime)}`);
              setTimeout(() => setToast(''), 3000);
            }
          }
        } catch (e) {
          console.warn('Failed to auto-resume progress:', e);
        }
      }
    }
  };

  // Throttle saving history items to local/remote DB to avoid rapid API requests
  const lastSavedTimeRef = useRef(0);
  const saveInterval = 5000; // Save history every 5 seconds

  const saveWatchHistory = async (time) => {
    if (!anime || !currentEpId) return;

    let finalTime = time;
    if ((isNaN(finalTime) || finalTime <= 0) && latestTimeRef.current > 0) {
      finalTime = latestTimeRef.current;
    }

    let finalDuration = videoRef.current ? videoRef.current.duration : 0;
    if ((isNaN(finalDuration) || finalDuration <= 0) && latestDurationRef.current > 0) {
      finalDuration = latestDurationRef.current;
    }

    // Do not save 0 or tiny progress to avoid overwriting valid watch history
    if (isNaN(finalTime) || finalTime <= 1) {
      return;
    }

    const currentEpNum = episodes.find(e => e.id === currentEpId)?.index || '0';
    try {
      await saveHistoryItem({
        anime_id: id,
        anime_slug: slug,
        anime_title: anime.title,
        anime_image: anime.image_poster || anime.image_cover,
        episode_index: currentEpNum,
        episode_id: currentEpId,
        current_time: finalTime,
        duration: finalDuration,
      });
    } catch (e) {
      console.error('Failed to save watch history:', e);
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        setShowControls(false);
        setShowResolutions(false);
        setShowSpeeds(false);
      }
    }, 3000);
  };

  const handleVideoAreaClick = (e) => {
    if (e) e.stopPropagation();
    if (!showControls) {
      resetControlsTimeout();
    } else {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(false);
      setShowResolutions(false);
      setShowSpeeds(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        if (videoRef.current.readyState < 3) setIsBuffering(true);
        videoRef.current.play().then(() => {
          setIsPlaying(true);
          setHasStarted(true);
          resetControlsTimeout();
        }).catch(() => {
          setIsPlaying(false);
          setIsBuffering(false);
        });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        resetControlsTimeout();
        // Immediately save history on pause
        saveWatchHistory(videoRef.current.currentTime);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (cur > 0) {
        latestTimeRef.current = cur;
      }
      if (dur > 0) {
        latestDurationRef.current = dur;
      }
      if (!isDraggingRef.current) {
        setCurrentTime(cur);
        setProgress((cur / dur) * 100);
      }

      // Throttle save history
      if (Date.now() - lastSavedTimeRef.current > saveInterval) {
        saveWatchHistory(cur);
        lastSavedTimeRef.current = Date.now();
      }
    }
  };

  const handleSeekBegin = () => {
    isDraggingRef.current = true;
    resetControlsTimeout();
  };

  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    setCurrentTime((val / 100) * duration);
    resetControlsTimeout();
  };

  const handleSeekCommit = () => {
    isDraggingRef.current = false;
    if (videoRef.current && duration && progressContainerRef.current) {
      const val = parseFloat(progressContainerRef.current.value);
      const newTime = (val / 100) * duration;
      videoRef.current.currentTime = newTime;
      if (hiddenVideoRef.current) hiddenVideoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      saveWatchHistory(newTime);
    }
    resetControlsTimeout();
  };

  const handleProgressInteraction = (e) => {
    if (!progressContainerRef.current || !duration) return;
    const rect = progressContainerRef.current.getBoundingClientRect();
    let clientX = e.clientX;
    if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
    
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const hoverTime = (x / rect.width) * duration;
    
    setHoverPos({ x, time: hoverTime, show: true });
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 160, 90);
    }
    
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      if (hiddenVideoRef.current && hiddenVideoRef.current.readyState >= 1) {
        hiddenVideoRef.current.currentTime = hoverTime;
      }
    }, 50);
  };

  const hideProgressPreview = () => {
    setHoverPos(prev => ({ ...prev, show: false }));
  };

  const drawThumbnail = () => {
    try {
      if (hiddenVideoRef.current && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(hiddenVideoRef.current, 0, 0, 160, 90);
      }
    } catch(e) {}
  };

  const handleSkip = (amount) => {
    skipBuffer.current += amount;
    setSeekPopup({ amount: skipBuffer.current, side: skipBuffer.current > 0 ? 'right' : 'left', id: Date.now() });

    if (skipTimeout.current) clearTimeout(skipTimeout.current);
    skipTimeout.current = setTimeout(() => {
      if (videoRef.current) {
        const targetTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + skipBuffer.current));
        videoRef.current.currentTime = targetTime;
        saveWatchHistory(targetTime);
      }
      skipBuffer.current = 0;
      setSeekPopup(null);
      resetControlsTimeout();
    }, 600);
  };

  const handleSkipIntroOutro = (e) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      const dur = videoRef.current.duration || duration;
      const targetTime = Math.min(dur, videoRef.current.currentTime + 80);
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (dur > 0) {
        setProgress((targetTime / dur) * 100);
      }
      saveWatchHistory(targetTime);

      const prevMode = skipMode;
      setSkipMode(prevMode === 'intro' ? 'outro' : 'intro');
      setToast(prevMode === 'intro' ? 'Berhasil Melompati Intro 80 Detik' : 'Berhasil Melompati Outro 80 Detik');
      setTimeout(() => setToast(''), 3000);
    }
    resetControlsTimeout();
  };

  const toggleFullScreen = async () => {
    if (!document.fullscreenElement) {
      await playerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
      if (window.screen?.orientation?.lock) window.screen.orientation.lock('landscape').catch(() => {});
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
      if (window.screen?.orientation?.unlock) window.screen.orientation.unlock();
    }
    resetControlsTimeout();
  };

  const handleResolutionChange = (server) => {
    if (videoRef.current) {
      const curTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      setSelectedServer(server);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = curTime;
          if (wasPlaying) videoRef.current.play().catch(() => {});
        }
      }, 200);
    }
    setShowResolutions(false);
    resetControlsTimeout();
  };

  const handleSpeedChange = (speed) => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeeds(false);
    resetControlsTimeout();
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  },[]);

  // Cleanup: save exact watch state when navigating away/unmounting
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        saveWatchHistory(videoRef.current.currentTime);
      } else if (latestTimeRef.current > 0) {
        saveWatchHistory(latestTimeRef.current);
      }
    };
  }, [anime, currentEpId]);

  const getProxyUrl = mediaUrl;

  const epIndex = episodes.findIndex(e => e.id === currentEpId);
  const currentEpNum = episodes.find(e => e.id === currentEpId)?.index || '0';
  
  const toggleAutoNext = () => {
    setAutoNext(prev => {
      const val = !prev;
      localStorage.setItem('nefusoft_autonext', val);
      return val;
    });
  };

  const handlePrev = () => { if (epIndex < episodes.length - 1) changeEpisode(episodes[epIndex + 1]); };
  const handleNext = (fromAutoNext = false) => { if (epIndex > 0) changeEpisode(episodes[epIndex - 1], fromAutoNext); };

  const handleShare = async (platform) => {
    const url = window.location.href;
    const textMsg = `Tonton ${anime?.title || 'Anime'} di NefuSoft, Gratis & Tanpa Iklan !!`;
    const encodedText = encodeURIComponent(textMsg);
    const encodedUrl = encodeURIComponent(url);

    if (platform === 'api' && navigator.canShare) {
      try {
        const imgUrl = anime?.image_poster || anime?.image_cover;
        if (imgUrl) {
          const response = await fetch(getProxyUrl(imgUrl));
          const blob = await response.blob();
          const file = new File([blob], 'cover.jpg', { type: blob.type });
          
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'NefuSoft',
              text: `${textMsg}\n\nLink: ${url}`,
            });
            return;
          }
        }
        await navigator.share({ title: 'NefuSoft', text: textMsg, url });
      } catch (e) {}
    } else if (platform === 'copy') {
      try { 
        await navigator.clipboard.writeText(`${textMsg} \n\n${url}`); 
        setToast('Tautan berhasil disalin!');
        setTimeout(() => setToast(''), 3000);
      } catch (e) {}
    } else if (platform === 'fb') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank');
    } else if (platform === 'x') {
      window.open(`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, '_blank');
    } else if (platform === 'tg') {
      window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
    }
  };

  const downloadAnime = (server) => {
    const a = document.createElement('a');
    a.href = getProxyUrl(server.link);
    a.download = `${anime?.title || 'Anime'} - Episode ${currentEpNum} (${server.quality}).mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleFavorite = () => {
    if (!anime) return;
    const animePayload = {
      anime_id: id,
      anime_slug: slug,
      anime_title: anime.title,
      anime_image: anime.image_poster || anime.image_cover,
      type: anime.type,
      status: anime.status,
    };
    if (isFavorited) {
      removeFavorite(id);
      setToast('Dihapus dari Favorit!');
    } else {
      saveFavorite(animePayload);
      setToast('Ditambahkan ke Favorit!');
    }
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        @keyframes popSeek { 0% { opacity: 0; transform: translateY(10px) scale(0.8); } 20% { opacity: 1; transform: translateY(0) scale(1.1); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        input[type=range] { -webkit-appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 0; background: #F6CF80; cursor: pointer; }
        
        .loader { position: relative; width: 54px; height: 54px; border-radius: 10px; }
        .loader div { width: 8%; height: 24%; background: #F6CF80; position: absolute; left: 50%; top: 30%; opacity: 0; border-radius: 50px; box-shadow: 0 0 3px rgba(0,0,0,0.2); animation: fade458 1s linear infinite; }
        @keyframes fade458 { from { opacity: 1; } to { opacity: 0.25; } }
        .loader .bar1 { transform: rotate(0deg) translate(0, -130%); animation-delay: 0s; }
        .loader .bar2 { transform: rotate(30deg) translate(0, -130%); animation-delay: -1.1s; }
        .loader .bar3 { transform: rotate(60deg) translate(0, -130%); animation-delay: -1s; }
        .loader .bar4 { transform: rotate(90deg) translate(0, -130%); animation-delay: -0.9s; }
        .loader .bar5 { transform: rotate(120deg) translate(0, -130%); animation-delay: -0.8s; }
        .loader .bar6 { transform: rotate(150deg) translate(0, -130%); animation-delay: -0.7s; }
        .loader .bar7 { transform: rotate(180deg) translate(0, -130%); animation-delay: -0.6s; }
        .loader .bar8 { transform: rotate(210deg) translate(0, -130%); animation-delay: -0.5s; }
        .loader .bar9 { transform: rotate(240deg) translate(0, -130%); animation-delay: -0.4s; }
        .loader .bar10 { transform: rotate(270deg) translate(0, -130%); animation-delay: -0.3s; }
        .loader .bar11 { transform: rotate(300deg) translate(0, -130%); animation-delay: -0.2s; }
        .loader .bar12 { transform: rotate(330deg) translate(0, -130%); animation-delay: -0.1s; }
      `}</style>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black font-black text-xs md:text-sm px-6 py-3 rounded-full shadow-[0_10px_30px_rgba(246,207,128,0.3)] z-[999] animate-[fadeIn_0.3s_ease-out]">
          {toast}
        </div>
      )}
      
      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 md:px-6">
        
        {isLoading ? (
          <WatchSkeleton />
        ) : !anime ? (
          <div className="text-center py-12 px-6 bg-[#16161a]/60 border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col items-center justify-center gap-4 max-w-md mx-auto shadow-2xl my-10 animate-[fadeIn_0.3s_ease-out]">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl text-red-400">
              ⚠️
            </div>
            <div className="text-center">
              <h3 className="text-white font-black text-sm tracking-wide">Gagal Memuat Detail Anime</h3>
              <p className="text-white/50 text-[11px] font-bold mt-1 leading-relaxed">
                Terjadi gangguan koneksi, rate-limiting (403/429), atau server sedang sibuk. Silakan coba lagi.
              </p>
            </div>
            <button
              onClick={() => setRetryTrigger(prev => prev + 1)}
              className="w-full h-10 bg-[#F6CF80] hover:bg-[#ebd59b] text-black rounded-xl font-black tracking-wider text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_12px_rgba(246,207,128,0.2)] active:scale-95"
            >
              🔄 Coba Lagi
            </button>
          </div>
        ) : (
          <>
            <div className="bg-[#16161a] p-1.5 md:p-2 rounded-sm border border-white/5 mb-4 shadow-2xl relative">
              <div 
                ref={playerContainerRef} 
                className="relative w-full aspect-video bg-black overflow-hidden flex flex-col group select-none"
                onMouseMove={resetControlsTimeout}
                onMouseLeave={() => isPlaying && setShowControls(false)}
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {(() => {
                    if (isEpLoading || (!isVideoReady && !hasStarted)) {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 pointer-events-none">
                          <img src="/img/kaguya.webp" alt="Loading" className="w-24 md:w-32 animate-pulse mb-4 object-contain" />
                          <p className="text-[#F6CF80] text-xs md:text-sm font-bold text-center px-4 animate-pulse">sabar yaa, server kami butuh waktu untuk merespon 😖</p>
                        </div>
                      );
                    }
                    if (isBuffering && hasStarted) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                          <div className="loader">
                            <div className="bar1"></div><div className="bar2"></div><div className="bar3"></div><div className="bar4"></div><div className="bar5"></div><div className="bar6"></div><div className="bar7"></div><div className="bar8"></div><div className="bar9"></div><div className="bar10"></div><div className="bar11"></div><div className="bar12"></div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {!hasStarted && anime?.image_cover && (
                    <div className="absolute inset-0 z-0">
                      <img
                        src={getProxyUrl(anime.image_cover)}
                        referrerPolicy="no-referrer"
                        alt="Thumbnail"
                        className="w-full h-full object-cover opacity-60"
                        fetchPriority="high"
                        decoding="sync"
                      />
                      <div className="absolute inset-0 bg-black/40"></div>
                    </div>
                  )}

                  {selectedServer && !isEpLoading ? (
                    isDirectMp4 ? (
                      <>
                        <video
                          ref={videoRef}
                          src={getProxyUrl(selectedServer.link)}
                          className={`w-full h-full object-contain relative z-10 ${!hasStarted ? 'opacity-0' : 'opacity-100'} pointer-events-none`}
                          onLoadedMetadata={handleLoadedMetadata}
                          onCanPlay={() => {
                            setIsVideoReady(true);
                            setShowControls(true);
                            resetControlsTimeout();
                            if (autoNext && !hasStarted && wasTransitionedFromEndRef.current) {
                              videoRef.current.play().then(() => {
                                setIsPlaying(true);
                                setHasStarted(true);
                                resetControlsTimeout();
                              }).catch(() => {});
                            }
                            wasTransitionedFromEndRef.current = false;
                          }}
                          onTimeUpdate={handleTimeUpdate}
                          onWaiting={() => setIsBuffering(true)}
                          onPlaying={() => setIsBuffering(false)}
                          onEnded={() => {
                            setIsPlaying(false);
                            if (autoNext && epIndex > 0) {
                              handleNext(true);
                            }
                          }}
                          autoPlay={false}
                          playsInline
                          crossOrigin="anonymous"
                        />
                        <video
                          ref={hiddenVideoRef}
                          src={getProxyUrl(selectedServer.link)}
                          className="hidden"
                          crossOrigin="anonymous"
                          onSeeked={drawThumbnail}
                          muted
                        />
                      </>
                    ) : (
                      <iframe
                        src={selectedServer.link}
                        className="w-full h-full absolute inset-0 z-10"
                        allowFullScreen
                        scrolling="no"
                        frameBorder="0"
                        title={anime?.title || "Anime Streaming"}
                      ></iframe>
                    )
                  ) : !isEpLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black z-20 pointer-events-none text-white/50 text-xs font-bold">
                       video tidak tersedia
                    </div>
                  )}
                </div>

                {isDirectMp4 && (
                  <>
                    <div className="absolute inset-0 z-20 flex" onClick={handleVideoAreaClick}>
                      <div className="w-1/3 h-full" onDoubleClick={(e) => { e.stopPropagation(); handleSkip(-10); }}></div>
                      <div className="w-1/3 h-full"></div>
                      <div className="w-1/3 h-full" onDoubleClick={(e) => { e.stopPropagation(); handleSkip(10); }}></div>
                    </div>

                    {seekPopup && (
                      <div key={seekPopup.id} className={`absolute top-1/2 ${seekPopup.side === 'left' ? 'left-[15%]' : 'right-[15%]'} -translate-y-1/2 text-white drop-shadow-[0_5px_15px_rgba(0,0,0,1)] animate-[popSeek_0.1s_ease-out_forwards] pointer-events-none z-50 flex flex-col items-center gap-1`}>
                        {seekPopup.side === 'left' ? (
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-[#F6CF80]" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                        ) : (
                          <svg className="w-8 h-8 md:w-10 md:h-10 text-[#F6CF80]" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6-8.5-6z"/></svg>
                        )}
                        <span className="text-sm md:text-base font-black italic">{seekPopup.amount > 0 ? `+${seekPopup.amount}s` : `${seekPopup.amount}s`}</span>
                      </div>
                    )}

                    <div className={`absolute inset-0 transition-opacity duration-300 flex flex-col justify-between z-30 pointer-events-none ${showControls ? 'opacity-100 bg-black/40' : 'opacity-0'}`}>

                      <div className="p-4 flex items-center gap-4 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent pb-12" onClick={e => e.stopPropagation()}>
                        <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/home')} className="w-8 h-8 md:w-10 md:h-10 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-[#F6CF80] hover:text-black transition-colors shrink-0">
                          <svg className="w-5 h-5 md:w-6 md:h-6 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <div className="flex items-center gap-3">
                          <span className="bg-[#F6CF80] text-black text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest">{anime?.type || 'TV'}</span>
                          <h1 className="text-sm md:text-base font-bold text-white/90 line-clamp-1">{anime?.title} - Eps {currentEpNum}</h1>
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                        {isVideoReady && !isBuffering && (
                          <div className="pointer-events-auto flex items-center justify-center gap-8 md:gap-16 w-full" onClick={e => e.stopPropagation()}>
                            <button onClick={() => handleSkip(-10)} className="text-white hover:text-[#F6CF80] active:scale-95 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] transition-all flex items-center justify-center shrink-0 w-12 h-12 md:w-16 md:h-16">
                              <svg className="w-10 h-10 md:w-12 md:h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
                            </button>
                            <button onClick={togglePlay} className="text-white hover:text-[#F6CF80] active:scale-95 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] transition-all flex items-center justify-center shrink-0 w-16 h-16 md:w-20 md:h-20">
                              {isPlaying ? (
                                 <svg className="w-16 h-16 md:w-20 md:h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                              ) : (
                                 <svg className="w-16 h-16 md:w-20 md:h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                              )}
                            </button>
                            <button onClick={() => handleSkip(10)} className="text-white hover:text-[#F6CF80] active:scale-95 drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] transition-all flex items-center justify-center shrink-0 w-12 h-12 md:w-16 md:h-16">
                              <svg className="w-10 h-10 md:w-12 md:h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6-8.5-6z"/></svg>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={`w-full flex flex-col pointer-events-auto bg-gradient-to-t from-black/80 to-transparent pt-16 relative transition-opacity ${isVideoReady ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-4 md:px-6 pb-5">
                          <div className="flex items-center gap-4 md:gap-5">
                            <div className="text-xs md:text-sm font-bold text-white drop-shadow-md tracking-wider tabular-nums min-w-[100px] text-center flex items-center justify-center">
                              <span>{formatTime(currentTime)}</span>
                              <span className="text-white/40 mx-1">/</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 md:gap-6">
                            <div className="relative">
                              <button onClick={() => { setShowSpeeds(!showSpeeds); setShowResolutions(false); }} className="text-[11px] md:text-xs font-black hover:text-[#F6CF80] transition-colors flex items-center gap-1 drop-shadow-md">
                                {playbackSpeed}x
                              </button>
                              {showSpeeds && (
                                <div className="absolute bottom-full right-0 mb-4 bg-[#16161a] border border-white/5 shadow-2xl p-1 flex flex-col min-w-[80px] z-50 rounded-sm">
                                  {[0.5, 1, 1.25, 2].map(s => (
                                    <button key={s} onClick={() => handleSpeedChange(s)} className={`text-xs font-bold px-3 py-2 text-left ${playbackSpeed === s ? 'text-[#F6CF80] bg-white/5' : 'text-white/70 hover:bg-white/5'}`}>
                                      {s}x
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="relative">
                              <button
                                onClick={handleSkipIntroOutro}
                                className="absolute bottom-full right-0 mb-8 hidden landscape:flex items-center gap-1.5 px-4 py-2 bg-black/60 backdrop-blur-md hover:bg-[#F6CF80] hover:text-black text-[#F6CF80] border border-[#F6CF80]/30 hover:border-[#F6CF80] font-black text-[11px] md:text-xs rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] whitespace-nowrap transition-all active:scale-95 z-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                                {skipMode === 'intro' ? 'Lompat Intro' : 'Lompat Outro'}
                              </button>

                              <button onClick={() => { setShowResolutions(!showResolutions); setShowSpeeds(false); }} className="text-[11px] md:text-xs font-black hover:text-[#F6CF80] transition-colors flex items-center gap-1 uppercase drop-shadow-md">
                                {selectedServer ? selectedServer.quality : 'AUTO'}
                              </button>
                              {showResolutions && (
                                <div className="absolute bottom-full right-0 mb-4 bg-[#16161a] border border-white/5 shadow-2xl p-1 flex flex-col min-w-[100px] z-50 rounded-sm">
                                  {servers.map(s => (
                                    <button key={s.id} onClick={() => handleResolutionChange(s)} className={`text-xs font-bold px-3 py-2 text-left ${selectedServer?.id === s.id ? 'text-[#F6CF80] bg-white/5' : 'text-white/70 hover:bg-white/5'}`}>
                                      {s.quality}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <button onClick={toggleFullScreen} className="text-white hover:text-[#F6CF80] transition-colors drop-shadow-md">
                              {isFullScreen ? (
                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                              ) : (
                                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                              )}
                            </button>
                          </div>
                        </div>

                        <div
                          className="w-full absolute bottom-0 left-0 right-0 h-1.5 md:h-2 group/progress cursor-pointer flex items-center z-50"
                          onMouseMove={handleProgressInteraction}
                          onTouchMove={(e) => handleProgressInteraction(e.touches[0])}
                          onMouseLeave={hideProgressPreview}
                          onTouchEnd={hideProgressPreview}
                          onTouchCancel={hideProgressPreview}
                        >
                          {hoverPos.show && duration > 0 && (
                            <div className="absolute bottom-4 -translate-x-1/2 pointer-events-none flex flex-col items-center" style={{ left: `${Math.max(10, Math.min(hoverPos.x, progressContainerRef.current?.getBoundingClientRect().width - 80))}px` }}>
                              <canvas ref={canvasRef} width="160" height="90" className="w-28 md:w-36 bg-transparent border border-white/20 object-cover rounded-sm drop-shadow-md"></canvas>
                              <span className="text-[10px] font-bold text-white drop-shadow-md mt-1">{formatTime(hoverPos.time)}</span>
                            </div>
                          )}
                          <input
                            type="range"
                            ref={progressContainerRef}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 m-0"
                            min="0"
                            max="100"
                            step="0.1"
                            value={progress || 0}
                            onMouseDown={handleSeekBegin}
                            onTouchStart={handleSeekBegin}
                            onMouseUp={handleSeekCommit}
                            onTouchEnd={handleSeekCommit}
                            onChange={handleSeekChange}
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1 md:h-1.5 bg-white/30 z-0 transition-all group-hover/progress:h-2 md:group-hover/progress:h-2.5"></div>
                          <div className="absolute inset-y-0 bottom-0 left-0 bg-[#F6CF80] z-10 pointer-events-none transition-all group-hover/progress:h-2 md:group-hover/progress:h-2.5" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {servers.length > 0 && (
              <div className="bg-[#16161a] border border-white/5 rounded-xl p-4 md:p-5 shadow-2xl text-left mb-4">
                <span className="font-black text-white/40 uppercase text-[10px] tracking-widest block mb-3">PILIH SERVER / RESOLUSI</span>
                <div className="flex flex-wrap gap-2">
                  {servers.map((srv, idx) => (
                    <button
                      key={srv.id || idx}
                      onClick={() => {
                        const nextIsDirect = srv &&
                          srv.link &&
                          srv.type === 'direct' &&
                          !srv.link.includes('embed=true') &&
                          srv.link.split('?')[0].endsWith('.mp4');

                        if (isDirectMp4 && nextIsDirect && videoRef.current) {
                          handleResolutionChange(srv);
                        } else {
                          setSelectedServer(srv);
                          if (!nextIsDirect) {
                            setIsVideoReady(true);
                            setHasStarted(true);
                            setIsPlaying(false);
                            setIsBuffering(false);
                          }
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                        selectedServer?.id === srv.id || selectedServer?.link === srv.link
                          ? 'bg-[#F6CF80] text-black border-[#F6CF80] shadow-[0_4px_10px_rgba(246,207,128,0.2)]'
                          : 'bg-white/5 text-white/80 border-transparent hover:bg-white/10 hover:border-white/10'
                      }`}
                    >
                      {srv.quality || srv.name || `Server ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full mb-8">
              <div className="flex gap-3 w-full">
                <button onClick={handlePrev} disabled={epIndex >= episodes.length - 1} className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 py-3 md:py-4 rounded-lg transition-all disabled:opacity-30 text-white group">
                  <svg className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  <span className="text-sm md:text-base font-black">Episode Sebelumnya</span>
                </button>

                <button onClick={handleNext} disabled={epIndex <= 0} className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-[#F6CF80]/10 border border-[#F6CF80]/40 py-3 md:py-4 rounded-lg transition-all disabled:opacity-30 text-[#F6CF80] group">
                  <span className="text-sm md:text-base font-black">Episode Selanjutnya</span>
                  <svg className="w-5 h-5 text-[#F6CF80]/50 group-hover:text-[#F6CF80] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>

              <button onClick={toggleAutoNext} className={`w-full flex flex-col items-center justify-center gap-1 py-3 md:py-4 rounded-lg transition-all border ${autoNext ? 'bg-transparent border-[#F6CF80]/40 text-[#F6CF80] shadow-[0_0_15px_rgba(246,207,128,0.1)]' : 'bg-transparent border-white/20 text-white/60 hover:bg-white/5 hover:border-white/40 hover:text-white'}`}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    {autoNext ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 8l6 4-6 4V8z" />
                    )}
                  </svg>
                  <span className="text-sm md:text-base font-black uppercase tracking-wider">AutoNext {autoNext ? 'ON' : 'OFF'}</span>
                </div>
                <span className={`text-[10px] ${autoNext ? 'text-[#F6CF80]/70' : 'text-white/40'} font-bold lowercase`}>hidupkan untuk memutar otomatis episode selanjutnya</span>
              </button>
            </div>

            {anime && (
              <div className="relative bg-[#16161a] p-5 md:p-6 rounded-xl border border-white/5 mb-8 overflow-hidden shadow-xl">
                 <div className="absolute inset-0 z-0">
                    <img src={getProxyUrl(anime.image_cover || anime.image_poster)} referrerPolicy="no-referrer" alt="" className="w-full h-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/90 to-transparent"></div>
                 </div>
                 <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div>
                     <h3 className="text-white font-black uppercase text-sm md:text-base mb-1 tracking-tight">Sebarkan Keseruan Ini!</h3>
                     <p className="text-white/60 text-[10px] md:text-xs font-medium">Bagikan keseruan nonton anime ini ke teman-temanmu!</p>
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
            )}

            {/* Episode List Row */}
            <div className="bg-[#16161a] rounded-sm border border-white/5 p-4 md:p-6 shadow-xl mb-8">
              <h3 className="text-white font-black uppercase text-sm mb-4 tracking-wider">Daftar Episode</h3>
              {episodes.length === 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(45px,1fr))] gap-2 max-h-56 overflow-y-hidden pr-2">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="aspect-square bg-white/5 rounded-sm shrink-0 relative overflow-hidden animate-pulse">
                      <ShimmerEffect />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(45px,1fr))] gap-2 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                  {[...episodes].reverse().map(ep => (
                    <button
                      key={ep.id}
                      onClick={() => {
                        changeEpisode(ep);
                      }}
                      className={`aspect-square flex items-center justify-center rounded-sm text-xs font-black transition-all shadow-sm ${currentEpId === ep.id ? 'bg-[#F6CF80] text-black shadow-[0_0_15px_rgba(246,207,128,0.4)]' : 'bg-[#0a0a0c] border border-white/5 text-white/60 hover:border-white/20 hover:text-white hover:bg-white/5'}`}
                    >
                      {ep.index}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {anime && (
              <div className="mb-8 relative bg-[#16161a] rounded-sm border border-white/5 overflow-hidden shadow-xl flex flex-col items-center md:items-start">
                <div className="absolute inset-0 z-0">
                  <img src={getProxyUrl(anime.image_cover || anime.image_poster)} referrerPolicy="no-referrer" alt="Banner" className="w-full h-full object-cover blur-md opacity-20" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#16161a] via-[#16161a]/90 to-transparent"></div>
                </div>

                <div className="relative z-10 p-6 flex flex-col md:flex-row gap-6 w-full items-center md:items-start">
                   <img
                     src={getProxyUrl(anime.image_poster)}
                     referrerPolicy="no-referrer"
                     alt={anime.title}
                     className="w-32 md:w-48 aspect-[3/4.2] object-cover rounded-sm shadow-[0_15px_30px_rgba(0,0,0,0.5)] shrink-0"
                     loading="lazy"
                     decoding="async"
                   />
                  <div className="flex flex-col flex-1 w-full text-center md:text-left">
                    <h2 className="text-xl md:text-3xl font-black text-white mb-2 leading-tight tracking-tighter">{anime.title}</h2>
                    {anime.synonyms && <p className="text-white/50 text-[10px] md:text-xs mb-5 font-bold uppercase tracking-widest">{anime.synonyms}</p>}
                    
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6 animate-[fadeIn_0.3s_ease-out]">
                      {anime.type && <span className="bg-[#F6CF80] text-black text-[9px] px-2.5 py-1 rounded-sm uppercase font-black tracking-widest">{anime.type}</span>}
                      {anime.status && <span className="bg-white/10 text-white/80 text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold tracking-widest border border-white/5">{anime.status}</span>}
                      {anime.aired_start && <span className="bg-white/10 text-white/80 text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold tracking-widest border border-white/5">{anime.aired_start}</span>}
                      {anime.favorites !== undefined && anime.favorites !== null && (
                        <span className="bg-[#fbbf24]/10 text-[#fbbf24] text-[9px] px-2.5 py-1 rounded-sm uppercase font-bold flex items-center gap-1.5 border border-[#fbbf24]/20">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                          {anime.favorites}
                        </span>
                      )}
                      <button
                        onClick={toggleFavorite}
                        className={`text-[9px] px-2.5 py-1 rounded-sm uppercase font-black tracking-widest flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isFavorited
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        {isFavorited ? 'Favorit' : 'Tambah Favorit'}
                      </button>
                    </div>

                    <p className="text-white/70 text-xs md:text-sm leading-relaxed mb-8 font-medium">{anime.synopsis}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-[10px] md:text-xs text-left">
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Studio</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.studio || '?'}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Tahun</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.year || '?'}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Genre</span><span className="text-[#F6CF80] font-bold flex-1 text-right md:text-left">{anime.genre?.replace(/,/g, ', ') || '?'}</span></div>
                      <div className="flex border-b border-white/5 pb-2"><span className="text-white/40 font-black uppercase tracking-widest w-24 text-left">Tayang</span><span className="text-white/90 font-bold flex-1 text-right md:text-left">{anime.day || '?'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {servers.length > 0 && (
              <div className="mb-10 bg-[#16161a] rounded-sm border border-white/5 p-4 md:p-6 shadow-xl">
                <div className="flex flex-col mb-4">
                  <h3 className="text-white font-black uppercase text-xs md:text-sm tracking-wider">Download Episode {currentEpNum}</h3>
                  <span className="text-[9px] text-white/50 font-bold uppercase tracking-widest mt-1">Pilih resolusi video</span>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {servers.map(s => (
                    <button key={s.id} onClick={() => downloadAnime(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a0a0c] border border-white/10 hover:bg-[#F6CF80] hover:text-black hover:border-[#F6CF80] transition-colors rounded-sm font-black text-[10px] md:text-xs text-white tracking-widest shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                      {s.quality}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </>
        )}

        {!isLoading && recommendations.length > 0 && (
          <div className="mb-12">
            <h3 className="text-white font-black uppercase text-sm mb-5 tracking-wider">Rekomendasi Lainnya</h3>
            <div className="flex flex-col gap-3">
              {recommendations.map((a) => (
                <div key={a.id} onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: a } })} className="group cursor-pointer relative h-20 md:h-24 rounded-sm bg-[#16161a] border border-white/5 flex items-center px-4 overflow-hidden transition-transform active:scale-[0.98]">
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 md:w-1/3 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] via-[#16161a]/80 to-transparent z-10"></div>
                    <img src={getProxyUrl(a.image_cover || a.image_poster)} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-opacity duration-500" />
                  </div>
                  <div className="relative z-20 flex items-center gap-4 w-full">
                    <img src={getProxyUrl(a.image_poster)} referrerPolicy="no-referrer" className="w-12 md:w-16 aspect-[3/4.2] object-cover rounded-sm shadow-lg group-hover:scale-105 transition-transform" />
                    <div className="flex flex-col">
                      <h3 className="text-white font-bold text-[11px] md:text-sm line-clamp-1 group-hover:text-[#F6CF80] transition-colors">{a.title}</h3>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">{a.type || 'TV'}</span>
                        <span className="bg-white/10 text-white/80 text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest">{a.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
};

export default Watch;