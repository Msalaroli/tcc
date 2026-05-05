if (typeof AFRAME === 'undefined') {
  throw new Error(
    '[dev-overlay] A-Frame nao encontrado. Importe A-Frame antes de dev-overlay.js.'
  );
}

AFRAME.registerComponent('dev-overlay', {
  schema: {
    width: {
      type: 'number',
      default: 1.2
    },

    height: {
      type: 'number',
      default: 0.675
    },

    position: {
      type: 'vec3',
      default: {
        x: 0,
        y: 1.35,
        z: -1
      }
    }
  },

  init: function () {
    this.active = false;
    this.peerConnection = null;
    this.video = null;
    this.screen = null;
    this.ws = null;
    this.pendingIceCandidates = [];

    this.createRemoteVideo();
    this.createScreen();
    this.createHud();
    this.setupRtcReceiver();

    this.el.sceneEl.addEventListener('dev-overlay-toggle', () => {
      this.toggleOverlay();
    });

    console.log('[dev-overlay] componente inicializado');
  },

  createRemoteVideo: function () {
    let assets = this.el.sceneEl.querySelector('a-assets');

    if (!assets) {
      assets = document.createElement('a-assets');
      this.el.sceneEl.appendChild(assets);
    }

    let video = document.getElementById('devOverlayRemoteVideo');

    if (!video) {
      video = document.createElement('video');
      video.id = 'devOverlayRemoteVideo';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.style.display = 'none';

      assets.appendChild(video);
    }

    this.video = video;
  },

  createScreen: function () {
    const screen = document.createElement('a-video');

    screen.setAttribute('src', '#devOverlayRemoteVideo');
    screen.setAttribute('width', this.data.width);
    screen.setAttribute('height', this.data.height);
    screen.setAttribute(
      'position',
      `${this.data.position.x} ${this.data.position.y} ${this.data.position.z}`
    );
    screen.setAttribute('material', 'shader: flat; side: double');
    screen.setAttribute('visible', false);

    this.el.sceneEl.appendChild(screen);
    this.screen = screen;
  },

  createHud: function () {
    let hud = document.getElementById('dev-overlay-hud');

    if (hud) {
      return;
    }

    hud = document.createElement('div');
    hud.id = 'dev-overlay-hud';
    hud.style.position = 'fixed';
    hud.style.left = '12px';
    hud.style.top = '12px';
    hud.style.zIndex = '9999';
    hud.style.padding = '10px 12px';
    hud.style.borderRadius = '10px';
    hud.style.background = 'rgba(0, 0, 0, 0.65)';
    hud.style.color = '#fff';
    hud.style.font = '14px system-ui, Arial, sans-serif';
    hud.style.maxWidth = '360px';

    hud.innerHTML = `
      <strong>Dev Overlay</strong><br>
      <span id="dev-overlay-status">Aguardando stream.</span><br>
      <small>
        Abra <code>/stream.html</code> no computador e clique em
        <strong>Compartilhar tela</strong>.
      </small>
    `;

    document.body.appendChild(hud);
  },

  setHudStatus: function (text) {
    const status = document.getElementById('dev-overlay-status');

    if (status) {
      status.textContent = text;
    }
  },

  setupRtcReceiver: function () {
    if (this.peerConnection) {
        console.log('[dev-overlay] fechando conexao antiga');
        this.peerConnection.close();
        this.peerConnection = null;
    }

    this.pendingIceCandidates = [];

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/dev-overlay-ws`;

    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
        console.log('[dev-overlay] websocket conectado');
        this.setHudStatus('Canal de sinalizacao conectado.');

        setTimeout(() => {
        this.sendSignal({
            type: 'rtc:connect',
            source: 'overlay',
            time: Date.now()
        });
        }, 300);
    });

    this.ws.addEventListener('message', async (event) => {
        const message = JSON.parse(event.data);

        if (!message || message.source === 'overlay') {
        return;
        }

        console.log('[dev-overlay] sinal recebido:', message.type, message.source);

        try {
        if (message.type === 'rtc:offer') {
            if (this.peerConnection) {
            this.peerConnection.close();
            }

            this.peerConnection = new RTCPeerConnection();

            this.peerConnection.ontrack = (trackEvent) => {
            console.log('[dev-overlay] stream recebido', trackEvent.streams[0]);

            this.video.srcObject = trackEvent.streams[0];

            this.video.play().catch((error) => {
                console.warn('[dev-overlay] falha ao executar video', error);
            });

            this.screen.setAttribute('src', '#devOverlayRemoteVideo');
            this.setHudStatus('Stream recebido.');
            };

            this.peerConnection.onicecandidate = (iceEvent) => {
            if (iceEvent.candidate) {
                this.sendSignal({
                type: 'rtc:ice',
                source: 'overlay',
                data: iceEvent.candidate
                });
            }
            };

            this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;

            console.log('[dev-overlay] connectionState:', state);

            if (state === 'connected') {
                this.setHudStatus('Conexao WebRTC estabelecida.');
            }

            if (state === 'failed' || state === 'disconnected') {
                this.setHudStatus('Conexao perdida. Solicitando reconexao...');

                setTimeout(() => {
                this.sendSignal({
                    type: 'rtc:connect',
                    source: 'overlay',
                    time: Date.now()
                });
                }, 500);
            }
            };

            await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.data)
            );

            if (this.pendingIceCandidates.length > 0) {
            for (const candidate of this.pendingIceCandidates) {
                await this.peerConnection.addIceCandidate(candidate);
            }

            this.pendingIceCandidates = [];
            }

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.sendSignal({
            type: 'rtc:answer',
            source: 'overlay',
            data: answer
            });

            this.setHudStatus('Conexao WebRTC respondida.');
        }

        if (message.type === 'rtc:ice') {
            const candidate = new RTCIceCandidate(message.data);

            if (this.peerConnection && this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(candidate);
            } else {
            this.pendingIceCandidates.push(candidate);
            }
        }
        } catch (error) {
        console.error('[dev-overlay] erro WebRTC', error);
        this.setHudStatus('Erro WebRTC: ' + error.message);
        }
    });

    this.ws.addEventListener('close', () => {
        console.warn('[dev-overlay] websocket fechado');

        this.setHudStatus('Canal fechado. Reconectando...');

        setTimeout(() => {
        this.setupRtcReceiver();
        }, 1000);
    });

    this.ws.addEventListener('error', (error) => {
        console.warn('[dev-overlay] websocket error:', error);
    });
  },

  toggleOverlay: function () {
    this.active = !this.active;
    this.setOverlayActive(this.active);
  },

  sendSignal: function (message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('[dev-overlay] websocket indisponivel:', message.type);
        return;
    }

    this.ws.send(JSON.stringify(message));
  },

  setOverlayActive: function (active) {
    this.screen.setAttribute('visible', active);

    const elementsToHide = this.el.sceneEl.querySelectorAll(
      '.dev-overlay-hide-when-active'
    );

    elementsToHide.forEach((element) => {
      element.setAttribute('visible', !active);
    });

    this.setHudStatus(
      active
        ? 'Overlay ativo. Elementos marcados foram ocultados.'
        : 'Overlay desativado. Cena restaurada.'
    );

    this.el.sceneEl.emit(active ? 'dev-overlay-enabled' : 'dev-overlay-disabled');
  }
});

AFRAME.registerComponent('dev-overlay-trigger', {
  init: function () {
    this.el.addEventListener('click', () => {
      this.el.sceneEl.emit('dev-overlay-toggle');
    });
  }
});

AFRAME.registerComponent('follow-camera', {
  tick: function () {
    const camera = this.el.sceneEl.camera.el;

    if (!camera) return;

    const camWorldPos = new THREE.Vector3();
    const camWorldQuat = new THREE.Quaternion();

    camera.object3D.getWorldPosition(camWorldPos);
    camera.object3D.getWorldQuaternion(camWorldQuat);

    const offset = new THREE.Vector3(0.4, 0.25, -0.8);
    offset.applyQuaternion(camWorldQuat);

    this.el.object3D.position.copy(camWorldPos).add(offset);
    this.el.object3D.quaternion.copy(camWorldQuat);
  }
});