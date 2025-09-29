// server.js
const express = require('express');
const fetch = require('node-fetch'); // v2 style import for node-fetch v2
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Accept CORS from any origin (you can restrict origin to your GitHub Pages URL if desired)
app.use(cors({
  origin: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'User-Agent']
}));

// Upstream template: supply via RENDER env var BASE_API_TEMPLATE or use default
const DEFAULT_TEMPLATE = "https://api.daznfeeds.com/livestream/OutletID_PASTE/?_fmt=json&_rt=b&_fld=oaId,cmId,dc,mta,ac,heETN,heR,drm,cc,rid,desc,oid,al,sst,set,wmk,lnk.urn:perform:mfl:fixture,lmt&_als=l&_ord=sst&_ordSrt=asc&_pgSz=1000";
const BASE_API_TEMPLATE = process.env.BASE_API_TEMPLATE || DEFAULT_TEMPLATE;

app.get('/api/outlet/:id', async (req, res) => {
  try {
    const outletId = String(req.params.id || '').trim();
    if (!outletId) return res.status(400).json({ error: 'missing outlet id' });

    const upstreamUrl = BASE_API_TEMPLATE.replace('OutletID_PASTE', encodeURIComponent(outletId));

    console.log(`[proxy] ${req.method} ${req.originalUrl} -> ${upstreamUrl} (from ${req.get('origin') || 'unknown'})`);

    const upstreamResp = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: req.get('Accept') || 'application/json',
        'User-Agent': req.get('User-Agent') || 'Livestream-Proxy/1.0'
      },
      // optionally add an AbortController timeout in future
    });

    const text = await upstreamResp.text();

    // forward status & body
    res.status(upstreamResp.status);
    const ct = upstreamResp.headers.get('content-type') || 'application/json';
    res.set('Content-Type', ct);
    // Security: keep connection open for large responses
    return res.send(text);
  } catch (err) {
    console.error('Proxy error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'proxy_error', message: err.message || String(err) });
  }
});

app.get('/', (req, res) => res.send('Livestream proxy is running.'));
app.listen(PORT, () => console.log(`Proxy listening on port ${PORT}`));