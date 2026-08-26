const http = require('node:http');
const net = require('node:net');

const server = http.createServer((req, res) => {
  res.writeHead(502, {'content-type': 'text/plain'});
  res.end('WDCC proof relay supports HTTPS CONNECT only.');
});

server.on('connect', (req, client, head) => {
  const i = req.url.lastIndexOf(':');
  const host = i > 0 ? req.url.slice(0, i) : req.url;
  const port = i > 0 ? Number(req.url.slice(i + 1)) || 443 : 443;
  const upstream = net.connect(port, host);
  let opened = false;

  upstream.once('connect', () => {
    opened = true;
    client.write('HTTP/1.1 200 Connection Established\r\nProxy-Agent: wdcc-proof-relay\r\n\r\n');
    if (head && head.length) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });

  const fail = err => {
    if (!opened && !client.destroyed) {
      client.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    }
    upstream.destroy();
    client.destroy();
    if (err) console.error(`WDCC_PROOF_RELAY_CONNECT_FAIL ${host}:${port} ${err.message || err}`);
  };
  upstream.once('error', fail);
  client.once('error', fail);
});

const ready = new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const playwright = require('playwright');
const originalLaunch = playwright.chromium.launch.bind(playwright.chromium);
playwright.chromium.launch = async function patchedLaunch(options = {}) {
  await ready;
  const address = server.address();
  const proxy = {server: `http://127.0.0.1:${address.port}`};
  console.log(`WDCC_PROOF_RELAY_READY ${proxy.server}`);
  return originalLaunch({...options, proxy});
};

process.once('exit', () => {
  try { server.close(); } catch {}
});
