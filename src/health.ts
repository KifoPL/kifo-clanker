import { createServer, type Server } from 'node:http';

export async function startHealthServer(port: number, ready: () => Promise<boolean>): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url === '/health/live') {
      res.writeHead(200).end('alive');
    } else if (req.url === '/health/ready') {
      void ready().then(value => res.writeHead(value ? 200 : 503).end(value ? 'ready' : 'unavailable'))
        .catch(() => res.writeHead(503).end('unavailable'));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => { server.off('error', reject); resolve(); });
  });
  return server;
}
