# Panduan Fitur Chat Premium, Upload Gambar & Pesan Suara (Supabase & SQL Injection Protection Guide)

Dokumen ini menjelaskan rancangan arsitektur, skema database PostgreSQL, konfigurasi Supabase Storage, serta sistem keamanan dan proteksi terhadap serangan **SQL Injection** pada fitur balasan chat (thread), isolasi komentar per episode, pengunggahan gambar, dan pengiriman pesan suara (voice message) di NefuSoft Anime.

---

## 1. Apakah Supabase Mampu untuk Fitur Ini?

**Sangat Mampu!** Supabase menyediakan semua komponen backend yang kita butuhkan secara instan:
1. **PostgreSQL Database**: Mendukung relasi *self-referencing* (untuk fitur balasan chat/thread), kolom teks untuk menyimpan tautan gambar & pesan suara, serta pemisahan ruang komentar menggunakan filter dinamis `episode_id`.
2. **Supabase Storage**: Tempat penyimpanan (bucket) objek berkas untuk berkas gambar (`.jpg`, `.png`, dll.) dan rekaman suara (`.webm`, `.mp3`) yang aman dan dilengkapi kebijakan akses RLS (Row Level Security).
3. **Realtime Engine**: Mengalirkan pesan baru, gambar baru, dan pesan suara baru secara instan kepada pengguna lain yang sedang berada di ruangan chat yang sama.

---

## 2. Proteksi SQL Injection (Bagaimana Supabase Menjaga Keamanan)

### Bagaimana SQL Injection Terjadi di Sistem Tradisional?
SQL Injection (SQLi) biasanya terjadi pada backend tradisional jika pengembang merangkai query database menggunakan penggabungan string langsung (string concatenation), misalnya:
```sql
-- VULNERABLE SQL (TIDAK AMAN)
SELECT * FROM live_chat WHERE message = 'user_input';
```
Jika `user_input` diisi dengan `hello'; DROP TABLE live_chat; --`, database akan mengeksekusi perintah penghapusan tabel tersebut.

### Bagaimana Supabase & PostgREST Melindungi Kita Secara Otomatis?
Supabase menggunakan **PostgREST** sebagai jembatan API untuk mengakses database PostgreSQL. Saat Anda memanggil SDK klien Supabase seperti:
```javascript
const { data, error } = await supabase
  .from('live_chat')
  .insert([{ message: newMessage, image_url: imgUrl, audio_url: audioUrl }]);
```
1. **Query Terparameterisasi (Parameterized Queries)**: SDK Supabase **tidak pernah** merangkai string SQL di sisi klien. SDK ini mengirimkan data sebagai payload JSON yang aman via HTTPS POST ke PostgREST. PostgREST kemudian menerjemahkannya ke dalam query SQL menggunakan *parameter binding* (misal: `$1`, `$2`, `$3`). Input pengguna diperlakukan murni sebagai nilai data, bukan kode instruksi SQL yang bisa dieksekusi. Oleh karena itu, serangan SQL Injection melalui kolom pesan, URL gambar, ataupun URL audio **100% mustahil terjadi**.
2. **Postgres Row Level Security (RLS)**: Bahkan jika penyerang mencoba memanipulasi parameter HTTP API melalui eksploitasi di tingkat protokol, kebijakan RLS di tingkat database akan memotong akses mereka. RLS memastikan bahwa data user_id yang dikirimkan harus sama dengan identitas asli pengguna yang terverifikasi secara kriptografis melalui JWT token (`auth.uid() = user_id`).

---

## 3. Langkah-Langkah Setup di Dashboard Supabase (SQL Editor)

Silakan masuk ke **Dashboard Supabase** Anda, buka menu **SQL Editor**, buat query baru (klik *New Query*), lalu jalankan seluruh perintah SQL di bawah ini:

### A. Memperbarui Tabel `live_chat` (Kolom & Relasi Baru)
Jalankan SQL berikut untuk menambahkan fitur balasan, isolasi episode, pengiriman gambar, dan pesan suara:

```sql
-- 1. Tambahkan kolom baru ke tabel live_chat jika belum ada
alter table public.live_chat
add column if not exists parent_id uuid,
add column if not exists episode_id text,
add column if not exists image_url text,
add column if not exists audio_url text;

-- 2. Tambahkan Foreign Key Constraint self-referencing untuk parent_id (Fitur Balasan/Thread)
-- Ini memastikan jika pesan induk dihapus, balasan di bawahnya otomatis terhapus (cascade)
alter table public.live_chat drop constraint if exists live_chat_parent_id_fkey;

alter table public.live_chat
add constraint live_chat_parent_id_fkey
foreign key (parent_id)
references public.live_chat(id)
on delete cascade;

-- 3. Perbarui RLS (Row Level Security) Policies untuk Tabel live_chat
drop policy if exists "Anyone can read live chat" on public.live_chat;
drop policy if exists "Authenticated users can insert their own chat" on public.live_chat;

-- Kebijakan Membaca Chat/Komentar (Semua orang termasuk tamu bisa membaca komentar)
create policy "Anyone can read live chat"
on public.live_chat for select
using (true);

-- Kebijakan Mengirim Chat/Komentar (Hanya pengguna login yang bisa mengirim dan wajib cocok dengan auth.uid)
create policy "Authenticated users can insert their own chat"
on public.live_chat for insert
with check (auth.uid() = user_id);

-- 4. Berikan hak akses kepada klien API
grant select, insert on table public.live_chat to anon, authenticated, service_role;
```

---

### B. Konfigurasi Supabase Storage untuk Gambar & Pesan Suara
Untuk menyimpan lampiran gambar dan pesan suara, kita memerlukan sebuah Storage Bucket publik bernama `chat_attachments`. Jalankan perintah SQL berikut di **SQL Editor** Supabase Anda untuk menginisialisasi bucket dan hak akses keamanannya secara otomatis:

```sql
-- 1. Daftarkan bucket baru bernama 'chat_attachments'
insert into storage.buckets (id, name, public)
values ('chat_attachments', 'chat_attachments', true)
on conflict (id) do nothing;

-- 2. Hapus kebijakan lama jika ada untuk mencegah konflik duplikasi
drop policy if exists "Attachment files are publicly accessible" on storage.objects;
drop policy if exists "Authenticated users can upload attachments" on storage.objects;

-- 3. Buat Kebijakan Akses Baca (Siapa saja bisa melihat gambar & mendengar pesan suara)
create policy "Attachment files are publicly accessible"
on storage.objects for select
using (bucket_id = 'chat_attachments');

-- 4. Buat Kebijakan Akses Upload (Hanya pengguna login yang boleh mengunggah berkas)
create policy "Authenticated users can upload attachments"
on storage.objects for insert
with check (
    bucket_id = 'chat_attachments'
    and auth.role() = 'authenticated'
);

-- 5. Berikan hak akses (grants) pada tabel storage agar API berfungsi lancar
grant select, insert, update, delete on table storage.objects to anon, authenticated, service_role;
grant select, insert, update, delete on table storage.buckets to anon, authenticated, service_role;
```

---

## 4. Panduan Pengujian & Simulasi Serangan SQL Injection

Untuk membuktikan ketangguhan sistem terhadap serangan SQL Injection pada fitur chat baru ini, Anda dapat mencoba memasukkan input uji coba berikut di kolom masukan komentar:

### Tes 1: Payload SQL Injection Klasik di Kolom Pesan
Ketik pesan berikut di ruang obrolan, lalu kirimkan:
```text
'; DROP TABLE live_chat; --
```
* **Hasil yang Diharapkan**: Pesan terkirim dan dirender apa adanya di layar sebagai string teks murni. Tabel `live_chat` tetap aman dan tidak terhapus karena PostgREST menggunakan parameter binding yang memperlakukan input tersebut 100% sebagai nilai data string, bukan perintah SQL.

### Tes 2: Manipulasi URL File Upload
Jika peretas mencoba mengirim request manual dengan menyuntikkan karakter kutip satu pada kolom `image_url` atau `audio_url`:
```json
{
  "message": "Coba suntik URL gambar",
  "image_url": "https://supabase.co/storage/images/123.jpg'; DELETE FROM profiles; --"
}
```
* **Hasil yang Diharapkan**: Request akan diproses dengan aman. Nilai URL yang disusupi akan disimpan utuh sebagai string alamat gambar tanpa mengganggu perintah query SQL utama, mencegah kebocoran data.

---

## 5. Cara Kerja Fitur Baru di NefuSoft

1. **Pemisahan Ruang Komentar per Episode**:
   - Live Chat utama (global) memanggil `<LiveChat animeId={id} />` (tanpa `episodeId`). Kolom `episode_id` bernilai `null` di database.
   - Komentar Episode (pada halaman Watch) memanggil `<LiveChat animeId={id} episodeId={currentEpNum} />`. Semua data terekam secara terisolasi berdasarkan nomor episode, mencegah episode 3 dan episode 4 bercampur.
2. **Fitur Balasan (Replies)**:
   - Pengguna mengklik tombol **Balas** pada komentar manapun. Banner "Membalas @username" akan muncul di atas input teks.
   - Saat dikirim, `parent_id` dari pesan induk akan disimpan, dan balasan dirender secara rapi meluncur menjorok di bawah komentar induk.
3. **Pesan Suara (Voice Message)**:
   - Menekan tombol Mikrofon meminta akses mic perangkat, merekam suara secara real-time dengan penghitung waktu visual yang elegan.
   - Menekan **Kirim** mengunggah rekaman `.webm` ke folder `voice/` di bucket `chat_attachments` dan memutarnya melalui Audio Player kustom yang didesain premium.
4. **Kirim Gambar**:
   - Menekan tombol Gambar membuka galeri file perangkat Anda.
   - Setelah memilih gambar, pratinjau mini akan muncul. Saat dikirim, gambar diunggah ke folder `images/` di bucket `chat_attachments` dan ditampilkan sebagai kartu visual beresolusi tinggi di ruang chat yang dapat diperbesar menggunakan efek premium Lightbox modal.
