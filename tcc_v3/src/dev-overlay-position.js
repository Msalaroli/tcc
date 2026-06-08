export const overlayPosition = {
  x: 0,
  y: 1.30,
  z: -1.25
};

export const overlaySize = {
  width: 1.35,
  height: 0.76
};

function getScene() {
  return document.querySelector('a-scene');
}

function getDevOverlayComponent() {
  const scene = getScene();

  if (!scene || !scene.components) {
    return null;
  }

  return scene.components['dev-overlay'] || null;
}

function waitForDevOverlay(callback) {
  const devOverlay = getDevOverlayComponent();

  if (devOverlay) {
    callback(devOverlay);
    return;
  }

  requestAnimationFrame(() => {
    waitForDevOverlay(callback);
  });
}

export function applyOverlayConfig() {
  waitForDevOverlay((devOverlay) => {
    devOverlay.setOverlayConfig({
      position: overlayPosition,
      size: overlaySize
    });

    console.log('[dev-overlay-position] overlay config applied', {
      position: overlayPosition,
      size: overlaySize
    });
  });
}

applyOverlayConfig();

if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    newModule.applyOverlayConfig();
  });
}
