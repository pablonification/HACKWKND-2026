import { createServer } from 'node:http';
import { Readable } from 'node:stream';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 10532;
const DEFAULT_TARGET = 'http://127.0.0.1:10531';
const DEFAULT_MAX_BYTES = 1_048_576;

const host = process.env.TALEKA_DEMO_GATEWAY_HOST ?? DEFAULT_HOST;
const port = Number.parseInt(process.env.TALEKA_DEMO_GATEWAY_PORT ?? String(DEFAULT_PORT), 10);
const targetBase = (process.env.TALEKA_DEMO_PROXY_TARGET ?? DEFAULT_TARGET).replace(/\/$/, '');
const proxyKey = process.env.TALEKA_DEMO_PROXY_KEY?.trim() ?? '';
const maxBytes = Number.parseInt(
  process.env.TALEKA_DEMO_PROXY_MAX_BYTES ?? String(DEFAULT_MAX_BYTES),
  10,
);

const allowedRoutes = new Set([
  'GET /v1/models',
  'POST /v1/responses',
  'POST /v1/chat/completions',
]);

if (!proxyKey) {
  console.error('TALEKA_DEMO_PROXY_KEY is required.');
  process.exit(1);
}

const sendJson = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', (chunk) => {
      if (rejected) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
        reject(new Error(`Request body exceeds ${maxBytes} bytes.`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const buildTargetUrl = (requestUrl) => {
  const sourceUrl = new URL(requestUrl, `http://${host}:${port}`);
  const baseUrl = new URL(targetBase);
  const basePath = baseUrl.pathname === '/' ? '' : baseUrl.pathname.replace(/\/$/, '');
  const requestPath =
    basePath.endsWith('/v1') && sourceUrl.pathname.startsWith('/v1/')
      ? sourceUrl.pathname.slice('/v1'.length)
      : sourceUrl.pathname;

  return new URL(`${basePath}${requestPath}${sourceUrl.search}`, baseUrl.origin);
};

const toForwardHeaders = (headers) => {
  const forwarded = new Headers();
  const blockedHeaders = new Set([
    'authorization',
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);

  for (const [name, value] of Object.entries(headers)) {
    if (blockedHeaders.has(name.toLowerCase()) || value === undefined) {
      continue;
    }
    forwarded.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  forwarded.set('Authorization', 'Bearer sk-dummy');
  return forwarded;
};

const writeUpstreamResponse = (res, upstream) => {
  const headers = {};
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'transfer-encoding') {
      headers[key] = value;
    }
  });

  res.writeHead(upstream.status, headers);
  if (!upstream.body) {
    res.end();
    return;
  }

  Readable.fromWeb(upstream.body).pipe(res);
};

const server = createServer(async (req, res) => {
  const startedAt = Date.now();
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://${host}:${port}`);
  const route = `${method} ${url.pathname}`;

  try {
    if (req.headers.authorization !== `Bearer ${proxyKey}`) {
      sendJson(res, 401, { error: 'Unauthorized.' });
      return;
    }

    if (!allowedRoutes.has(route)) {
      sendJson(res, 404, { error: 'Route not found.' });
      return;
    }

    const body = method === 'GET' ? undefined : await readRequestBody(req);
    const upstream = await fetch(buildTargetUrl(req.url ?? '/'), {
      method,
      headers: toForwardHeaders(req.headers),
      body: body && body.length > 0 ? body : undefined,
    });

    writeUpstreamResponse(res, upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected gateway error.';
    const status = /exceeds \d+ bytes/i.test(message) ? 413 : 502;
    if (!res.headersSent) {
      sendJson(res, status, { error: message });
    } else {
      res.destroy(error instanceof Error ? error : undefined);
    }
  } finally {
    console.log(
      `${new Date().toISOString()} ${route} ${res.statusCode} ${Date.now() - startedAt}ms`,
    );
  }
});

server.listen(port, host, () => {
  console.log(`Taleka demo gateway listening on http://${host}:${port}`);
  console.log(`Forwarding allowed /v1 routes to ${targetBase}`);
});
