// Read-only: no credentials, file creation, or mutations. OPTIONS only.
const server = process.argv[2] || 'https://webdav.freemath.synology.me/';
const origins = ['https://shoutjoy.github.io', 'http://localhost:5173'];
const checks = [
  ['PROPFIND', ['authorization', 'depth']],
  ['GET', ['authorization']],
  ['MKCOL', ['authorization']],
  ['PUT', ['authorization', 'content-type']],
  ['PUT', ['authorization', 'content-type', 'if-none-match']],
  ['PUT', ['authorization', 'content-type', 'if-match']],
  ['MOVE', ['authorization', 'destination', 'overwrite']],
  ['DELETE', ['authorization']],
];
let failed = false;
for (const origin of origins) {
  for (const [method, headers] of checks) {
    const response = await fetch(server, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': headers.join(',') },
      signal: AbortSignal.timeout(20000),
    });
    const allowedOrigin = response.headers.get('access-control-allow-origin');
    const methods = (response.headers.get('access-control-allow-methods') || '').split(',').map(s => s.trim().toUpperCase());
    const allowedHeaders = (response.headers.get('access-control-allow-headers') || '').split(',').map(s => s.trim().toLowerCase());
    const missing = headers.filter(h => !allowedHeaders.includes(h));
    const pass = response.ok && [origin, '*'].includes(allowedOrigin) && methods.includes(method) && !missing.length;
    failed ||= !pass;
    console.log(JSON.stringify({ origin, method, requestedHeaders: headers.join(','), status: response.status, pass, missingHeaders: missing, allowedOrigin }));
  }
}
process.exitCode = failed ? 1 : 0;
