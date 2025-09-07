import type { FastifyInstance } from 'fastify';
import { subscribe } from '../lib/bus.js';

export async function progressRoutes(app: FastifyInstance) {
  app.get('/progress/:batchId', async (req, reply) => {
    const { batchId } = req.params as { batchId: string };
    reply.header('Content-Type', 'text/event-stream')
         .header('Cache-Control', 'no-cache')
         .header('Connection', 'keep-alive');
    // @ts-ignore
    reply.raw.flushHeaders?.();

    const send = (obj: any) => reply.raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    // heartbeat for Cloud Run
    const hb = setInterval(() => reply.raw.write(`:hb\n\n`), 25_000);

    const unsub = subscribe(batchId, send);
    send({ type: 'started', batchId, ts: Date.now() });

    req.raw.on('close', () => { clearInterval(hb); unsub(); });
  });
}