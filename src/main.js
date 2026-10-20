import '../style.css'

const API_BASE = import.meta.env.VITE_API_BASE;

async function initHome() {
  const scheduleData = await fetch(`${API_BASE}/schedule`).then(res => res.json());
  const ongoingData = await fetch(`${API_BASE}/ongoing`).then(res => res.json());
  
  renderHero(scheduleData.data);
  renderOngoing(ongoingData.data.slice(0, 10));
  setupSearch();
  setupShare();
}

function renderHero(data) {
  const days = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const today = days[new Date().getDay()];
  const todayAnime = data[today] || [];
  
  const container = document.getElementById('hero-container');
  if(!todayAnime.length) return;

  todayAnime.forEach((anime, index) => {
    const slide = document.createElement('div');
    slide.className = `hero-slide min-w-full relative h-[450px] md:h-[550px] flex items-center transition-all duration-700 ease-in-out ${index === 0 ? 'opacity-100' : 'opacity-0 absolute'}`;
    slide.innerHTML = `
      <div class="absolute inset-0 z-0">
        <img src="${anime.image_cover}" class="w-full h-full object-cover opacity-40">
        <div class="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#faf5ff] via-[#faf5ff]/80 to-transparent"></div>
      </div>
      <div class="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center md:items-start text-center md:text-left">
        <div class="flex gap-2 mb-4">
          <span class="bg-[#9333ea] text-white text-[10px] font-bold px-2 py-1 rounded-md">HD</span>
          <span class="bg-[#fbbf24] text-[#581c87] text-[10px] font-bold px-2 py-1 rounded-md">${anime.type}</span>
        </div>
        <h1 class="text-3xl md:text-5xl font-black text-[#3b0764] mb-4 line-clamp-2">${anime.title}</h1>
        <p class="text-sm md:text-base text-[#6b21a8] max-w-xl mb-8 line-clamp-3">${anime.synopsis}</p>
        <div class="flex gap-4">
          <button class="bg-[#9333ea] hover:bg-[#7e22ce] text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> WATCH NOW
          </button>
          <button class="bg-white/50 backdrop-blur-md border border-[#e9d5ff] p-3 rounded-full hover:bg-white transition-all">
            <svg class="w-6 h-6 stroke-[#9333ea]" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5h14v14H5z"/></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(slide);
  });

  let currentSlide = 0;
  const slides = document.querySelectorAll('.hero-slide');
  const countDisplay = document.getElementById('slide-count');

  const updateSlider = (n) => {
    slides[currentSlide].classList.replace('opacity-100', 'opacity-0');
    slides[currentSlide].classList.add('absolute');
    currentSlide = (n + slides.length) % slides.length;
    slides[currentSlide].classList.replace('opacity-0', 'opacity-100');
    slides[currentSlide].classList.remove('absolute');
    countDisplay.innerText = `${currentSlide + 1} / ${slides.length}`;
  };

  document.getElementById('prev-hero').onclick = () => updateSlider(currentSlide - 1);
  document.getElementById('next-hero').onclick = () => updateSlider(currentSlide + 1);
  countDisplay.innerText = `1 / ${slides.length}`;
}

function renderOngoing(data) {
  const grid = document.getElementById('ongoing-grid');
  data.forEach(anime => {
    const card = document.createElement('div');
    card.className = "group cursor-pointer";
    card.innerHTML = `
      <div class="relative aspect-[3/4] rounded-2xl overflow-hidden mb-2 shadow-sm transition-transform group-hover:-translate-y-1">
        <img src="${anime.image_poster}" class="w-full h-full object-cover">
        <div class="absolute top-2 left-2 bg-[#9333ea] text-white text-[9px] font-bold px-2 py-1 rounded-lg">EPS ${anime.time.split(' ')[0] || '?'}</div>
        <div class="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
          <span class="text-white text-[10px] font-bold">SUB INDO</span>
        </div>
      </div>
      <h3 class="text-xs font-bold text-[#581c87] line-clamp-2 group-hover:text-[#9333ea] transition-colors">${anime.title}</h3>
    `;
    grid.appendChild(card);
  });
}

function setupSearch() {
  const input = document.getElementById('search-input');
  const resultBox = document.getElementById('search-results');

  input.oninput = async (e) => {
    const query = e.target.value;
    if(query.length < 2) {
      resultBox.classList.add('hidden');
      return;
    }

    const data = await fetch(`${API_BASE}/ongoing`).then(res => res.json());
    const filtered = data.data.filter(a => a.title.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
    
    resultBox.innerHTML = '';
    if(filtered.length) {
      resultBox.classList.remove('hidden');
      filtered.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-2 hover:bg-[#f3e8ff] cursor-pointer transition-colors";
        div.innerHTML = `
          <img src="${item.image_poster}" class="w-10 h-14 object-cover rounded-lg">
          <div>
            <div class="text-[11px] font-bold text-[#581c87] line-clamp-1">${item.title}</div>
            <div class="text-[9px] text-[#9333ea]">${item.type} • ${item.year}</div>
          </div>
        `;
        resultBox.appendChild(div);
      });
    }
  };
}

function setupShare() {
  const url = encodeURIComponent(window.location.href);
  document.getElementById('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  document.getElementById('share-tw').href = `https://twitter.com/intent/tweet?url=${url}`;
  document.getElementById('share-wa').href = `https://api.whatsapp.com/send?text=${url}`;
}

document.addEventListener('DOMContentLoaded', initHome);