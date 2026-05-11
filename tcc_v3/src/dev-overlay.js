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
    },

    debugLogs: {
      type: 'boolean',
      default: true
    },

    debugIntervalMs: {
      type: 'number',
      default: 15000
    }
  },

  init: function () {
    this.active = false;
    this.peerConnection = null;
    this.video = null;
    this.screen = null;
    this.ws = null;
    this.pendingIceCandidates = [];
    this.debugIntervalId = null;

    this.createRemoteVideo();
    this.createScreen();
    this.createHud();
    this.setupRtcReceiver();

    this.el.sceneEl.addEventListener('dev-overlay-toggle', () => {
      this.toggleOverlay();
    });

    this.setupXrDebugLogs();

    this.sendDevLog('log', 'Component initialized');
  },

  remove: function () {
    if (this.debugIntervalId) {
      clearInterval(this.debugIntervalId);
      this.debugIntervalId = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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
      this.sendDevLog('log', 'Closing previous peer connection');
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.pendingIceCandidates = [];

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/dev-overlay-ws`;

    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.sendDevLog('log', 'WebSocket connected');
      this.setHudStatus('Signaling channel connected.');

      setTimeout(() => {
        this.sendSignal({
          type: 'rtc:connect',
          source: 'overlay',
          time: Date.now()
        });

        this.sendDevLog('log', 'Connection request sent to stream page');
      }, 300);
    });

    this.ws.addEventListener('message', async (event) => {
      const message = JSON.parse(event.data);

      if (!message || message.source === 'overlay') {
        return;
      }

      this.sendDevLog('log', 'Signal received', {
        type: message.type,
        source: message.source
      });

      try {
        if (message.type === 'rtc:offer') {
          if (this.peerConnection) {
            this.sendDevLog('log', 'Closing peer connection before applying new offer');
            this.peerConnection.close();
          }

          this.peerConnection = new RTCPeerConnection();

          this.peerConnection.ontrack = (trackEvent) => {
            this.sendDevLog('log', 'Remote stream received', {
              streamCount: trackEvent.streams.length,
              trackKind: trackEvent.track?.kind || null,
              trackReadyState: trackEvent.track?.readyState || null
            });

            this.video.srcObject = trackEvent.streams[0];

            this.video.play().catch((error) => {
              this.sendDevLog('warn', 'Failed to play remote video', {
                message: error.message
              });
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

              this.sendDevLog('log', 'ICE candidate sent');
            }
          };

          this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;

            this.sendDevLog('log', 'WebRTC connection state changed', {
              connectionState: state,
              iceConnectionState: this.peerConnection.iceConnectionState,
              signalingState: this.peerConnection.signalingState
            });

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

                this.sendDevLog('warn', 'Connection lost. Reconnection requested', {
                  connectionState: state
                });
              }, 500);
            }
          };

          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.data)
          );

          this.sendDevLog('log', 'Remote description applied', {
            type: message.data?.type || null
          });

          if (this.pendingIceCandidates.length > 0) {
            this.sendDevLog('log', 'Applying pending ICE candidates', {
              count: this.pendingIceCandidates.length
            });

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

          this.sendDevLog('log', 'WebRTC answer sent');
          this.setHudStatus('WebRTC answer sent.');
        }

        if (message.type === 'rtc:ice') {
          const candidate = new RTCIceCandidate(message.data);

          if (this.peerConnection && this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(candidate);

            this.sendDevLog('log', 'ICE candidate applied');
          } else {
            this.pendingIceCandidates.push(candidate);

            this.sendDevLog('log', 'ICE candidate queued', {
              pendingCount: this.pendingIceCandidates.length
            });
          }
        }
      } catch (error) {
        this.sendDevLog('error', 'WebRTC error', {
          message: error.message,
          name: error.name || null
        });

        this.setHudStatus('WebRTC error: ' + error.message);
      }
    });

    this.ws.addEventListener('close', () => {
      this.sendDevLog('warn', 'WebSocket closed');
      this.setHudStatus('Signaling channel closed. Reconnecting...');

      setTimeout(() => {
        this.setupRtcReceiver();
      }, 1000);
    });

    this.ws.addEventListener('error', (error) => {
      this.sendDevLog('warn', 'WebSocket error', {
        message: error.message || 'Unknown WebSocket error'
      });
    });
  },

  setupXrDebugLogs: function () {
    if (!this.data.debugLogs) {
      return;
    }

    this.el.sceneEl.addEventListener('enter-vr', () => {
      this.sendXrStateSnapshot('enter-vr event fired');
    });

    this.el.sceneEl.addEventListener('exit-vr', () => {
      this.sendXrStateSnapshot('exit-vr event fired');
    });

    this.el.sceneEl.addEventListener('loaded', () => {
      this.sendXrStateSnapshot('scene loaded event fired');
    });

    this.el.sceneEl.addEventListener('renderstart', () => {
      this.sendXrStateSnapshot('renderstart event fired');
    });

    this.debugIntervalId = setInterval(() => {
      this.sendXrStateSnapshot('XR state snapshot');
    }, this.data.debugIntervalMs);
  },

  getXrState: function () {
    const scene = this.el.sceneEl;
    const renderer = scene.renderer || null;
    const xr = renderer?.xr || null;
    const session = xr?.getSession?.() || null;
    const canvas = scene.canvas || null;

    return {
      isVrMode: scene.is('vr-mode'),
      isArMode: scene.is('ar-mode'),
      xrPresenting: xr?.isPresenting || false,
      hasSession: Boolean(session),
      sessionMode: session?.mode || null,
      visibilityState: document.visibilityState,
      sceneHasLoaded: scene.hasLoaded,
      canvasBackground: canvas?.style?.background || null,
      bodyBackground: document.body?.style?.background || null,
      htmlBackground: document.documentElement?.style?.background || null,
      screenVisible: this.screen?.getAttribute('visible') || false,
      overlayActive: this.active
    };
  },

  sendXrStateSnapshot: function (label) {
    this.sendDevLog('log', label, this.getXrState());
  },

  toggleOverlay: function () {
    this.active = !this.active;
    this.setOverlayActive(this.active);

    this.sendDevLog('log', 'Overlay toggled', {
      active: this.active
    });
  },

  sendSignal: function (message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[dev-overlay] WebSocket unavailable:', message.type);
      return;
    }

    this.ws.send(JSON.stringify(message));
  },

  sendDevLog: function (level, message, data = null) {
    const payload = {
      type: 'dev:log',
      source: 'quest-overlay',
      level,
      message,
      data,
      time: new Date().toISOString()
    };

    const consoleMethod =
      level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

    console[consoleMethod]('[dev-overlay]', message, data || '');

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify(payload));
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

    this.sendXrStateSnapshot(active ? 'Overlay enabled' : 'Overlay disabled');
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