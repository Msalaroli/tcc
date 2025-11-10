// dev-overlay.js (NÃO coloque <script> neste arquivo)

(function () {
  AFRAME.registerComponent('dev-overlay', {
    schema: {
      width:  { default: 1.0 },
      height: { default: 0.5625 },
      z:      { default: -0.9 },
      y:      { default: 1.6 }
    },

    init: function () {
      var scene = this.el.sceneEl;

      // Garante que exista um <a-assets> para anexar os <video>
      var assets = scene.querySelector('a-assets');
      if (!assets) {
        assets = document.createElement('a-assets');
        scene.appendChild(assets);
      }

      // --- cria / obtém os vídeos ---
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

      // --- plano do stream (tela principal — já no tamanho 1 x 0.5625) ---
      var remotePlane = document.createElement('a-video');
      remotePlane.setAttribute('src', '#remoteVideo');
      remotePlane.setAttribute('width',  this.data.width);
      remotePlane.setAttribute('height', this.data.height);
      remotePlane.setAttribute('position', '0 ' + this.data.y + ' ' + this.data.z);
      remotePlane.setAttribute('material', 'shader: flat; side: double');
      scene.appendChild(remotePlane);
      this.remotePlane = remotePlane;

      // --- plano do chão (fallback) ---
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

      // --- fallback com getUserMedia (desktop). No Quest, o browser não expõe a câmera do headset. ---
      var enableFallback = function () {
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

      // liga o fallback no início
      enableFallback();

      // entra em VR/AR → esconde o chão; sai → reativa fallback
      scene.addEventListener('enter-vr', function () {
        passPlane.setAttribute('visible', 'false');
        console.log('[xr] session start → escondendo fallback');
      });
      scene.addEventListener('exit-vr', function () {
        console.log('[xr] session end → reativando fallback');
        enableFallback();
      });

      // garante autoplay do stream remoto quando o receiver anexar a mídia
      remoteVideo.addEventListener('loadedmetadata', function () { remoteVideo.play(); });
    }
  });
})();
