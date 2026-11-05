// Custom server: Next.js route handlers can't hold WebSocket connections, so Socket.IO
// (used for WebRTC signalling) shares this HTTP server with the Next.js app.
import { createServer } from 'node:http';
import next from 'next';
import { attachSignalling } from './lib/signalling';

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production';

const httpServer = createServer();
const app = next({ dev, port, httpServer });
const handle = app.getRequestHandler();

await app.prepare();
httpServer.on('request', (req, res) => handle(req, res));
attachSignalling(httpServer);

httpServer.listen(port, () => {
  console.log(`> Watch Together ready on http://localhost:${port} (${dev ? 'development' : 'production'})`);
});
