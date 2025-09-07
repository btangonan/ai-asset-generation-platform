import { FastifyInstance } from 'fastify';
import { getState } from '../lib/ledger.js';

export async function progressRoutes(fastify: FastifyInstance) {
  fastify.get('/progress/:batchId', async (request, reply) => {
    const { batchId } = request.params as { batchId: string };
    
    // SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    
    // SSE heartbeat every 30 seconds to prevent Cloud Run timeout
    const heartbeat = setInterval(() => {
      reply.raw.write('event: ping\ndata: {}\n\n');
    }, 30000);
    
    // Poll GCS every 2 seconds
    const interval = setInterval(async () => {
      try {
        const state = await getState(batchId);
        if (!state) {
          reply.raw.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
          clearInterval(interval);
          clearInterval(heartbeat);
          reply.raw.end();
          return;
        }
        
        reply.raw.write(`data: ${JSON.stringify(state)}\n\n`);
        
        if (state.status === 'completed' || state.status === 'failed') {
          clearInterval(interval);
          clearInterval(heartbeat);
          reply.raw.end();
        }
      } catch (error) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to fetch state' })}\n\n`);
        clearInterval(interval);
        clearInterval(heartbeat);
        reply.raw.end();
      }
    }, 2000);
    
    // Clean up on disconnect
    request.raw.on('close', () => {
      clearInterval(interval);
      clearInterval(heartbeat);
    });
  });
}