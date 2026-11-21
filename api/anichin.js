// Proxy same-origin untuk Anichin (halaman Donghua).
//
// Browser tidak dapat mengambil HTML WordPress Anichin langsung karena CORS.
// Selain itu, source kadang memblokir IP Vercel (Cloudflare) dan proxy publik
// bisa mengalami rate limit. Semua jalur transport dicoba SECARA PARALEL di
// server agar browser hanya perlu menghubungi origin sendiri dan tidak menunggu
// fallback satu per satu sampai > 1 menit.
//
// Pemakaian: /api/anichin?path=/ongoing/
// Tambahkan &diag=1 untuk respons JSON ringkas saat mendiagnosis upstream.

export const config = { maxDuration: 10 };

const ORIGIN = 'https://anichin.moe';
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-A035F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// Harus cukup pendek agar function selalu menghasilkan respons sebelum limit
// Vercel 10 detik. Dijalankan paralel, bukan dijumlahkan.
const UPSTREAM_TIMEOUT_MS = 6500;

const proxyUrl = {
  direct: (target) => target,
  allorigins: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  codetabs: (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
  corsproxy: (target) => `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
  worker: (target) => `https://cf.tiyanstores.workers.dev/?url=${encodeURIComponent(target)}`,
};

const TRANSPORTS = Object.keys(proxyUrl);

const fetchWithTimeout = async (url, ua, timeoutMs, signal) => {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': ua,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        Referer: `${ORIGIN}/`,
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    });
    const ab = await resp.arrayBuffer();
    return {
      status: resp.status,
      ctype: resp.headers.get('content-type') || 'text/html; charset=utf-8',
      body: Buffer.from(ab),
      err: '',
    };
  } catch (e) {
    return {
      status: 0,
      ctype: 'text/html; charset=utf-8',
      body: Buffer.alloc(0),
      err: String((e && e.message) || e).slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};

const looksBlocked = (result) => {
  if (!result || !result.body || result.body.length === 0) return true;
  if (result.status === 0 || result.status >= 400) return true;
  const head = result.body.subarray(0, 600).toString('utf8');
  return /just a moment|access denied|attention required|cf-browser-verification|challenge-running|captcha/i.test(head);
};

const isAssetPath = (path) => /\.(?:avif|gif|ico|jpe?g|png|svg|webp)(?:[?#]|$)/i.test(path);

// Proxy publik kadang membalas halaman limit 200 OK. Untuk dokumen HTML,
// respons harus memiliki salah satu penanda tema Anichin; image tetap boleh
// lewat tanpa pemeriksaan markup.
const looksUsable = (result, path) => {
  if (looksBlocked(result)) return false;
  if (isAssetPath(path) || !result.ctype.includes('text/html')) return true;
  const html = result.body.toString('utf8', 0, Math.min(result.body.length, 30000)).toLowerCase();
  return (
    html.includes('listupd') ||
    html.includes('bixbox') ||
    html.includes('entry-title') ||
    html.includes('eplister') ||
    html.includes('swiper-slide') ||
    /class=["'][^"']*\bbs\b/.test(html)
  );
};

const toDiagnostic = ({ transport, result }) => ({
  transport,
  status: result.status,
  bytes: result.body.length,
  err: result.err,
});

const fetchVia = async (transport, target, path, ua, signal) => {
  const result = await fetchWithTimeout(proxyUrl[transport](target), ua, UPSTREAM_TIMEOUT_MS, signal);
  if (!looksUsable(result, path)) {
    const error = new Error(`${transport} tidak memberi respons upstream yang dapat dipakai`);
    error.result = result;
    error.transport = transport;
    throw error;
  }
  return { transport, result };
};

// Promise.any membuat respons pertama yang sehat langsung dipakai. Ini sangat
// berbeda dari fallback serial di browser: kegagalan satu proxy tidak menahan
// proxy lainnya. AbortController menghentikan request sisanya setelah pemenang
// ditemukan agar function tidak terus memakai resource Vercel.
const fetchFirstHealthy = async (target, path, ua) => {
  const controller = new AbortController();
  const diagnostics = [];
  const attempts = TRANSPORTS.map((transport) =>
    fetchVia(transport, target, path, ua, controller.signal)
      .then((value) => {
        diagnostics.push(toDiagnostic(value));
        return value;
      })
      .catch((error) => {
        diagnostics.push(
          toDiagnostic({
            transport,
            result: error.result || {
              status: 0,
              body: Buffer.alloc(0),
              err: String(error.message || error).slice(0, 200),
            },
          })
        );
        throw error;
      })
  );

  try {
    const picked = await Promise.any(attempts);
    controller.abort();
    return { picked, diagnostics };
  } catch (error) {
    controller.abort();
    const failures = error?.errors || [];
    const fallback = failures
      .map((failure) => ({ transport: failure.transport || 'unknown', result: failure.result }))
      .filter((entry) => entry.result)
      .sort((a, b) => b.result.body.length - a.result.body.length)[0];

    return {
      picked: fallback || {
        transport: 'none',
        result: {
          status: 0,
          ctype: 'text/html; charset=utf-8',
          body: Buffer.alloc(0),
          err: 'semua transport upstream gagal',
        },
      },
      diagnostics,
    };
  }
};

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, 'https://local');
    let path = url.searchParams.get('path') || '/';
    if (!path.startsWith('/')) path = `/${path}`;

    // Target selalu dipatok ke ORIGIN; path tidak boleh menjadi URL lain.
    if (path.includes('://') || /[\r\n]/.test(path)) {
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('access-control-allow-origin', '*');
      return res.end(JSON.stringify({ ok: false, error: 'path tidak diizinkan' }));
    }

    const target = ORIGIN + path;
    const clientUa = (req.headers && req.headers['user-agent']) || '';
    const ua = /Mozilla\/5\.0|Chrome\/|Safari\//i.test(clientUa) ? clientUa : BROWSER_UA;
    const { picked, diagnostics } = await fetchFirstHealthy(target, path, ua);
    const { transport, result } = picked;

    if (url.searchParams.get('diag') === '1') {
      res.statusCode = looksUsable(result, path) ? 200 : 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.setHeader('access-control-allow-origin', '*');
      return res.end(
        JSON.stringify(
          {
            ok: looksUsable(result, path),
            target,
            transport,
            picked: toDiagnostic({ transport, result }),
            attempts: diagnostics,
            node: process.version,
          },
          null,
          1
        )
      );
    }

    if (!looksUsable(result, path)) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.setHeader('access-control-allow-origin', '*');
      return res.end(
        JSON.stringify({
          ok: false,
          target,
          transport,
          upstream_status: result.status,
          err: result.err || 'semua transport upstream gagal',
        })
      );
    }

    const isHtml = result.ctype.includes('text/html');
    res.statusCode = result.status || 502;
    res.setHeader('content-type', result.ctype);
    res.setHeader('x-proxy-via', 'vercel-anichin');
    res.setHeader('x-proxy-transport', transport);
    res.setHeader('access-control-allow-origin', '*');
    // s-maxage mengaktifkan cache di CDN Vercel. stale-while-revalidate
    // membuat pengunjung tetap mendapat HTML terakhir yang sukses ketika
    // source/proxy sedang error sesaat.
    res.setHeader(
      'cache-control',
      isHtml
        ? 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400'
        : 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    );
    return res.end(result.body);
  } catch (e) {
    try {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.setHeader('access-control-allow-origin', '*');
      res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e).slice(0, 200) }));
    } catch {}
  }
}
