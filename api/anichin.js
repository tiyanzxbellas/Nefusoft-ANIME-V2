// Proxy same-origin untuk anichin.moe (halaman Donghua).
//
// Tiga masalah nyata yang diselesaikan file ini:
//  1. Dulu frontend mengambil HTML lewat Cloudflare Worker (cf.tiyanstores.workers.dev).
//     Di sebagian operator (mis. XL Axiata) seluruh *.workers.dev di-DNS-hijack ke
//     blockpage -> fetch dari browser gagal total, halaman "Gagal Memuat Donghua".
//     Sekarang browser hanya bicara ke origin sendiri (/api/anichin).
//  2. Rewrite vercel.json ("https://anichin.moe/:path*") tidak bisa mempertahankan
//     trailing slash, padahal anichin butuh "/ongoing/" (tanpa slash = 403).
//     Function ini menerima path mentah lewat ?path= sehingga slash utuh.
//  3. Cloudflare anichin menantang request ber-UA non-browser ("curl/8.x" ->
//     "Just a moment..."). Dengan UA browser + header Sec-Fetch hasilnya 200.
//     Kalau tetap kena challenge / gagal, otomatis fallback ke worker (dipanggil
//     dari server Vercel, jadi blokir DNS operator tidak berpengaruh).
//
// Pemakaian: /api/anichin?path=/ongoing/   (tambahkan &diag=1 untuk diagnosa)

const ORIGIN = 'https://anichin.moe';
const WORKER = 'https://cf.tiyanstores.workers.dev/?url=';
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-A035F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const MAX_BYTES = 16 * 1024 * 1024;

const baseHeaders = (ua) => [
  '-sS', '-L', '--max-time', '20', '--compressed',
  '-A', ua,
  '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  '-H', 'Accept-Language: id-ID,id;q=0.9,en;q=0.8',
  '-H', 'Upgrade-Insecure-Requests: 1',
  '-H', 'Sec-Fetch-Dest: document',
  '-H', 'Sec-Fetch-Mode: navigate',
  '-H', 'Sec-Fetch-Site: none',
  '-H', 'Sec-Fetch-User: ?1',
];

async function runCurl(url, ua) {
  const { execFile } = await import('node:child_process');
  const args = [...baseHeaders(ua), '-w', '\n__S__%{http_code}__CT__%{content_type}', '--', url];
  const res = await new Promise((resolve) => {
    execFile('curl', args, { encoding: 'buffer', maxBuffer: MAX_BYTES, timeout: 25000 }, (err, stdout, stderr) => {
      resolve({ err, stdout: stdout || Buffer.alloc(0), stderr: stderr ? stderr.toString('utf8') : '' });
    });
  });

  const buf = res.stdout;
  const MK = Buffer.from('\n__S__');
  const idx = buf.lastIndexOf(MK);
  const body = idx >= 0 ? buf.subarray(0, idx) : buf;
  const meta = idx >= 0 ? buf.subarray(idx + MK.length).toString('latin1') : '';
  const m = meta.match(/^(\d+)__CT__(.*)$/);
  // kalau trailer tidak terbaca tapi bodynya HTML, anggap 200
  const statusGuess = m ? parseInt(m[1], 10) : body.subarray(0, 200).toString('utf8').match(/<!DOCTYPE html|<html/i) ? 200 : 0;
  return {
    status: statusGuess,
    ctype: (m && m[2]) || 'text/html; charset=utf-8',
    body,
    err: res.err ? String(res.err.message || res.err).slice(0, 200) : '',
    stderr: (res.stderr || '').slice(0, 200),
  };
}

const looksBlocked = (r) => {
  if (!r || !r.body || r.body.length === 0) return true;
  if (r.status === 0 || r.status >= 400) return true;
  const head = r.body.subarray(0, 400).toString('utf8');
  return /Just a moment|Access denied|Attention Required|cf-browser-verification/i.test(head);
};

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://local');
  let path = url.searchParams.get('path') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  if (path.includes('://') || /[\r\n]/.test(path)) {
    res.statusCode = 400;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'path tidak diizinkan' }));
  }

  const target = ORIGIN + path;
  const clientUa = req.headers['user-agent'] || '';
  // UA klien dipakai kalau memang browser; kalau tidak, pakai UA browser cadangan.
  const ua = /Mozilla\/5\.0|Chrome\/|Safari\//i.test(clientUa) ? clientUa : BROWSER_UA;

  const direct = await runCurl(target, ua);
  let picked = direct;
  let transport = 'direct';

  if (looksBlocked(direct)) {
    const viaWorker = await runCurl(WORKER + encodeURIComponent(target), ua);
    if (!looksBlocked(viaWorker) || direct.body.length === 0) {
      picked = viaWorker;
      transport = 'worker';
    }
  }

  if (url.searchParams.get('diag') === '1') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(
      JSON.stringify(
        {
          target,
          transport,
          direct: { status: direct.status, bytes: direct.body.length, err: direct.err },
          worker_used: transport === 'worker',
          picked: { status: picked.status, bytes: picked.body.length, ctype: picked.ctype },
          node: process.version,
        },
        null,
        1
      )
    );
  }

  if (looksBlocked(picked)) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    return res.end(
      JSON.stringify({ ok: false, target, transport, upstream_status: picked.status, err: picked.err, stderr: picked.stderr })
    );
  }

  const isHtml = picked.ctype.includes('text/html');
  res.statusCode = picked.status || 502;
  res.setHeader('content-type', picked.ctype);
  res.setHeader('x-proxy-via', 'vercel-anichin');
  res.setHeader('x-proxy-transport', transport);
  res.setHeader('cache-control', isHtml ? 'public, max-age=60, stale-while-revalidate=300' : 'public, max-age=86400');
  res.end(picked.body);
}
