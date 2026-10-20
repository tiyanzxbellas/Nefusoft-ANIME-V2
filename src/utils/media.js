// Helper media URL.
//
// Sebelumnya SEMUA gambar dibungkus Cloudflare Worker (cf.tiyanstores.workers.dev).
// Worker itu diblok Cloudflare saat menarik aset animein (CF -> CF = 403), jadi
// poster sering kosong. Sekarang:
//   - URL yang sudah lewat API sendiri (apisoft.tiyan.my.id) dipakai apa adanya
//   - aset animein  -> diproxy API sendiri /v1/img (cache 24 jam, jauh lebih cepat)
//   - host lain (manga/donghua/supabase) -> tetap lewat worker seperti sebelumnya
export const API_ORIGIN = 'https://apisoft.tiyan.my.id';
const WORKER = 'https://cf.tiyanstores.workers.dev/?url=';

const isOurApi = (url) => url.startsWith(API_ORIGIN + '/') || url.startsWith('http://apisoft.tiyan.my.id/');
const isAnimein = (url) => /(^https?:\/\/)([a-z0-9-]+\.)*animein\.net\//i.test(url);

export const mediaUrl = (url) => {
  if (!url) return '';
  if (isOurApi(url)) return url;
  if (isAnimein(url)) return `${API_ORIGIN}/v1/img?url=${encodeURIComponent(url)}`;
  return WORKER + encodeURIComponent(url);
};

export default mediaUrl;
