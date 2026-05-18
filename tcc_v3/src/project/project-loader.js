import sceneHtml from './project-scene.html?raw';

function getRoot() {
  return document.getElementById('project-root');
}

function getScene() {
  return document.querySelector('a-scene');
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

  if (reason === 'initial') {
    console.log('[project-loader] initial scene mounted');
  } else {
    console.log('[project-loader] project scene remounted');
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
