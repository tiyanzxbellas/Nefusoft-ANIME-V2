<div align="center">
  <img src="https://raw.githubusercontent.com/alip-jmbd/alipp/main/icon-rbg.png" alt="NefuSoft Logo" width="150" />

  # NefuSoft Anime
  **Platform Streaming Anime Subtitle Indonesia Gratis & Tanpa Iklan**

  [![React](https://img.shields.io/badge/React-19.2.4-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/Vite-8.0.1-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.2.2-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![Open Source](https://img.shields.io/badge/Open_Source-%E2%9D%A4-red.svg)](https://github.com/alip-jmbd/Nefusoft-ANIME-V1.1)
</div>

## 📖 Tentang Projek

NefuSoft adalah aplikasi web *open-source* untuk *streaming* anime dengan *subtitle* Indonesia. Platform ini dirancang dengan antarmuka yang sangat modern, responsif, dan ringan, memberikan pengalaman menonton terbaik tanpa gangguan iklan pop-up yang mengganggu. 

Aplikasi ini dikembangkan sebagai *Single Page Application* (SPA) menggunakan ekosistem *web development* terbaru, menjadikannya sangat cepat dan optimal. Data anime dan pemutaran video sepenuhnya disediakan oleh *API* dari pihak ketiga.

🌐 **Repository Resmi:**[https://github.com/alip-jmbd/Nefusoft-ANIME-V1.1](https://github.com/alip-jmbd/Nefusoft-ANIME-V1.1)

## ✨ Fitur Utama

* **Antarmuka Premium & Responsif**: Desain UI/UX eksklusif berbasis *Dark Mode* yang memanjakan mata, optimal untuk perangkat *mobile* maupun *desktop*.
* **Custom Video Player Canggih**: Dilengkapi kontrol video mandiri dengan fitur:
  * Pengaturan Resolusi Kualitas Video (Auto, 360p - 1080p).
  * Pengaturan Kecepatan (*Playback Speed*).
  * Tombol Lewati (*Skip Forward/Backward* 10 detik).
  * *Auto-Next* episode otomatis.
  * Preview *Thumbnail* saat melakukan *seeking/scrubbing* *progress bar*.
* **Pencarian Cepat (*Live Search*)**: Sistem pencarian pintar (*debounce*) yang mencari judul anime secara *real-time* dari navigasi atas.
* **Jadwal Rilis Harian (*Schedule*)**: Cek daftar anime yang dirilis setiap harinya (Senin - Minggu).
* **Eksplorasi & Filter**: Temukan anime berdasarkan genre atau status penayangan (*Ongoing*).
* **Fitur Bagikan (*Share*)**: Bagikan *link* tontonan anime ke WhatsApp, X (Twitter), Facebook, atau Telegram secara langsung menggunakan *Web Share API*.
* **Download Episode**: Fitur mengunduh file `.mp4` episode anime untuk ditonton secara *offline*.

## 🛠️ Teknologi yang Digunakan

Proyek ini dibangun menggunakan *tech-stack* modern:
* **Frontend Library**: [React v19](https://react.dev/)
* **Routing**:[React Router DOM v7](https://reactrouter.com/)
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Build Tool**: [Vite v8](https://vitejs.dev/)
* **Deployment Setup**: Siap *deploy* di Vercel dengan konfigurasi `vercel.json` kustom untuk manipulasi *Proxy API* dan *CORS*.

## 🚀 Cara Instalasi & Menjalankan di Lokal

Ikuti langkah-langkah berikut untuk menjalankan NefuSoft di perangkat Anda:

1. **Clone Repository**
   ```bash
   git clone https://github.com/alip-jmbd/Nefusoft-ANIME-V1.1.git
   cd Nefusoft-ANIME-V1.1
   ```

2. **Install Dependencies**
   Pastikan Anda sudah memiliki Node.js terinstal, lalu jalankan perintah:
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Buat file bernama `.env` pada direktori *root* (sejajar dengan file `package.json`). Anda juga dapat menyalin dari `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Lalu isi file `.env` dengan *endpoint API*:
   ```env
   VITE_API_BASE=https://apisoft.tiyan.my.id/v1
   ```

4. **Jalankan Development Server**
   ```bash
   npm run dev
   ```
   Buka *browser* Anda dan kunjungi `http://localhost:5173`.

## 📂 Struktur Direktori Utama

```text
Nefusoft/
├── public/             # Aset statis publik (gambar banner, logo, dll)
├── src/
│   ├── assets/         # Aset khusus framework
│   ├── components/     # Komponen React UI yang dapat digunakan kembali (Navbar, Footer)
│   ├── pages/          # Halaman/Route aplikasi (Home, Explore, Watch, dll)
│   ├── App.jsx         # Konfigurasi routing utama
│   ├── main.jsx        # Entry point aplikasi React
│   └── style.css       # File inisialisasi Tailwind CSS dan animasi custom
├── .env.example        # Contoh environment variables
├── vercel.json         # Konfigurasi Cloud Proxy / Rewrite untuk deployment Vercel
├── vite.config.js      # Pengaturan bundler Vite (termasuk Proxy untuk tahap lokal)
└── package.json        # Informasi versi dan dependensi proyek
```

## ⚡ Optimasi Performa (Halaman Donghua & Manga)

Halaman Donghua menampilkan ratusan kartu poster sekaligus, sehingga di HP kelas
bawah scroll-nya terasa berat. Empat penyebab utamanya sudah diperbaiki:

| Masalah | Sebelum | Sesudah |
|---|---|---|
| Ukuran poster | poster asli 60–500 KB (sampai 960×1280 px) dipakai di slot 120×180 px | dikirim versi kecil `w=300 webp q=72` lewat `wsrv.nl` → **±90% lebih ringan** |
| `backdrop-filter` | 2 badge blur di **setiap** kartu (±60 layer aktif saat scroll) | badge solid `bg-black/85`, tanpa blur |
| Animasi | `transition-all` + `group-hover:scale-110` di tiap poster, hero pakai `blur-sm` penuh | tidak ada zoom/decode ulang; latar hero pakai gambar 60 px yang sudah buram alami |
| Re-render | rotasi banner 6 detik me-render ulang seluruh halaman | rotasi pindah ke komponen `HeroBanner` (`React.memo`) |
| Jumlah kartu | "Rilis Terbaru" 47 kartu | 20 kartu |

Tambahan: semua gambar kartu kini `loading="lazy" decoding="async"` (hanya 2 poster
pertama tiap baris yang `eager`), dan animasi `shimmer`/`fadeIn` dipindah dari
`<style>` di komponen ke `style.css` supaya tidak dibuat ulang tiap render.

Kalau `wsrv.nl` gagal (misalnya rate limit), setiap `<img>` otomatis kembali ke
proxy Cloudflare (`cf.tiyanstores.workers.dev`) lewat handler `onError`, jadi
poster tidak akan kosong.

### Halaman Manga

Halaman Manga memakai perlakuan yang sama (poster `wsrv.nl w=300 webp`, badge
tanpa `backdrop-blur`, tanpa `group-hover:scale-110`, banner jadi `HeroBanner`
memo, grid browse pakai `.lazy-grid`), plus dua perbaikan tambahan:

| Masalah | Sebelum | Sesudah |
|---|---|---|
| Cover halaman detail | PNG asli **230 KB** dipakai untuk kartu 208 px | `wsrv.nl w=400` → **27 KB**; latar `w=60` |
| Ketergantungan proxy | **semua** request API lewat `cf.tiyanstores.workers.dev` | `fetch` **langsung** ke `komikindo.ch`, proxy hanya fallback |

Alasan poin kedua: `*.workers.dev` ternyata **diblokir di level DNS oleh sebagian
operator** (contoh terukur: XL Axiata mengarahkan seluruh `*.workers.dev` ke
`blockpage.xlaxiata.id` → `108.137.176.189`). Selama semua request lewat worker,
halaman Manga kosong total untuk pengguna di jaringan tersebut. Komikindo sendiri
sudah mengirim header `Access-Control-Allow-Origin` untuk domain situs, jadi
`fetch` langsung aman; helper `mangaFetch()` mencoba direct dulu lalu jatuh ke
proxy kalau gagal (dev/CORS/jaringan lain).

## 🤝 Kontribusi (Contributing)

Karena proyek ini bersifat *open-source*, kami sangat menyambut partisipasi dari komunitas! Jika Anda ingin memperbaiki bug, menambahkan fitur, atau memperbaiki UI, silakan ikuti langkah berikut:

1. Lakukan *Fork* pada *repository* ini.
2. Buat *branch* untuk fitur Anda (`git checkout -b fitur/FiturKerenAnda`).
3. Lakukan *Commit* perubahan yang Anda buat (`git commit -m 'Menambahkan FiturKerenAnda'`).
4. *Push* ke *branch* repositori Anda (`git push origin fitur/FiturKerenAnda`).
5. Buka **Pull Request** ke *repository* utama ini.

## ⚠️ Disclaimer

**NefuSoft** adalah aplikasi berbasis antarmuka klien (*client-side web application*) buatan pihak ketiga. Kami **TIDAK** mengunggah, menyimpan, atau mendistribusikan file video atau konten multimedia apa pun di dalam server kami. Seluruh konten, data, dan media disediakan oleh API pihak ketiga secara dinamis yang tidak berafiliasi langsung dengan proyek ini. Proyek ini dibuat untuk tujuan pembelajaran (*educational purpose*) dan *portfolio*.

## 📄 Lisensi

Proyek ini didistribusikan di bawah **Lisensi MIT**. Anda bebas menggunakan, memodifikasi, dan mendistribusikan kode sumber di dalam repositori ini.