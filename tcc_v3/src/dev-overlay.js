if (typeof AFRAME === 'undefined') {
  throw new Error(
    '[dev-overlay] A-Frame was not found. Import A-Frame before dev-overlay.js.'
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

    console.log('[dev-overlay] Component initialized');
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
      <span id="dev-overlay-status">Waiting for stream.</span><br>
      <small>
        Open <code>/stream.html</code> on your computer and click
        <strong>Share screen</strong>.
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
      console.log('[dev-overlay] Closing previous peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.pendingIceCandidates = [];

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/dev-overlay-ws`;

    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      console.log('[dev-overlay] WebSocket connected');
      this.setHudStatus('Signaling channel connected.');

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

      console.log('[dev-overlay] Signal received:', message.type, message.source);

      try {
        if (message.type === 'rtc:offer') {
          if (this.peerConnection) {
            this.peerConnection.close();
          }

          this.peerConnection = new RTCPeerConnection();

          this.peerConnection.ontrack = (trackEvent) => {
            console.log('[dev-overlay] Remote stream received', trackEvent.streams[0]);

            this.video.srcObject = trackEvent.streams[0];

            this.video.play().catch((error) => {
              console.warn('[dev-overlay] Failed to play remote video', error);
            });

            this.screen.setAttribute('src', '#devOverlayRemoteVideo');
            this.setHudStatus('Remote stream received.');
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

            console.log('[dev-overlay] Connection state:', state);

            if (state === 'connected') {
              this.setHudStatus('WebRTC connection established.');
            }

            if (state === 'failed' || state === 'disconnected') {
              this.setHudStatus('Connection lost. Requesting reconnection...');

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
            console.log(
              '[dev-overlay] Applying pending ICE candidates:',
              this.pendingIceCandidates.length
            );

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

          this.setHudStatus('WebRTC answer sent.');
        }

        if (message.type === 'rtc:ice') {
          const candidate = new RTCIceCandidate(message.data);

          if (this.peerConnection && this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(candidate);
            console.log('[dev-overlay] ICE candidate applied');
          } else {
            console.log('[dev-overlay] ICE candidate queued');
            this.pendingIceCandidates.push(candidate);
          }
        }
      } catch (error) {
        console.error('[dev-overlay] WebRTC error', error);
        this.setHudStatus('WebRTC error: ' + error.message);
      }
    });

    this.ws.addEventListener('close', () => {
      console.warn('[dev-overlay] WebSocket closed');
      this.setHudStatus('Signaling channel closed. Reconnecting...');

      setTimeout(() => {
        this.setupRtcReceiver();
      }, 1000);
    });

    this.ws.addEventListener('error', (error) => {
      console.warn('[dev-overlay] WebSocket error:', error);
    });
  },

  toggleOverlay: function () {
    this.active = !this.active;
    this.setOverlayActive(this.active);
  },

  sendSignal: function (message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[dev-overlay] WebSocket unavailable:', message.type);
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
        ? 'Overlay enabled. Marked scene elements are now hidden.'
        : 'Overlay disabled. Scene restored.'
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