// dev-overlay-peer.js
// Biblioteca para ser usada via GitHub Pages:
//
// <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
// <script src="https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js"></script>
// <script src="https://msalaroli.github.io/tcc/dev-overlay-peer.js"></script>
//
// <a-scene dev-overlay></a-scene>

(function () {
  if (typeof AFRAME === 'undefined') {
    console.error('[dev-overlay] A-Frame não encontrado. Importe aframe.min.js antes deste script.');
    return;
  }

  /**
   * Componente principal:
   *
   * - Cria os planos de vídeo (stream remoto + fallback de câmera).
   * - Gerencia fallback de câmera quando não está em XR.
   * - Quando iniciado, cria um PeerJS receiver.
   * - Mostra na HUD:
   *     - Receiver ID
   *     - Link pronto: https://msalaroli.github.io/tcc/stream.html?to=<ID>
   *
   * Modo de uso:
   *
   * 1) Modo automático (inicia sozinho ao carregar a cena):
   *    <a-scene dev-overlay>
   *
   * 2) Modo manual com botão 3D:
   *    <a-scene dev-overlay="autoStart: false">
   *      <a-entity
   *        geometry="primitive: plane; width: 0.4; height: 0.15"
   *        material="color: #24CAFF"
   *        position="0 1.3 -0.8"
   *        dev-overlay-trigger>
   *        <a-text value="Iniciar Dev Overlay" align="center" color="#000" position="0 0 0.01"></a-text>
   *      </a-entity>
   *    </a-scene>
   *
   *  O componente dev-overlay-trigger emite o evento "dev-overlay-start"
   *  na cena, e o dev-overlay começa o fluxo (cria Peer, HUD etc.).
   */

  AFRAME.registerComponent('dev-overlay', {
    schema: {
      width:     { default: 1.0 },      // largura do overlay
      height:    { default: 0.5625 },   // altura do overlay (16:9)
      z:         { default: -0.9 },     // distância à frente da câmera
      y:         { default: 1.1 },      // altura do overlay
      autoStart: { default: true }      // se deve iniciar automaticamente
    },

    init: function () {
      var self  = this;
      var scene = this.el.sceneEl;

      this.started = false;
      this.peer    = null;

      // --- garante <a-assets> ---
      var assets = scene.querySelector('a-assets');
      if (!assets) {
        assets = document.createElement('a-assets');
        scene.appendChild(assets);
      }

      // --- cria / obtém vídeos ---
      var remoteVideo = document.getElementById('remoteVideo');
      if (!remoteVideo) {
        remoteVideo = document.createElement('video');
        remoteVideo.id = 'remoteVideo';
        remoteVideo.autoplay = true;
        remoteVideo.muted = true;
        remoteVideo.playsInline = true;
        assets.appendChild(remoteVideo);
      }

      var passVideo = document.getElementById('passVideo');
      if (!passVideo) {
        passVideo = document.createElement('video');
        passVideo.id = 'passVideo';
        passVideo.autoplay = true;
        passVideo.muted = true;
        passVideo.playsInline = true;
        assets.appendChild(passVideo);
      }

      // --- plano do stream remoto (tela flutuando) ---
      var remotePlane = document.createElement('a-video');
      remotePlane.setAttribute('src', '#remoteVideo');
      remotePlane.setAttribute('width',  this.data.width);
      remotePlane.setAttribute('height', this.data.height);
      remotePlane.setAttribute('position', '0 ' + this.data.y + ' ' + this.data.z);
      remotePlane.setAttribute('material', 'shader: flat; side: double');
      scene.appendChild(remotePlane);
      this.remotePlane = remotePlane;

      // --- plano do chão (fallback pass through) ---
      var passPlane = document.createElement('a-video');
      passPlane.setAttribute('src', '#passVideo');
      passPlane.setAttribute('width',  '1.5');
      passPlane.setAttribute('height', '1');
      passPlane.setAttribute('position', '0 0.3 -0.5');
      passPlane.setAttribute('rotation', '-90 0 0');
      passPlane.setAttribute('material', 'shader: flat; side: double');
      passPlane.setAttribute('visible', 'true');
      scene.appendChild(passPlane);
      this.passPlane = passPlane;

      // --- fallback getUserMedia (desktop / não-XR) ---
      var enableFallback = function () {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('[dev-overlay] getUserMedia não disponível, escondendo fallback.');
          passPlane.setAttribute('visible', 'false');
          return;
        }

        navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        }).then(function (s) {
          passVideo.srcObject = s;
          passVideo.onloadedmetadata = function () { passVideo.play(); };
          passPlane.setAttribute('visible', 'true');
          console.log('[dev-overlay] fallback câmera local ativo');
        }).catch(function (e) {
          console.warn('[dev-overlay] sem câmera local; escondendo chão', e);
          passPlane.setAttribute('visible', 'false');
        });
      };

      // ativa fallback inicialmente
      enableFallback();

      // entra em VR/AR → esconde chão; sai → reativa fallback
      scene.addEventListener('enter-vr', function () {
        passPlane.setAttribute('visible', 'false');
        console.log('[xr] session start → escondendo fallback');
      });
      scene.addEventListener('exit-vr', function () {
        console.log('[xr] session end → reativando fallback');
        enableFallback();
      });

      // garante autoplay do stream remoto
      remoteVideo.addEventListener('loadedmetadata', function () {
        remoteVideo.play().catch(function (e) {
          console.warn('[dev-overlay] falha ao dar play no remoto', e);
        });
      });

      // --- HUD (fica pronta, mas só é "preenchida" quando startOverlay() rodar) ---
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
          'Receiver ID: <code id="dev-rid">aguardando início…</code><br>' +
          'Link: <code id="dev-link">aguardando início…</code><br>' +
          '<small id="dev-hint">Inicie o Dev Overlay pelo botão do jogo ou automaticamente.</small>';

        document.body.appendChild(hud);
      }

      this.hudRidEl  = document.getElementById('dev-rid');
      this.hudLinkEl = document.getElementById('dev-link');
      this.hudHintEl = document.getElementById('dev-hint');

      // --- evento global "dev-overlay-start" para iniciar manualmente ---
      scene.addEventListener('dev-overlay-start', function () {
        self.startOverlay();
      });

      // --- modo automático (autoStart: true) ---
      if (this.data.autoStart) {
        this.startOverlay();
      }
    },

    /**
     * Inicia o PeerJS receiver + HUD com ID e link.
     * Pode ser chamado automaticamente (autoStart) ou via evento "dev-overlay-start".
     */
    startOverlay: function () {
      var self = this;

      if (this.started) {
        console.log('[dev-overlay] já iniciado, ignorando chamada extra.');
        return;
      }
      this.started = true;

      if (typeof Peer === 'undefined') {
        console.warn('[dev-overlay] PeerJS não encontrado. Importe peerjs.min.js antes deste script.');
        if (this.hudLinkEl) {
          this.hudLinkEl.textContent = 'Erro: PeerJS não carregado.';
        }
        return;
      }

      if (this.hudRidEl)  this.hudRidEl.textContent  = 'gerando…';
      if (this.hudLinkEl) this.hudLinkEl.textContent = 'aguardando PeerJS…';
      if (this.hudHintEl) this.hudHintEl.textContent = 'Abra o link no PC para escolher a janela (VS Code, etc.).';

      // PeerJS Cloud com ID aleatório
      var peer = new Peer(undefined, { debug: 2 });
      this.peer = peer;

      var remoteVideo = document.getElementById('remoteVideo');
      var passPlane   = this.passPlane;

      peer.on('open', function (id) {
        console.log('[receiver] peer open', id);
        if (self.hudRidEl) {
          self.hudRidEl.textContent = id;
        }

        // link fixo para seu GitHub Pages
        var link = 'https://msalaroli.github.io/tcc/stream.html?to=' + encodeURIComponent(id);
        if (self.hudLinkEl) {
          self.hudLinkEl.textContent = link;
        }
      });

      peer.on('call', function (call) {
        console.log('[receiver] call received from', call.peer);
        call.answer(null); // não enviamos mídia local

        call.on('stream', function (stream) {
          console.log('[receiver] remote stream received', stream);
          remoteVideo.srcObject = stream;
          remoteVideo.onloadedmetadata = function () {
            remoteVideo.play().catch(function (e) {
              console.warn('[receiver] falha no play do remoto', e);
            });
          };

          // ao receber stream, esconde o chão
          if (passPlane) {
            passPlane.setAttribute('visible', 'false');
          }
        });

        call.on('error', function (e) {
          console.warn('[receiver] call error', e);
          if (self.hudLinkEl) {
            self.hudLinkEl.textContent = 'Erro na chamada: ' + e.type;
          }
        });

        call.on('close', function () {
          console.log('[receiver] call closed');
        });
      });

      peer.on('error', function (e) {
        console.warn('[receiver] peer error', e);
        if (self.hudLinkEl) {
          self.hudLinkEl.textContent = 'Peer error: ' + e.type;
        }
      });
    }
  });

  /**
   * Componente auxiliar para botão 3D dentro do jogo.
   *
   * Basta adicionar dev-overlay-trigger em qualquer entidade clicável.
   * Quando clicada, ela emite "dev-overlay-start" na cena.
   */
  AFRAME.registerComponent('dev-overlay-trigger', {
    init: function () {
      var scene = this.el.sceneEl;
      this.el.addEventListener('click', function () {
        console.log('[dev-overlay-trigger] click → emit dev-overlay-start');
        scene.emit('dev-overlay-start');
      });
    }
  });
})();
