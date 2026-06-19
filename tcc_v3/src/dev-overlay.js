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
    },

    draggable: {
      type: 'boolean',
      default: false
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
    this.draggableController = null;
    this.pointerController = null;
    this.isDraggingScreen = false;
    this.isPointerOverScreen = false;
    this.hasLoggedScreenDragUpdate = false;
    this.dragStartControllerPosition = new THREE.Vector3();
    this.dragStartOverlayPosition = new THREE.Vector3();
    this.dragCurrentOverlayPosition = new THREE.Vector3();
    this.dragListenersReady = false;
    this.dragControllerListenerIds = new Set();

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

  update: function () {
    this.applyScreenLayout();
    this.applyDraggableState();
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
    screen.setAttribute('material', 'shader: flat; side: double');
    screen.setAttribute('visible', false);

    this.el.sceneEl.appendChild(screen);
    this.screen = screen;

    this.applyScreenLayout();
    this.applyDraggableState();
  },

  applyScreenLayout: function () {
    if (!this.screen) {
      return;
    }

    this.screen.setAttribute('width', this.data.width);
    this.screen.setAttribute('height', this.data.height);
    this.screen.setAttribute(
      'position',
      `${this.data.position.x} ${this.data.position.y} ${this.data.position.z}`
    );
  },

  setOverlayConfig: function (config) {
    const position = config.position || this.data.position;
    const size = config.size || {
      width: this.data.width,
      height: this.data.height
    };

    this.el.setAttribute('dev-overlay', {
      width: size.width,
      height: size.height,
      position,
      draggable: this.data.draggable
    });
  },

  applyDraggableState: function () {
    if (!this.screen) {
      return;
    }

    if (this.data.draggable) {
      this.screen.classList.add('clickable');
      this.setupScreenDrag();
      return;
    }

    this.screen.classList.remove('clickable');
    this.stopScreenDrag();
  },

  setupScreenDrag: function () {
    if (!this.screen || this.dragListenersReady) {
      return;
    }

    this.screen.addEventListener('raycaster-intersected', (event) => {
      if (!this.data.draggable) {
        return;
      }

      this.isPointerOverScreen = true;
      this.pointerController = event.detail.el || null;
    });

    this.screen.addEventListener('raycaster-intersected-cleared', (event) => {
      if (this.pointerController && event.detail.el !== this.pointerController) {
        return;
      }

      this.isPointerOverScreen = false;
      this.pointerController = null;
    });

    this.setupControllerDragEvents();
    this.dragListenersReady = true;

    if (this.data.draggable) {
      this.sendDevLog('log', 'Draggable overlay enabled');
    }
  },

  setupControllerDragEvents: function () {
    const controllerIds = ['rightHand', 'leftHand'];
    let missingController = false;

    controllerIds.forEach((controllerId) => {
      if (this.dragControllerListenerIds.has(controllerId)) {
        return;
      }

      const controller = document.getElementById(controllerId);

      if (!controller) {
        missingController = true;
        return;
      }

      controller.addEventListener('triggerdown', () => {
        this.startScreenDrag(controller);
      });

      controller.addEventListener('triggerup', () => {
        this.endScreenDrag(controller);
      });

      this.dragControllerListenerIds.add(controllerId);
    });

    if (missingController && this.data.draggable) {
      requestAnimationFrame(() => {
        this.setupControllerDragEvents();
      });
    }
  },

  startScreenDrag: function (controller) {
    if (
      !this.data.draggable ||
      !this.screen ||
      !this.active ||
      !this.isPointerOverScreen ||
      (this.pointerController && this.pointerController !== controller)
    ) {
      return;
    }

    controller.object3D.getWorldPosition(this.dragStartControllerPosition);
    this.dragStartOverlayPosition.set(
      this.data.position.x,
      this.data.position.y,
      this.data.position.z
    );
    this.dragCurrentOverlayPosition.copy(this.dragStartOverlayPosition);

    this.draggableController = controller;
    this.isDraggingScreen = true;
    this.hasLoggedScreenDragUpdate = false;

    this.sendDevLog('log', 'Screen drag started');
  },

  stopScreenDrag: function () {
    this.draggableController = null;
    this.isDraggingScreen = false;
  },

  endScreenDrag: function (controller) {
    if (!this.isDraggingScreen || this.draggableController !== controller) {
      return;
    }

    const position = {
      x: this.dragCurrentOverlayPosition.x,
      y: this.dragCurrentOverlayPosition.y,
      z: this.dragCurrentOverlayPosition.z
    };

    this.stopScreenDrag();
    this.setOverlayConfig({
      position,
      size: {
        width: this.data.width,
        height: this.data.height
      }
    });

    this.sendDevLog('log', 'Screen drag ended', {
      position
    });
  },

  tick: function () {
    if (!this.isDraggingScreen || !this.draggableController || !this.screen) {
      return;
    }

    const controllerPosition = new THREE.Vector3();
    controllerPosition.copy(this.dragStartControllerPosition);
    this.draggableController.object3D.getWorldPosition(controllerPosition);

    const delta = controllerPosition.sub(this.dragStartControllerPosition);
    this.dragCurrentOverlayPosition.copy(this.dragStartOverlayPosition).add(delta);

    this.screen.setAttribute(
      'position',
      `${this.dragCurrentOverlayPosition.x} ${this.dragCurrentOverlayPosition.y} ${this.dragCurrentOverlayPosition.z}`
    );

    if (!this.hasLoggedScreenDragUpdate) {
      this.hasLoggedScreenDragUpdate = true;

      this.sendDevLog('log', 'Screen drag updated', {
        position: {
          x: this.dragCurrentOverlayPosition.x,
          y: this.dragCurrentOverlayPosition.y,
          z: this.dragCurrentOverlayPosition.z
        }
      });
    }
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

    if (!active) {
      this.stopScreenDrag();
    }

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
