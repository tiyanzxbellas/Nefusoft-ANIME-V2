import React from 'react';

const Footer = () => (
  <footer className="mt-16 bg-[#0a0a0c] border-t border-white/5 pt-12 pb-0 px-6">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      <div className="flex flex-col items-center md:items-start">
        <img src="/img/nefusoft.webp" alt="NefuSoft" className="w-20 md:w-28 aspect-square object-contain mb-4" />
      </div>
      <div className="text-center md:text-left">
        <h4 className="text-white font-black mb-3 text-sm tracking-wide">Tentang NefuSoft</h4>
        <p className="text-[10px] md:text-xs text-white/50 leading-relaxed font-medium">
          NefuSoft adalah platform streaming anime pihak ketiga. Kami tidak mengunggah atau menyimpan file video apa pun di server kami. Semua konten disediakan oleh pihak ketiga yang tidak terafiliasi dengan kami.
        </p>
      </div>
      <div className="text-center md:text-left flex flex-col items-center md:items-start">
         <h4 className="text-white font-black mb-5 text-sm tracking-wide">Terima Kasih Kepada</h4>
         <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-6">
              {['animein', 'kuramanime', 'oploverz'].map(p => (
                <img key={p} src={`/img/${p}.webp`} alt={p} loading="lazy" className="h-6 md:h-7 object-contain hover:scale-110 transition-transform opacity-80 hover:opacity-100" />
              ))}
            </div>
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-5">
              {['otakudesu', 'nontonanimeid', 'samehadaku', 'nekokun'].map(p => (
                <img key={p} src={`/img/${p}.webp`} alt={p} loading="lazy" className="h-6 md:h-7 object-contain hover:scale-110 transition-transform opacity-80 hover:opacity-100" />
              ))}
            </div>
         </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto border-t border-white/5 py-6 text-center">
      <p className="text-[10px] text-white/30 font-black tracking-widest uppercase">&copy; {new Date().getFullYear()} NefuSoft. All Rights Reserved.</p>
    </div>
  </footer>
);

export default Footer;