# Panduan Integrasi Supabase, Google Login & Real-time Storage (History, Level, Favorit)

Dokumen ini menjelaskan langkah-langkah lengkap untuk mengintegrasikan backend **Supabase**, autentikasi **Google OAuth (Login)**, serta sinkronisasi **History (Riwayat Nonton)**, **Level Akun**, dan **Daftar Favorit** secara real-time di aplikasi streaming NefuSoft Anime. (Untuk dokumen SQL Injector Storage yang lengkap, lihat juga file `storage.md`).

---

## 1. Setup Supabase Project

1. Daftar atau masuk ke [Supabase Console](https://supabase.com).
2. Buat project baru (contoh nama: `nefusoft-anime`).
3. Catat **Project URL** dan **Anon/Public Key** Anda di bagian *Project Settings -> API*.

---

## 2. Skema Database (Watch History)

Kita memerlukan tabel untuk menyimpan riwayat tontonan pengguna. Supabase menggunakan PostgreSQL. Silakan buka **SQL Editor** di dashboard Supabase Anda, buat query baru, dan jalankan perintah SQL berikut:

```sql
-- 1. Buat Tabel watch_history
create table public.watch_history (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    anime_id text not null,
    anime_slug text not null,
    anime_title text not null,
    anime_image text,
    episode_index text not null,
    episode_id text not null,
    current_time double precision default 0 not null,
    duration double precision default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

    -- Memastikan satu user hanya memiliki satu baris riwayat per anime_id
    constraint unique_user_anime unique (user_id, anime_id)
);

-- 2. Aktifkan Row Level Security (RLS) demi keamanan
alter table public.watch_history enable row level security;

-- 3. Buat RLS Policies agar user hanya bisa CRUD datanya sendiri
create policy "User can view their own watch history"
on public.watch_history for select
using (auth.uid() = user_id);

create policy "User can insert their own watch history"
on public.watch_history for insert
with check (auth.uid() = user_id);

create policy "User can update their own watch history"
on public.watch_history for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "User can delete their own watch history"
on public.watch_history for delete
using (auth.uid() = user_id);

-- 4. Berikan Hak Akses (Grants) untuk tabel watch_history agar bisa diakses oleh API/Client (Menghindari error permission denied)
grant select, insert, update, delete on table public.watch_history to anon, authenticated, service_role;
```

### 2.1. Memperbarui Database untuk Riwayat Multi-Episode (PENTING)
Jika Anda ingin riwayat tontonan menyimpan banyak episode sekaligus untuk setiap anime (seperti gambar referensi layout multi-episode), silakan jalankan SQL berikut di **SQL Editor** Supabase Anda untuk memperbarui batasan unik (`unique constraint`) dari tabel `watch_history`:

```sql
-- Hapus constraint unik lama (hanya satu episode per anime) jika ada
alter table public.watch_history drop constraint if exists unique_user_anime;

-- Tambahkan constraint unik baru agar bisa menyimpan lebih dari satu episode per anime
alter table public.watch_history add constraint unique_user_anime_episode unique (user_id, anime_id, episode_index);
```

---

## 3. Konfigurasi Google Login (OAuth)

Supabase membutuhkan Google OAuth Client ID dan Secret. Berikut langkah mendapatkannya:

### A. Mendapatkan Kredensial di Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru atau pilih project yang sudah ada.
3. Masuk ke menu **APIs & Services -> OAuth consent screen**:
   - Pilih **External** user type.
   - Isi informasi wajib seperti nama aplikasi dan email support.
   - Pada bagian scopes, tambahkan scope `.../auth/userinfo.email` dan `.../auth/userinfo.profile`.
4. Masuk ke menu **APIs & Services -> Credentials**:
   - Klik **Create Credentials** -> **OAuth client ID**.
   - Pilih Application type: **Web application**.
   - Pada **Authorized JavaScript origins**, masukkan domain web Anda (misal `https://nefusoft.vercel.app` dan `http://localhost:5173` untuk development).
   - Pada **Authorized redirect URIs**, masukkan redirect URI dari Supabase Anda. Anda dapat menyalin URL ini dari Dashboard Supabase di menu *Authentication -> Providers -> Google* (formatnya biasanya: `https://<project-id>.supabase.co/auth/v1/callback`).
5. Klik **Create**, lalu salin **Client ID** dan **Client Secret** yang muncul.

### B. Memasang Kredensial di Supabase
1. Buka dashboard Supabase Anda.
2. Masuk ke **Authentication -> Providers -> Google**.
3. Aktifkan (Enable) Google provider.
4. Tempelkan **Client ID** dan **Client Secret** yang Anda peroleh dari Google Cloud Console tadi.
5. Simpan perubahan (Save).

---

## 4. Konfigurasi Environment Variables (.env)

Buat file `.env` (atau edit file `.env.production`/`.env.local`) di root project Anda dan tambahkan variabel berikut:

```env
# API Base URL yang sudah ada
VITE_API_BASE=https://apisoft.tiyan.my.id/v1

# Kredensial Supabase Anda
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

Pastikan untuk mengganti `https://your-supabase-project.supabase.co` dan `your-supabase-anon-key-here` dengan kredensial asli dari dashboard Supabase Anda.

---

## 5. Cara Kerja Fitur Riwayat (History)

- **Mode Anonim / Belum Login**: Riwayat tontonan akan disimpan secara lokal menggunakan `localStorage` dengan batas maksimal 50 item.
- **Mode Terautentikasi (Google Login)**:
  - Saat pengguna masuk (login) pertama kali, riwayat dari `localStorage` otomatis disinkronisasikan ke database Supabase agar tidak hilang.
  - Setiap perubahan durasi tontonan (ketika menonton video) akan dikirimkan secara berkala (dibatasi/throttle agar performa lancar) ke tabel database `watch_history` di Supabase.
  - Pengguna dapat menghapus item riwayat tertentu atau membersihkan seluruh riwayat tontonan mereka langsung dari cloud.

---

## 6. Skema Database & Fitur Live Chat

Fitur Live Chat memungkinkan para pengguna untuk mengobrol secara langsung (real-time) di halaman menonton anime. Ikuti panduan berikut untuk menyiapkan tabel database `live_chat` dan mengaktifkan fitur realtime di Supabase Anda:

### PENTING: Jika Live Chat Tidak Bisa Kirim Pesan / Error
Jika Anda mengalami masalah di mana **Live Chat tidak bisa mengirim pesan**, atau Anda melihat pesan kesalahan saat menekan tombol **Kirim**, ini dikarenakan tabel `live_chat` atau kebijakan keamanannya (RLS) belum dikonfigurasi di database Supabase Anda. Anda **harus** menjalankan skema SQL di bawah ini di **SQL Editor / SQL Injector** Supabase Anda terlebih dahulu!

### A. Skema SQL (Live Chat)
Buka **SQL Editor** (atau sering disebut menu SQL Editor / SQL Injector / Query Editor / Query Tool) di dashboard Supabase Anda, buat query baru (klik *New query*), tempelkan (paste) dan jalankan (run/execute) seluruh perintah SQL berikut:

```sql
-- 1. Buat Tabel live_chat jika belum ada
create table if not exists public.live_chat (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    anime_id text not null,
    user_name text not null,
    user_avatar text,
    message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Aktifkan Row Level Security (RLS) demi keamanan jika belum aktif
alter table public.live_chat enable row level security;

-- Drop policy lama jika ingin memperbarui / menghindari duplikasi error saat setup ulang
drop policy if exists "Anyone can read live chat" on public.live_chat;
drop policy if exists "Authenticated users can insert their own chat" on public.live_chat;

-- 3. Buat RLS Policies
-- Semua orang (termasuk tamu/anonim) bisa membaca pesan chat
create policy "Anyone can read live chat"
on public.live_chat for select
using (true);

-- Hanya pengguna yang sudah login yang bisa mengirimkan pesan chat
create policy "Authenticated users can insert their own chat"
on public.live_chat for insert
with check (auth.uid() = user_id);

-- 4. Daftarkan tabel live_chat ke dalam publikasi realtime Supabase agar sinkronisasi instan aktif
-- (Abaikan jika tabel sudah terdaftar atau jika menggunakan dashboard UI untuk mengaktifkannya)
alter publication supabase_realtime add table public.live_chat;

-- 5. Berikan Hak Akses (Grants) untuk tabel live_chat agar bisa diakses oleh API/Client (Menghindari error permission denied)
grant select, insert on table public.live_chat to anon, authenticated, service_role;
```

> **Catatan Penting (Troubleshooting Chat tidak terkirim / gagal):**
> Jika Anda sudah mencoba mengirim chat namun pesan tidak muncul atau tombol kirim tidak merespon, pastikan hal-hal berikut:
> 1. **Sudah Login dengan Google**: Pengguna **harus login terlebih dahulu** menggunakan Google OAuth agar diizinkan mengirim pesan ke tabel `live_chat` sesuai aturan RLS (`with check (auth.uid() = user_id)`). Jika belum login, tombol kirim akan digantikan oleh tombol "Login dengan Google".
> 2. **Skema SQL Sudah Dijalankan**: Pastikan seluruh perintah SQL di atas sudah dieksekusi tanpa error di SQL Editor Supabase Anda. Jika tabel `live_chat` atau policy RLS-nya belum terbuat, pengiriman pesan via SDK Supabase akan ditolak.
> 3. **Sinkronisasi Realtime Aktif**: Tanpa langkah B di bawah ini, pesan mungkin tersimpan di database tetapi tidak muncul secara real-time ke pengguna lain sebelum halaman direfresh.

### B. Memastikan Realtime Aktif di Dashboard Supabase
1. Masuk ke **Database -> Replication** di sidebar dashboard Supabase Anda.
2. Cari publikasi bernama `supabase_realtime` (atau klik Edit).
3. Pastikan tabel `live_chat` sudah dicentang/diaktifkan untuk Realtime replication.

---

## 8. Skema Database & Konfigurasi Fitur Profil & Level Akun (PENTING)

Fitur profil dan level akun memungkinkan pengguna untuk mengganti nama pengguna (username), memilih avatar/foto profil anime, serta memiliki level akun yang meningkat seiring dengan banyaknya episode anime yang ditonton.

Agar semua pengguna dapat melihat nama, foto profil, dan level terbaru dari setiap pengirim chat, jalankan perintah SQL berikut di **SQL Editor / SQL Injector** Supabase Anda:

```sql
-- 1. Buat Tabel profiles jika belum ada
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    username text not null,
    avatar_url text,
    level integer default 1 not null,
    watched_count integer default 0 not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Aktifkan Row Level Security (RLS) demi keamanan
alter table public.profiles enable row level security;

-- Drop policy lama jika ingin memperbarui / menghindari duplikasi error saat setup ulang
drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;

-- 3. Buat RLS Policies untuk tabel profiles
-- Semua orang bisa melihat profil pengguna lain
create policy "Anyone can read profiles"
on public.profiles for select
using (true);

-- Pengguna hanya bisa menginsert profilnya sendiri
create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

-- Pengguna hanya bisa mengupdate profilnya sendiri
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- 4. Berikan Hak Akses (Grants) untuk tabel profiles agar bisa diakses oleh API/Client
grant select, insert, update on table public.profiles to anon, authenticated, service_role;

-- 5. Secara otomatis buat profil default untuk pengguna lama yang sudah terdaftar di auth.users (Pencegahan Error)
insert into public.profiles (id, username, avatar_url, level, watched_count)
select
    id,
    coalesce(raw_user_meta_data->>'full_name', email, 'User Nefu'),
    coalesce(raw_user_meta_data->>'avatar_url', ''),
    1,
    0
from auth.users
on conflict (id) do nothing;

-- 6. Secara otomatis buat profil default untuk pengirim chat lama di tabel live_chat (Pencegahan Error Constraint)
insert into public.profiles (id, username, avatar_url, level, watched_count)
select distinct
    user_id,
    coalesce(user_name, 'User Nefu'),
    coalesce(user_avatar, ''),
    1,
    0
from public.live_chat
on conflict (id) do nothing;

-- 7. Hubungkan tabel live_chat dengan profiles menggunakan Foreign Key (Memungkinkan JOIN/Relasi query)
alter table public.live_chat drop constraint if exists live_chat_user_id_profiles_fkey;
alter table public.live_chat
add constraint live_chat_user_id_profiles_fkey
foreign key (user_id) references public.profiles(id) on delete cascade;

-- 8. Daftarkan tabel profiles ke dalam publikasi realtime Supabase agar sinkronisasi instan aktif
alter publication supabase_realtime add table public.profiles;
```

### Cara Kerja Level Akun:
- Level dihitung dari jumlah episode anime unik yang pernah ditonton (disimpan di riwayat nonton lokal).
- **Formula Naik Level**: Cumulative watched count yang dibutuhkan untuk mencapai level `L` adalah `L * (L - 1)`.
  - **Level 1**: 0 Episode
  - **Level 2**: 2 Episode (butuh 2 episode)
  - **Level 3**: 6 Episode (butuh 4 episode lagi)
  - **Level 4**: 12 Episode (butuh 6 episode lagi)
  - **Level 5**: 20 Episode (butuh 8 episode lagi)
  - **Level 6**: 30 Episode (butuh 10 episode lagi)
  - Dan seterusnya. Semakin tinggi level, semakin lama pula untuk naik level!
