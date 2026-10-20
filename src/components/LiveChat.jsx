import React, { useState, useEffect, useRef } from 'react';
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
    <div className="flex items-center gap-2.5 bg-black/45 border border-white/5 rounded-full px-3.5 py-2 w-full max-w-[240px] mt-1.5 shadow-md">
      <button
        type="button"
        onClick={togglePlay}
        className="w-7 h-7 rounded-full bg-[#F6CF80] text-black flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm"
      >
        {isPlaying ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
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
          className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#F6CF80]"
          style={{ height: '3.5px' }}
        />
        <div className="flex justify-between text-[8px] text-white/50 mt-1 font-black uppercase tracking-wider">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};

const LiveChat = ({ animeId, episodeId = null }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
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

  useEffect(() => {
    if (!animeId) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('live_chat')
          .select('*, profiles(username, avatar_url, level)')
          .eq('anime_id', animeId);

        // Separate global comments from individual episodes
        if (episodeId) {
          query = query.eq('episode_id', episodeId);
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

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`live_chat:${animeId}:${episodeId || 'global'}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_chat',
          filter: `anime_id=eq.${animeId}`,
        },
        async (payload) => {
          const newMsg = payload.new;

          // Verify episode separation in client filter
          if (episodeId) {
            if (newMsg.episode_id !== episodeId) return;
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
  }, [animeId, episodeId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
      anime_id: animeId,
      episode_id: episodeId,
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
      console.error('Error sending message:', err);
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
      <div key={msg.id} className={`flex gap-2.5 items-start text-xs ${isReply ? 'pl-8 border-l border-white/5 mt-2.5' : ''}`}>
        <div className="w-6.5 h-6.5 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10 flex items-center justify-center">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-[#F6CF80] font-black text-[10px] uppercase">
              {displayName?.charAt(0) || 'U'}
            </span>
          )}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
            <span className="font-black text-[#F6CF80] truncate max-w-[120px]">{displayName}</span>
            <span className="bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.2 rounded-full shrink-0 scale-90">
              Lv.{userLevel}
            </span>
            <span className="text-[8px] text-white/30 font-bold">{formatChatTime(msg.created_at)}</span>
          </div>

          {/* Audio content */}
          {msg.audio_url ? (
            <AudioPlayer src={msg.audio_url} />
          ) : (
            <p className="text-white/80 font-medium break-words whitespace-pre-wrap leading-relaxed">
              {msg.message}
            </p>
          )}

          {/* Image attachment */}
          {msg.image_url && (
            <div className="mt-2 max-w-[160px] rounded-lg overflow-hidden border border-white/10 shadow-md cursor-zoom-in active:scale-95 transition-all">
              <img
                src={msg.image_url}
                alt="attachment"
                onClick={() => setActiveLightboxImage(msg.image_url)}
                className="w-full h-auto object-cover max-h-[120px]"
              />
            </div>
          )}

          {/* Reply Action */}
          {user && !isReply && (
            <button
              onClick={() => handleReplyClick(msg)}
              className="text-[9px] font-black text-white/40 hover:text-[#F6CF80] uppercase tracking-wider mt-1.5 w-max transition-colors"
            >
              Balas
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#16161a] border border-white/5 rounded-sm overflow-hidden flex flex-col h-[400px] md:h-[450px] shadow-xl w-full">
      <div className="bg-[#1e1e24] px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <h3 className="text-white font-black uppercase text-xs tracking-wider">
            {episodeId ? `Komentar Episode ${episodeId}` : 'Live Chat'}
          </h3>
        </div>
        <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
          {messages.length} komentar
        </span>
      </div>

      {/* Messages viewport */}
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
            <span className="text-[11px] font-bold">Belum ada obrolan. Mulai obrolan pertamamu!</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input section */}
      <div className="p-3 border-t border-white/5 bg-[#1e1e24]/50">
        {user ? (
          <div className="flex flex-col gap-2">

            {/* Replying banner */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-[#F6CF80]/10 border border-[#F6CF80]/20 rounded-lg px-3 py-1.5 text-[10px] text-white/90">
                <span className="font-bold">
                  Membalas <span className="text-[#F6CF80]">@{replyingTo.username}</span>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-white/40 hover:text-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Image attachment preview */}
            {previewUrl && (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 group shadow-md bg-black">
                <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}

            {/* Main Form or Voice record display */}
            {isRecording ? (
              <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  <span className="text-white font-black uppercase tracking-wider text-[10px]">
                    Merekam: {formatRecordTime(recordingTime)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => stopRecording(false)}
                    className="bg-white/5 hover:bg-white/15 text-white/80 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => stopRecording(true)}
                    className="bg-red-500 hover:bg-red-600 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                  >
                    Kirim
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex gap-2 items-center">

                {/* Image Upload Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-[#0a0a0c] hover:border-[#F6CF80]/40 text-white/50 hover:text-[#F6CF80] flex items-center justify-center transition-colors cursor-pointer"
                  title="Kirim Gambar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
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

                {/* Voice Message Recorder Trigger */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-9 h-9 shrink-0 rounded-xl border border-white/10 bg-[#0a0a0c] hover:border-[#F6CF80]/40 text-white/50 hover:text-[#F6CF80] flex items-center justify-center transition-colors cursor-pointer"
                  title="Kirim Pesan Suara"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                </button>

                <input
                  type="text"
                  placeholder={isUploading ? 'Mengirim...' : 'Tulis komentar...'}
                  value={newMessage}
                  disabled={isUploading}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 bg-[#0a0a0c] text-white placeholder-white/30 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-bold outline-none focus:border-[#F6CF80]/40 transition-colors"
                  maxLength={300}
                />

                <button
                  type="submit"
                  disabled={isUploading || (!newMessage.trim() && !selectedFile)}
                  className="bg-[#F6CF80] text-black font-black text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 shrink-0 cursor-pointer shadow-md"
                >
                  {isUploading ? '...' : 'Kirim'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="text-center py-1.5">
            <p className="text-[10px] text-white/50 font-bold mb-1.5">Silakan login untuk ikut berkomentar</p>
            <span className="inline-block text-[10px] font-black uppercase text-[#F6CF80] tracking-wider bg-[#F6CF80]/10 px-3 py-1.5 rounded-full border border-[#F6CF80]/20">
              Gunakan Akun Google di Menu Profil (Navbar Atas)
            </span>
          </div>
        )}
      </div>

      {/* Expandable Image Lightbox Modal */}
      {activeLightboxImage && (
        <div
          onClick={() => setActiveLightboxImage(null)}
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
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
    </div>
  );
};

export default LiveChat;