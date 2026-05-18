import sceneHtml from './project-scene.html?raw';

function getRoot() {
  return document.getElementById('project-root');
}

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

function isOverlayActive() {
  const devOverlay = getDevOverlayComponent();

  if (typeof devOverlay?.active === 'boolean') {
    return devOverlay.active;
  }

  if (typeof devOverlay?.isActive === 'boolean') {
    return devOverlay.isActive;
  }

  if (localStorage.getItem('dev-overlay.active') === 'true') {
    return true;
  }

  const scene = getScene();

  if (scene?.is?.('dev-overlay-active')) {
    return true;
  }

  return false;
}

function applyOverlayVisibilityState() {
  const overlayIsActive = isOverlayActive();
  const markedElements = document.querySelectorAll(
    '.dev-overlay-hide-when-active'
  );

  markedElements.forEach((el) => {
    el.setAttribute('visible', overlayIsActive ? 'false' : 'true');

    if (el.object3D) {
      el.object3D.visible = !overlayIsActive;
    }
  });

  console.log(
    overlayIsActive
      ? '[project-loader] overlay is active, hiding marked scene elements'
      : '[project-loader] overlay is inactive, showing marked scene elements'
  );
}

function refreshOverlayVisibilityAfterMount() {
  applyOverlayVisibilityState();

  requestAnimationFrame(() => {
    applyOverlayVisibilityState();
  });

  setTimeout(() => {
    applyOverlayVisibilityState();
  }, 100);

  setTimeout(() => {
    applyOverlayVisibilityState();
  }, 300);
}

function unmountScene() {
  const root = getRoot();

  if (!root) {
    console.warn('[project-loader] #project-root not found');
    return;
  }

  root.innerHTML = '';
}

function mountScene(html = sceneHtml, reason = 'initial') {
  const root = getRoot();
  const scene = getScene();

  if (!root) {
    console.warn('[project-loader] #project-root not found');
    return;
  }

  unmountScene();

  root.innerHTML = html;

  refreshOverlayVisibilityAfterMount();

  if (reason === 'initial') {
    console.log('[project-loader] initial scene mounted');
  } else {
    console.log('[project-loader] project scene remounted', reason);
  }

  if (scene) {
    scene.emit('project-scene-remounted', {
      reason
    });

    scene.emit('dev-overlay-reconnect', {
      reason
    });
  }
}

function mountWhenReady() {
  const scene = getScene();
  const root = getRoot();

  if (!scene || !root) {
    requestAnimationFrame(mountWhenReady);
    return;
  }

  if (!scene.hasLoaded) {
    scene.addEventListener(
      'loaded',
      () => {
        mountScene(sceneHtml, 'initial');
      },
      { once: true }
    );

    return;
  }

  mountScene(sceneHtml, 'initial');
}

mountWhenReady();

if (import.meta.hot) {
  import.meta.hot.accept('./project-scene.html?raw', (nextModule) => {
    console.log('[project-loader] project scene HMR update received');

    const nextHtml = nextModule.default;

    mountScene(nextHtml, 'project-scene-hmr');
  });
}