import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { uploadChatAttachment } from '../utils/chatUpload';

// Custom Elegant Audio Player Component
const AudioPlayer = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setCurrentTime(audio.currentTime);
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error('Audio playback failed:', e));
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration) return;
    const value = parseFloat(e.target.value);
    const newTime = (value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(value);
  };

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '00:00';
    const mins = Math.floor(time / 60).toString().padStart(2, '0');
    const secs = Math.floor(time % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="flex items-center gap-2 bg-black/45 border border-white/5 rounded-full px-3 py-1.5 w-full max-w-[210px] mt-1 shadow-md">
      <button
        type="button"
        onClick={togglePlay}
        className="w-6.5 h-6.5 rounded-full bg-[#F6CF80] text-black flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>
      <div className="flex-1 flex flex-col min-w-0">
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="w-full h-0.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#F6CF80]"
          style={{ height: '2.5px' }}
        />
        <div className="flex justify-between text-[7px] text-white/50 mt-1 font-black uppercase tracking-wider">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};

const FloatingLiveChat = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState('global'); // 'global' or the current animeId
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // File upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Reply states
  const [replyingTo, setReplyingTo] = useState(null);

  // Lightbox image preview state
  const [activeLightboxImage, setActiveLightboxImage] = useState(null);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // Parse current page for anime info
  const match = location.pathname.match(/^\/anime\/([^/]+)(?:\/([^/]+))?/);
  const currentAnimeId = match ? match[1].split('-')[0] : null;
  const currentAnimeTitleRaw = match ? match[1].split('-').slice(1).join(' ') : '';
  const currentEpisodeNum = match && match[2] ? match[2] : null;

  const formatAnimeTitle = (titleRaw) => {
    if (!titleRaw) return '';
    return titleRaw
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };
  const currentAnimeTitle = formatAnimeTitle(currentAnimeTitleRaw);

  // Monitor path changes to auto-toggle room or ensure fallback
  useEffect(() => {
    if (currentEpisodeNum) {
      setActiveRoom('episode');
    } else if (currentAnimeId) {
      setActiveRoom('anime');
    } else {
      setActiveRoom('global');
    }
  }, [currentAnimeId, currentEpisodeNum, location.pathname]);

  // Auth session listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
        if (data) setProfile(data);
      });
    } else {
      setProfile(null);
    }
  }, [user]);

  const targetAnimeId = activeRoom === 'global' ? 'global' : currentAnimeId;
  const targetEpisodeId = activeRoom === 'episode' ? currentEpisodeNum : null;

  // Fetch and subscribe to messages
  useEffect(() => {
    if (!isOpen) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('live_chat')
          .select('*, profiles(username, avatar_url, level)')
          .eq('anime_id', targetAnimeId);

        if (targetEpisodeId) {
          query = query.eq('episode_id', targetEpisodeId);
        } else {
          query = query.is('episode_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching chat messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to realtime updates for the active room
    const channel = supabase
      .channel(`live_chat_floating:${targetAnimeId}:${targetEpisodeId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat',
          filter: `anime_id=eq.${targetAnimeId}`,
        },
        async (payload) => {
          const newMsg = payload.new;

          // Ensure we don't fetch wrong episode-level comments or global comments
          if (targetEpisodeId) {
            if (newMsg.episode_id !== targetEpisodeId) return;
          } else {
            if (newMsg.episode_id) return;
          }

          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('username, avatar_url, level')
              .eq('id', newMsg.user_id)
              .maybeSingle();

            if (prof) {
              newMsg.profiles = prof;
            }
          } catch (e) {
            console.error('Error fetching profile for realtime message:', e);
          }

          setMessages((prev) => {
            if (prev.some((msg) => msg.id === newMsg.id)) {
              return prev;
            }
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom, isOpen, currentAnimeId, currentEpisodeNum]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Pilih berkas berupa gambar!');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  // Recording methods
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setIsUploading(true);
        try {
          const url = await uploadChatAttachment(audioBlob, 'audio');
          await sendChatMessage({ audioUrl: url, text: '🎤 Pesan Suara' });
        } catch (err) {
          alert('Gagal mengirim pesan suara: ' + err.message);
        } finally {
          setIsUploading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Mic access failed:', err);
      alert('Gagal mengakses mikrofon. Pastikan peramban Anda memiliki izin mikrofon.');
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!shouldSend) {
        mediaRecorderRef.current.onstop = () => {
          setIsRecording(false);
        };
      }
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const formatRecordTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReplyClick = (msg) => {
    const parentId = msg.parent_id || msg.id;
    setReplyingTo({
      id: parentId,
      username: msg.profiles?.username || msg.user_name,
    });
  };

  const sendChatMessage = async ({ text = '', imageUrl = null, audioUrl = null }) => {
    const chatData = {
      user_id: user.id,
      anime_id: targetAnimeId,
      episode_id: targetEpisodeId,
      parent_id: replyingTo ? replyingTo.id : null,
      user_name: profile?.username || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      user_avatar: profile?.avatar_url || user.user_metadata?.avatar_url || '',
      message: text.trim(),
      image_url: imageUrl,
      audio_url: audioUrl,
    };

    try {
      const { error } = await supabase.from('live_chat').insert([chatData]);
      if (error) throw error;
      setNewMessage('');
      handleRemoveFile();
      setReplyingTo(null);
    } catch (err) {
      console.error('Error sending floating message:', err);
      alert('Gagal mengirim pesan: ' + err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;
    if (!user) return;

    setIsUploading(true);
    let uploadedImageUrl = null;

    try {
      if (selectedFile) {
        uploadedImageUrl = await uploadChatAttachment(selectedFile, 'image');
      }
      await sendChatMessage({
        text: newMessage,
        imageUrl: uploadedImageUrl,
      });
    } catch (err) {
      alert('Gagal mengirim pesan: ' + err.message);
    } finally {
      setIsUploading(false);
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

  const formatChatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Group root comments and replies
  const rootComments = messages.filter(msg => !msg.parent_id);
  const repliesMap = messages.reduce((acc, msg) => {
    if (msg.parent_id) {
      if (!acc[msg.parent_id]) {
        acc[msg.parent_id] = [];
      }
      acc[msg.parent_id].push(msg);
    }
    return acc;
  }, {});

  const renderCommentCard = (msg, isReply = false) => {
    const avatarSrc = msg.profiles?.avatar_url || msg.user_avatar;
    const displayName = msg.profiles?.username || msg.user_name;
    const userLevel = msg.profiles?.level || 1;

    return (
      <div key={msg.id} className={`flex gap-2 items-start text-[11px] ${isReply ? 'pl-7 border-l border-white/5 mt-2' : ''}`}>
        <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10 flex items-center justify-center">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-[#F6CF80] font-black text-[9px] uppercase">
              {displayName?.charAt(0) || 'U'}
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-baseline gap-1 mb-0.5 flex-wrap">
            <span className="font-black text-[#F6CF80] truncate max-w-[110px]">{displayName}</span>
            <span className="bg-[#F6CF80] text-black text-[7px] font-black px-1 py-0.1 rounded-full shrink-0 scale-90">
              Lv.{userLevel}
            </span>
            <span className="text-[7px] text-white/30 font-bold">{formatChatTime(msg.created_at)}</span>
          </div>

          {msg.audio_url ? (
            <AudioPlayer src={msg.audio_url} />
          ) : (
            <p className="text-white/80 font-medium break-words whitespace-pre-wrap leading-relaxed">
              {msg.message}
            </p>
          )}

          {msg.image_url && (
            <div className="mt-1.5 max-w-[130px] rounded-lg overflow-hidden border border-white/10 shadow-md cursor-zoom-in active:scale-95 transition-all">
              <img
                src={msg.image_url}
                alt="attachment"
                onClick={() => setActiveLightboxImage(msg.image_url)}
                className="w-full h-auto object-cover max-h-[100px]"
              />
            </div>
          )}

          {user && !isReply && (
            <button
              onClick={() => handleReplyClick(msg)}
              className="text-[8px] font-black text-white/40 hover:text-[#F6CF80] uppercase tracking-wider mt-1 w-max transition-colors"
            >
              Balas
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 left-4 md:left-auto md:right-6 md:w-96 h-[480px] md:h-[500px] bg-[#16161a] border border-white/10 rounded-2xl shadow-2xl flex flex-col z-[95] overflow-hidden select-text font-nunito animate-[slideUp_0.2s_ease-out]">
          {/* Header */}
          <div className="bg-[#1e1e24] px-4 py-3 border-b border-white/5 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <h3 className="text-white font-black uppercase text-xs tracking-wider">Live Chat Room</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
                aria-label="Tutup live chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Room Switcher Tabs */}
            {currentAnimeId && (
              <div className="flex bg-[#0a0a0c] p-1 rounded-lg border border-white/5 mt-1">
                <button
                  onClick={() => setActiveRoom('global')}
                  className={`flex-1 text-center py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                    activeRoom === 'global'
                      ? 'bg-[#F6CF80] text-black shadow-md'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  Global
                </button>
                <button
                  onClick={() => setActiveRoom('anime')}
                  className={`flex-1 text-center py-1.5 px-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all truncate ${
                    activeRoom === 'anime'
                      ? 'bg-[#F6CF80] text-black shadow-md'
                      : 'text-white/50 hover:text-white'
                  }`}
                  title={currentAnimeTitle}
                >
                  {currentAnimeTitle ? currentAnimeTitle : 'Anime'}
                </button>
                {currentEpisodeNum && (
                  <button
                    onClick={() => setActiveRoom('episode')}
                    className={`flex-1 text-center py-1.5 px-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all truncate ${
                      activeRoom === 'episode'
                        ? 'bg-[#F6CF80] text-black shadow-md'
                        : 'text-white/50 hover:text-white'
                    }`}
                    title={`Episode ${currentEpisodeNum}`}
                  >
                    Eps {currentEpisodeNum}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 custom-scrollbar bg-[#111115]">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[#F6CF80] text-xs font-bold animate-pulse">Memuat obrolan...</span>
              </div>
            ) : rootComments.length > 0 ? (
              rootComments.map((msg) => {
                const replies = repliesMap[msg.id] || [];
                return (
                  <div key={msg.id} className="flex flex-col gap-1.5">
                    {renderCommentCard(msg)}
                    {replies.map((rep) => renderCommentCard(rep, true))}
                  </div>
                );
              })
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-white/30 p-4">
                <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-[11px] font-bold">Belum ada obrolan di ruangan ini. Mulai obrolan pertamamu!</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer Input */}
          <div className="p-3 border-t border-white/5 bg-[#1e1e24]/50 shrink-0">
            {user ? (
              <div className="flex flex-col gap-2">

                {/* Replying banner */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-[#F6CF80]/10 border border-[#F6CF80]/20 rounded-lg px-2.5 py-1 text-[9px] text-white/90">
                    <span className="font-bold">
                      Membalas <span className="text-[#F6CF80]">@{replyingTo.username}</span>
                    </span>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="text-white/40 hover:text-white"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Image attachment preview */}
                {previewUrl && (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 group shadow-md bg-black">
                    <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Voice recording controls */}
                {isRecording ? (
                  <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                      <span className="text-white font-black uppercase tracking-wider text-[9px]">
                        {formatRecordTime(recordingTime)}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => stopRecording(false)}
                        className="bg-white/5 hover:bg-white/15 text-white/80 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => stopRecording(true)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                      >
                        Kirim
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex gap-1.5 items-center">

                    {/* Image Trigger */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 shrink-0 rounded-xl border border-white/10 bg-[#0a0a0c] hover:border-[#F6CF80]/40 text-white/50 hover:text-[#F6CF80] flex items-center justify-center transition-colors cursor-pointer"
                      title="Kirim Gambar"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Voice Trigger */}
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-8 h-8 shrink-0 rounded-xl border border-white/10 bg-[#0a0a0c] hover:border-[#F6CF80]/40 text-white/50 hover:text-[#F6CF80] flex items-center justify-center transition-colors cursor-pointer"
                      title="Kirim Pesan Suara"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </button>

                    <input
                      type="text"
                      placeholder={isUploading ? 'Mengirim...' : `Pesan di ${activeRoom === 'global' ? 'Global' : activeRoom === 'episode' ? `Eps ${currentEpisodeNum}` : 'Anime'}...`}
                      value={newMessage}
                      disabled={isUploading}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="flex-1 bg-[#0a0a0c] text-white placeholder-white/30 border border-white/10 px-3 py-2.5 rounded-xl text-xs font-bold outline-none focus:border-[#F6CF80]/40 transition-colors"
                      maxLength={200}
                    />

                    <button
                      type="submit"
                      disabled={isUploading || (!newMessage.trim() && !selectedFile)}
                      className="bg-[#F6CF80] text-black font-black text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 shrink-0 cursor-pointer shadow-md"
                    >
                      Kirim
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="text-center py-2 flex flex-col items-center gap-2">
                <p className="text-[10px] text-white/50 font-bold">Silakan login untuk ikut mengobrol</p>
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-black py-2 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                  Login dengan Google
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 md:right-8 w-14 h-14 bg-[#F6CF80] text-black rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(246,207,128,0.4)] hover:scale-105 active:scale-95 transition-all z-[95] cursor-pointer group"
          aria-label="Buka live chat"
        >
          <div className="relative">
            <svg className="w-6 h-6 group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 border border-black rounded-full"></span>
          </div>
        </button>
      )}

      {/* Expandable Image Lightbox Modal */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
        >
          <button
            onClick={() => setActiveLightboxImage(null)}
            className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={activeLightboxImage}
            alt="expanded"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

export default FloatingLiveChat;