import basicSsl from '@vitejs/plugin-basic-ssl';

export default {
  plugins: [
    basicSsl(),
    {
      name: 'dev-overlay-rtc-signaling',
      configureServer(server) {
        server.ws.on('dev-overlay:signal', (message) => {
          console.log('[vite] signal recebido:', message.type, message.source);

          // Envia para todos os clientes.
          // Cada página ignora as mensagens dela mesma pelo campo "source".
          server.ws.send('dev-overlay:signal', message);
        });
      }
    }
  ],

  server: {
    host: true,
    https: true
  }
};