// server.js (enhanced diagnostics + optional header tweaks)
const express = require('express');
const fetch = require('node-fetch'); // v2 style
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

const DEFAULT_TEMPLATE = process.env.BASE_API_TEMPLATE || "https://api.daznfeeds.com/livestream/OutletID_PASTE/?_fmt=json&_rt=b&_fld=oaId,cmId,dc,mta,ac,heETN,heR,drm,cc,rid,desc,oid,al,sst,set,wmk,lnk.urn:perform:mfl:fixture,lmt&_als=l&_ord=sst&_ordSrt=asc&_pgSz=1000";
const UPSTREAM_REFERER = process.env.UPSTREAM_REFERER || '';
const UPSTREAM_USER_AGENT = process.env.UPSTREAM_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Livestream-Proxy/1.0';
const STRIP_CLIENT_ORIGIN = String(process.env.STRIP_CLIENT_ORIGIN || '') === '1';

app.use(cors({ origin: true, methods: ['GET', 'OPTIONS'] }));

app.get('/api/outlet/:id', async (req, res) => {
  const outletId = String(req.params.id || '').trim();
  if (!outletId) return res.status(400).json({ error: 'missing outlet id' });

  const upstreamUrl = DEFAULT_TEMPLATE.replace('OutletID_PASTE', encodeURIComponent(outletId));
  console.log(`[proxy] ${req.method} ${req.originalUrl} -> ${upstreamUrl} (from ${req.get('origin') || req.get('referer') || 'unknown'})`);

  // Build headers to send upstream (you can adjust/add as needed)
  const upstreamHeaders = {
    Accept: req.get('Accept') || 'application/json',
    'User-Agent': UPSTREAM_USER_AGENT
  };

  // Optionally set referer header if configured
  if (UPSTREAM_REFERER) upstreamHeaders.Referer = UPSTREAM_REFERER;

  // Optional: send client's 'x-forwarded-for' to upstream (helps some providers)
  if (req.ip) upstreamHeaders['X-Forwarded-For'] = req.ip;

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow'
    });

    const text = await upstreamResp.text();

    // Log body for failures to help debug 403/4xx responses
    if (!upstreamResp.ok) {
      console.warn(`[proxy] Upstream responded ${upstreamResp.status} ${upstreamResp.statusText} for ${upstreamUrl}`);
      // Show a short snippet (avoid logging massive bodies)
      const snippet = text && text.length > 1000 ? text.slice(0, 1000) + '...[truncated]' : text;
      console.warn('[proxy] Upstream body snippet:', snippet);
    } else {
      console.log(`[proxy] Upstream OK ${upstreamResp.status} for ${upstreamUrl}`);
    }

    // Forward status and body
    res.status(upstreamResp.status);
    const ct = upstreamResp.headers.get('content-type') || 'application/json';
    res.set('Content-Type', ct);
    return res.send(text);
  } catch (err) {
    console.error('[proxy] fetch error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'proxy_error', message: err && err.message ? err.message : String(err) });
  }
});

app.get('/', (req, res) => res.send('Livestream proxy is running.'));
app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));
