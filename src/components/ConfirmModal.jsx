import React, { useEffect } from 'react';

const ConfirmModal = ({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Hapus',
  cancelText = 'Batal',
  isDanger = true,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel?.();
      } else if (e.key === 'Enter') {
        onConfirm?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
      {/* Backdrop overlay click */}
      <div
        className="absolute inset-0"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-[#16161a] border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col items-center text-center z-10 animate-[zoomIn_0.2s_ease-out]">
        {/* Glow Accent */}
        <div
          className={`absolute -top-12 -left-12 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
            isDanger ? 'bg-red-500/20' : 'bg-[#F6CF80]/20'
          }`}
        />

        {/* Icon Header */}
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 border shadow-inner ${
            isDanger
              ? 'bg-red-500/10 border-red-500/20 text-red-500'
              : 'bg-[#F6CF80]/10 border-[#F6CF80]/20 text-[#F6CF80]'
          }`}
        >
          {isDanger ? (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ) : (
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg md:text-xl font-black text-white tracking-wide">
          {title}
        </h3>

        {/* Message */}
        <p className="text-xs md:text-sm text-white/70 font-medium mt-2 leading-relaxed max-w-sm">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white font-bold text-xs md:text-sm border border-white/10 transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full py-2.5 px-4 rounded-xl font-black text-xs md:text-sm transition-all active:scale-95 cursor-pointer shadow-lg ${
              isDanger
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30'
                : 'bg-[#F6CF80] hover:bg-[#f3c260] text-black shadow-[#F6CF80]/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
