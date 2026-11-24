import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { mcp } from './api/mcp';

function devMcp(): Plugin {
  return {
    name: 'matrix-dev-mcp',
    configureServer(server) {
      server.middlewares.use('/api/mcp', async (req, res, next) => {
        try {
          let body = '';
          for await (const chunk of req) {
            body += String(chunk);
            if (body.length > 10000) {
              res.statusCode = 413;
              res.end();
              return;
            }
          }
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers))
            if (typeof value === 'string') headers.set(key, value);
          const method = req.method ?? 'GET';
          const request = new Request('http://' + req.headers.host + '/api/mcp', {
            method,
            headers,
            ...(method === 'GET' || method === 'HEAD' ? {} : { body }),
          });
          const response = await mcp(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(await response.text());
        } catch (error) {
          next(error instanceof Error ? error : new Error('MCP request failed'));
        }
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), devMcp()],
  build: { chunkSizeWarningLimit: 1500 },
});
