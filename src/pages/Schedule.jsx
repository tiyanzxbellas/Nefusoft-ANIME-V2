import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { mediaUrl } from '../utils/media';

const Shimmer = () => <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10" style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />;

const ScheduleSkeleton = () => (
  <div className="flex flex-col">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex items-stretch gap-4 md:gap-6 relative w-full mb-4">
        <div className="w-12 md:w-16 shrink-0 pt-4 flex justify-end">
          <div className="w-10 h-3 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
        </div>
        <div className="relative flex flex-col items-center justify-start pt-4 shrink-0 w-4">
          <div className="absolute top-4 bottom-0 w-px bg-white/5"></div>
          <div className="w-2 h-2 bg-white/10 rounded-full z-10"></div>
        </div>
        <div className="flex-1 py-4 w-full">
          <div className="bg-[#16161a] border border-white/5 p-4 rounded-xl flex gap-5 overflow-hidden relative shadow-lg">
            <Shimmer />
            <div className="w-20 md:w-24 aspect-[3/4] bg-white/5 rounded-md shrink-0 z-10"></div>
            <div className="flex flex-col flex-1 gap-3 pt-1 z-10">
              <div className="w-16 h-3 bg-white/10 rounded-sm"></div>
              <div className="w-full h-5 bg-white/10 rounded-sm"></div>
              <div className="w-3/4 h-5 bg-white/10 rounded-sm mb-2"></div>
              <div className="w-1/2 h-3 bg-white/5 rounded-sm"></div>
              <div className="w-1/3 h-3 bg-white/5 rounded-sm"></div>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const ScheduleCard = ({ a, onClick, index }) => {
  const [ep, setEp] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeText = a.key_time ? a.key_time.split(' ')[1].substring(0, 5) : "--:--";
  const getProxyUrl = mediaUrl;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 50);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    let mounted = true;
    const targetId = a.id;
    if (!targetId) return;

    // Check memory cache or localStorage first
    if (window.__NEFUSOFT_CACHE__?.details?.[targetId]?.episode_list?.[0]) {
      setEp(window.__NEFUSOFT_CACHE__.details[targetId].episode_list[0].index);
      return;
    }
    try {
      const stored = localStorage.getItem(`nefusoft_anime_detail_${targetId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 && parsed.data?.episode_list?.[0]) {
          if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
          if (!window.__NEFUSOFT_CACHE__.details) window.__NEFUSOFT_CACHE__.details = {};
          window.__NEFUSOFT_CACHE__.details[targetId] = parsed.data;
          setEp(parsed.data.episode_list[0].index);
          return;
        }
      }
    } catch (e) {}

    fetch(`/api/v1/detail?id=${targetId}`)
      .then(res => res.json())
      .then(d => {
        if (mounted && d.data) {
          if (!window.__NEFUSOFT_CACHE__) window.__NEFUSOFT_CACHE__ = {};
          if (!window.__NEFUSOFT_CACHE__.details) window.__NEFUSOFT_CACHE__.details = {};
          window.__NEFUSOFT_CACHE__.details[targetId] = d.data;
          try {
            localStorage.setItem(`nefusoft_anime_detail_${targetId}`, JSON.stringify({ timestamp: Date.now(), data: d.data }));
          } catch (e) {}
          if (d.data.episode_list?.[0]) {
            setEp(d.data.episode_list[0].index);
          }
        }
      }).catch(() => null);
    return () => { mounted = false; };
  },[a.id]);

  return (
    <div className={`flex items-stretch gap-4 md:gap-6 relative group w-full mb-4 transition-all duration-700 ease-out ${isVisible ? 'opacity-100 blur-none translate-y-0' : 'opacity-0 blur-xl translate-y-8'}`}>
      <div className="w-12 md:w-16 shrink-0 flex items-start pt-4 justify-end font-black text-white/40 group-hover:text-[#F6CF80] transition-colors text-xs md:text-sm">
        {timeText}
      </div>
      <div className="relative flex flex-col items-center justify-start pt-4 shrink-0 w-4">
        <div className="absolute top-4 bottom-0 w-px bg-white/10 group-hover:bg-[#F6CF80]/30 transition-colors"></div>
        <div className="w-2 h-2 rounded-full bg-white/20 group-hover:bg-[#F6CF80] transition-all z-10 relative shadow-[0_0_10px_rgba(246,207,128,0)] group-hover:shadow-[0_0_10px_rgba(246,207,128,0.8)]"></div>
      </div>
      <div className="flex-1 py-4 w-full min-w-0">
        <div onClick={onClick} className="relative rounded-xl flex p-3 md:p-4 gap-4 md:gap-5 cursor-pointer transition-all active:scale-[0.98] bg-[#16161a] border border-white/5 hover:border-[#F6CF80]/30 group/card overflow-hidden shadow-xl">
          <img src={getProxyUrl(a.image_poster)} referrerPolicy="no-referrer" className="w-20 md:w-24 aspect-[3/4] object-cover rounded-md shadow-2xl shrink-0 group-hover/card:scale-105 transition-transform duration-500 relative z-10" />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative z-10">
            <div className="mb-2">
              <span className="bg-[#F6CF80] text-black text-[9px] font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                {ep ? `Episode Terakhir : ${ep}` : 'Menunggu Update'}
              </span>
            </div>
            <h3 className="font-bold text-sm md:text-base text-white line-clamp-2 mb-2 group-hover/card:text-[#F6CF80] transition-colors">{a.title}</h3>
            <div className="flex flex-col gap-1.5 text-[10px] md:text-xs text-white/60">
              <div className="flex items-start gap-2">
                <span className="w-16 md:w-20 shrink-0 font-bold text-white/40 uppercase tracking-widest text-[9px] md:text-[10px]">Genre</span>
                <span className="flex-1 text-white/80 font-medium line-clamp-1">{a.genre ? a.genre.replace(/,/g, ', ') : '-'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-16 md:w-20 shrink-0 font-bold text-white/40 uppercase tracking-widest text-[9px] md:text-[10px]">Aired</span>
                <span className="flex-1 text-white/80 font-medium">{a.aired_start || '-'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-16 md:w-20 shrink-0 font-bold text-white/40 uppercase tracking-widest text-[9px] md:text-[10px]">Time</span>
                <span className="flex-1 text-[#F6CF80] font-bold">{a.time || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Schedule = () => {
  const navigate = useNavigate();
  const[schedule, setSchedule] = useState(window.__NEFUSOFT_CACHE__?.schedule || {});
  const[isLoading, setIsLoading] = useState(!window.__NEFUSOFT_CACHE__?.schedule);
  
  const dayNames =["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const dayKeys =["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  
  const [weekDates, setWeekDates] = useState([]);
  const [selectedDay, setSelectedDay] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    const today = new Date();
    const currentDayIndex = today.getDay();
    const dates = dayNames.map((name, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - currentDayIndex + i);
      return {
        name,
        date: d.getDate(),
        key: dayKeys[i],
        isToday: i === currentDayIndex
      };
    });
    setWeekDates(dates);
    setSelectedDay(dayKeys[currentDayIndex]);
    
    if (window.__NEFUSOFT_CACHE__?.schedule) return;

    let isMounted = true;
    const fetchSchedule = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/v1/schedule').then(r => r.json());
        if (isMounted) {
          const fetchedSchedule = res.data || {};
          setSchedule(fetchedSchedule);
          if (!window.__NEFUSOFT_CACHE__) {
            window.__NEFUSOFT_CACHE__ = {};
          }
          window.__NEFUSOFT_CACHE__.schedule = fetchedSchedule;
        }
      } catch (e) {
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchSchedule();
    return () => { isMounted = false; };
  },[]);

  const getAnimeList = () => schedule[selectedDay] ||[];

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-[#F6CF80] selection:text-black pb-24">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; overscroll-behavior-y: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      <Navbar />

      <div className="pt-24 max-w-2xl mx-auto px-4">
        <h2 className="text-white font-black text-xl text-center mb-8 italic tracking-tighter">JADWAL TAYANG</h2>
        
        <div className="flex justify-between items-center mb-8 px-2 border-b border-white/5 pb-4">
          {weekDates.map(w => (
            <div key={w.key} onClick={() => setSelectedDay(w.key)} className="flex flex-col items-center gap-1.5 cursor-pointer group">
              <span className={`text-[10px] font-bold transition-colors ${selectedDay === w.key ? 'text-[#F6CF80]' : 'text-white/40 group-hover:text-white/70'}`}>{w.name}</span>
              <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-black transition-all ${selectedDay === w.key ? 'bg-[#F6CF80] text-black shadow-lg shadow-[#F6CF80]/30' : 'text-white/60 group-hover:bg-white/5'}`}>
                {w.date}
              </div>
              <div className={`w-1 h-1 rounded-full transition-opacity ${w.isToday ? 'bg-[#F6CF80] opacity-100' : 'opacity-0'}`}></div>
            </div>
          ))}
        </div>

        <div className="flex flex-col">
          {isLoading ? <ScheduleSkeleton /> : (
            getAnimeList().length > 0 ? getAnimeList().map((a, index) => (
              <ScheduleCard 
                key={`${a.id}-${index}`} 
                a={a} 
                index={index}
                onClick={() => navigate(`/anime/${a.id}-${(a.title||'').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, { state: { anime: a, latestEp: true } })}
              />
            )) : (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <svg className="w-12 h-12 text-white/5 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                <p className="text-white/20 text-xs font-bold uppercase tracking-widest italic">Belum ada jadwal</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default Schedule;