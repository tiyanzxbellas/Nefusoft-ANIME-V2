# Panduan SQL Storage Injector & Real-time Synchronization (Supabase)

Dokumen ini berisi script SQL lengkap untuk digunakan di **SQL Editor / SQL Injector** Supabase. Dengan mengeksekusi script ini, hasil **History (Riwayat Nonton)**, **Level Akun**, dan **Daftar Favorit** akan tersimpan di Supabase secara **real-time** dan dapat diakses dari perangkat / HP manapun setelah pengguna login dengan akun Google.

---

## Script SQL Lengkap (Copy & Paste ke SQL Editor / SQL Injector)

Silakan buka **SQL Editor** di Dashboard Supabase Anda, buat query baru, lalu salin dan jalankan seluruh kode SQL di bawah ini:

```sql
-- ==============================================================================
-- 1. TABEL WATCH HISTORY (RIWAYAT NONTON)
-- ==============================================================================
create table if not exists public.watch_history (
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
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Constraint Unik untuk Multi-Episode Per Anime Per User
alter table public.watch_history drop constraint if exists unique_user_anime;
alter table public.watch_history drop constraint if exists unique_user_anime_episode;
alter table public.watch_history add constraint unique_user_anime_episode unique (user_id, anime_id, episode_index);

-- Aktifkan Row Level Security (RLS)
alter table public.watch_history enable row level security;

-- Drop policy lama jika ada
drop policy if exists "User can view their own watch history" on public.watch_history;
drop policy if exists "User can insert their own watch history" on public.watch_history;
drop policy if exists "User can update their own watch history" on public.watch_history;
drop policy if exists "User can delete their own watch history" on public.watch_history;

-- RLS Policies
create policy "User can view their own watch history"
on public.watch_history for select using (auth.uid() = user_id);

create policy "User can insert their own watch history"
on public.watch_history for insert with check (auth.uid() = user_id);

create policy "User can update their own watch history"
on public.watch_history for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "User can delete their own watch history"
on public.watch_history for delete using (auth.uid() = user_id);

-- Grants Hak Akses
grant select, insert, update, delete on table public.watch_history to anon, authenticated, service_role;


-- ==============================================================================
-- 2. TABEL FAVORITES (DAFTAR FAVORIT)
-- ==============================================================================
create table if not exists public.favorites (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    anime_id text not null,
    anime_slug text not null,
    anime_title text not null,
    anime_image text,
    type text,
    status text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,

    constraint unique_user_favorite_anime unique (user_id, anime_id)
);

-- Aktifkan Row Level Security (RLS)
alter table public.favorites enable row level security;

-- Drop policy lama jika ada
drop policy if exists "User can view their own favorites" on public.favorites;
drop policy if exists "User can insert their own favorites" on public.favorites;
drop policy if exists "User can update their own favorites" on public.favorites;
drop policy if exists "User can delete their own favorites" on public.favorites;

-- RLS Policies
create policy "User can view their own favorites"
on public.favorites for select using (auth.uid() = user_id);

create policy "User can insert their own favorites"
on public.favorites for insert with check (auth.uid() = user_id);

create policy "User can update their own favorites"
on public.favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "User can delete their own favorites"
on public.favorites for delete using (auth.uid() = user_id);

-- Grants Hak Akses
grant select, insert, update, delete on table public.favorites to anon, authenticated, service_role;


-- ==============================================================================
-- 3. TABEL PROFILES (LEVEL & AKUN PENGGUNA)
-- ==============================================================================
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    username text not null,
    avatar_url text,
    level integer default 1 not null,
    watched_count integer default 0 not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Aktifkan Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Drop policy lama jika ada
drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- RLS Policies
create policy "Anyone can read profiles"
on public.profiles for select using (true);

create policy "Users can insert their own profile"
on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Grants Hak Akses
grant select, insert, update on table public.profiles to anon, authenticated, service_role;

-- Buat Profil Default untuk Pengguna yang Sudah Ada
insert into public.profiles (id, username, avatar_url, level, watched_count)
select
    id,
    coalesce(raw_user_meta_data->>'full_name', email, 'User Nefu'),
    coalesce(raw_user_meta_data->>'avatar_url', ''),
    1,
    0
from auth.users
on conflict (id) do nothing;


-- ==============================================================================
-- 4. TABEL LIVE CHAT
-- ==============================================================================
create table if not exists public.live_chat (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    anime_id text not null,
    user_name text not null,
    user_avatar text,
    message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Aktifkan Row Level Security (RLS)
alter table public.live_chat enable row level security;

drop policy if exists "Anyone can read live chat" on public.live_chat;
drop policy if exists "Authenticated users can insert their own chat" on public.live_chat;

create policy "Anyone can read live chat"
on public.live_chat for select using (true);

create policy "Authenticated users can insert their own chat"
on public.live_chat for insert with check (auth.uid() = user_id);

grant select, insert on table public.live_chat to anon, authenticated, service_role;


-- ==============================================================================
-- 5. AKTIFKAN REALTIME REPLICATION (UNTUK UNTUK SINKRONISASI REALTIME LINTAS HP)
-- ==============================================================================
alter publication supabase_realtime add table public.watch_history;
alter publication supabase_realtime add table public.favorites;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.live_chat;
```

---

## 🎯 Penjelasan Perilaku Penyimpanan Data Game / Account Mode

1. **Perangkat Sama & Belum Login**: Data disimpan sementara di `localStorage` peramban.
2. **Saat Login Google di HP Mana Saja**:
   - Sistem secara otomatis menarik **History**, **Level**, dan **Daftar Favorit** dari Supabase.
   - Jika terdapat data lokal di HP baru, data akan **digabungkan (merged)** dengan data di Supabase.
   - Perubahan di satu HP (misal: tambah favorit atau nonton episode baru) akan langsung memperbarui data di HP lain secara **real-time** tanpa perlu refresh.
