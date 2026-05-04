// dev-overlay.js
// Biblioteca para ser usada via GitHub Pages:
//
// <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
// <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
// <script src="https://msalaroli.github.io/tcc/dev-overlay.js"></script>
//
// <a-scene dev-overlay></a-scene>

(function () {
  if (typeof AFRAME === 'undefined') {
    console.error('[dev-overlay] A-Frame não encontrado. Importe aframe.min.js antes deste script.');
    return;
  }

  AFRAME.registerComponent('dev-overlay', {
    schema: {
      width:  { default: 1.0 },
      height: { default: 0.5625 },
      z:      { default: -0.9 },
      y:      { default: 1.1 },
      // autoStart removido completamente
    },

    init: function () {
      var self  = this;
      var scene = this.el.sceneEl;

      this.started            = false;
      this.peer               = null;
      this.remotePlane        = null;
      this.passthroughWindow  = null;

      // ---------- ASSETS ----------
      var assets = scene.querySelector('a-assets');
      if (!assets) {
        assets = document.createElement('a-assets');
        scene.appendChild(assets);
      }

      // vídeo remoto
      var remoteVideo = document.getElementById('remoteVideo');
      if (!remoteVideo) {
        remoteVideo = document.createElement('video');
        remoteVideo.id = 'remoteVideo';
        remoteVideo.autoplay = true;
        remoteVideo.muted = true;
        remoteVideo.playsInline = true;
        assets.appendChild(remoteVideo);
      }

      // ---------- STREAM PLANE ----------
      var remotePlane = document.createElement('a-video');
      remotePlane.setAttribute('src', '#remoteVideo');
      remotePlane.setAttribute('width',  this.data.width);
      remotePlane.setAttribute('height', this.data.height);
      remotePlane.setAttribute('position', '0 ' + this.data.y + ' ' + this.data.z);
      remotePlane.setAttribute('material', 'shader: flat; side: double');
      remotePlane.setAttribute('visible', false);
      scene.appendChild(remotePlane);
      this.remotePlane = remotePlane;

      // ---------- JANELA DE PASSTHROUGH ----------
      var passthroughWindow = document.createElement('a-plane');
      passthroughWindow.setAttribute('width',  '1.5');
      passthroughWindow.setAttribute('height', '1');
      passthroughWindow.setAttribute('position', '0 0.3 -0.5');
      passthroughWindow.setAttribute('rotation', '-90 0 0');
      passthroughWindow.setAttribute('material', 'opacity: 0; transparent: true');
      passthroughWindow.setAttribute('visible', false);
      scene.appendChild(passthroughWindow);
      this.passthroughWindow = passthroughWindow;

      // autoplay do remoto
      remoteVideo.addEventListener('loadedmetadata', function () {
        remoteVideo.play().catch(e => console.warn('[dev-overlay] play failed', e));
      });

      // ---------- HUD ----------
      var hud = document.getElementById('dev-overlay-hud');
      if (!hud) {
        hud = document.createElement('div');
        hud.id = 'dev-overlay-hud';
        hud.style.position = 'fixed';
        hud.style.top = '10px';
        hud.style.left = '10px';
        hud.style.color = '#fff';
        hud.style.font = '14px system-ui';
        hud.style.zIndex = '9999';
        hud.style.background = 'rgba(0,0,0,0.6)';
        hud.style.padding = '8px 10px';
        hud.style.borderRadius = '8px';

        hud.innerHTML =
          'Receiver ID: <code id="dev-rid">aguardando…</code><br>' +
          'Link: <code id="dev-link">aguardando…</code><br>' +
          '<small id="dev-hint">Clique no botão para ativar o Dev Overlay.</small>';

        document.body.appendChild(hud);
      }

      this.hudRidEl  = document.getElementById('dev-rid');
      this.hudLinkEl = document.getElementById('dev-link');
      this.hudHintEl = document.getElementById('dev-hint');

      // ---------- EVENTO DO BOTÃO 3D ----------
      scene.addEventListener('dev-overlay-button', function () {
        if (!self.started) self.startOverlay();
        else self.toggleOverlay();
      });

      console.log('[dev-overlay] Inicializado (modo manual — sem autoStart)');
    },

    // =====================================
    //  START OVERLAY — apenas quando clicar
    // =====================================
    startOverlay: function () {
      var self = this;

      if (this.started) return;
      this.started = true;

      console.log('[dev-overlay] Starting overlay…');

      // liga a tela + janela transparente
      this.remotePlane.setAttribute('visible', true);
      this.passthroughWindow.setAttribute('visible', true);

      if (typeof Peer === 'undefined') {
        console.error('[dev-overlay] PeerJS não encontrado!');
        this.hudLinkEl.textContent = 'PeerJS ausente';
        return;
      }

      this.hudRidEl.textContent  = 'gerando…';
      this.hudLinkEl.textContent = 'aguardando PeerJS…';

      var peer = new Peer(undefined, { debug: 2 });
      this.peer = peer;

      var remoteVideo = document.getElementById('remoteVideo');

      peer.on('open', function (id) {
        console.log('[receiver] peer open', id);

        self.hudRidEl.textContent = id;

        var link = 'https://msalaroli.github.io/tcc/stream.html?to=' + encodeURIComponent(id);
        self.hudLinkEl.textContent = link;
      });

      peer.on('call', function (call) {
        console.log('[receiver] call received from', call.peer);

        call.answer(null);

        call.on('stream', function (stream) {
          console.log('[receiver] remote stream received', stream);

          remoteVideo.srcObject = stream;
          remoteVideo.play().catch(() => {});

          self.remotePlane.setAttribute('visible', true);
          self.passthroughWindow.setAttribute('visible', true);
        });

        call.on('close', () => console.log('[receiver] call closed'));
        call.on('error', e => console.warn('[receiver] call error', e));
      });

      peer.on('error', (e) => {
        console.error('[receiver] peer error', e);
        self.hudLinkEl.textContent = 'Peer error: ' + e.type;
      });
    },

    // =====================================
    //  LIGAR/DESLIGAR tela + passthrough
    // =====================================
    toggleOverlay: function () {
      var visible = this.remotePlane.getAttribute('visible');

      console.log('[dev-overlay] Toggling overlay →', !visible);

      if (visible) {
        this.remotePlane.setAttribute('visible', false);
        this.passthroughWindow.setAttribute('visible', false);
      } else {
        this.remotePlane.setAttribute('visible', true);
        this.passthroughWindow.setAttribute('visible', true);
      }
    }
  });

  // =====================================
  //  BOTÃO 3D
  // =====================================
  AFRAME.registerComponent('dev-overlay-trigger', {
    init: function () {
      var scene = this.el.sceneEl;

      this.el.addEventListener('click', function () {
        console.log('[dev-overlay-trigger] click → emit dev-overlay-button');
        // nada de scene.enterVR() aqui
        scene.emit('dev-overlay-button');
      });
    }
  });
})();
