import basicSsl from '@vitejs/plugin-basic-ssl';
import { WebSocketServer } from 'ws';

function devOverlaySignaling() {
  return {
    name: 'dev-overlay-signaling',

    configureServer(server) {
      if (!server.httpServer) {
        return;
      }

      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, 'https://localhost');

        if (url.pathname !== '/dev-overlay-ws') {
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      });

      wss.on('connection', (ws) => {
        console.log('[vite] dev-overlay client connected');

        ws.on('message', (raw) => {
          let message;

          try {
            message = JSON.parse(raw.toString());
          } catch {
            return;
          }

          console.log('[vite] signal:', message.type, message.source);

          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === client.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        });

        ws.on('close', () => {
          console.log('[vite] dev-overlay client disconnected');
        });
      });
    }
  };
}

export default {
  plugins: [
    basicSsl(),
    devOverlaySignaling()
  ],

  server: {
    host: true,
    https: true
  }
};