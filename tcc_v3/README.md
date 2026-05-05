# TCC v3 · Dev Overlay for WebXR

Dev Overlay is a reusable A-Frame component that streams your computer screen into a WebXR scene in real time.

The project was created to improve the development workflow for immersive applications. Instead of removing the headset every time the developer needs to check code, logs, documentation, or the browser, the computer screen can be displayed directly inside the XR scene.

This version uses:

- A-Frame for the WebXR scene
- WebRTC for screen streaming
- Vite Dev Server for local development
- A custom WebSocket signaling channel inside Vite
- A reusable `dev-overlay` A-Frame component
- A static `stream.html` page outside Vite HMR to keep the screen capture alive during hot reloads

---

## Objective

The main goal of this project is to reduce the development iteration cycle in XR applications.

In a common XR workflow, developers often need to remove the headset to:

- edit code
- inspect logs
- read documentation
- check the browser
- debug layout or interaction issues

This project allows the developer to keep the headset on while viewing their computer screen inside the immersive scene.

The component also allows the scene to adapt automatically when the overlay is enabled. Elements marked by the developer can be hidden when the screen overlay is active, making room for physical references such as a keyboard, desk, or lower field of view.

---

## Main Features

- Screen streaming from the computer to the WebXR scene
- WebRTC based video transmission
- Vite based local development server
- Custom WebSocket signaling endpoint
- A-Frame component integration
- Toggle button inside the XR scene
- Optional HUD style button that follows the user's view
- Automatic hiding and restoring of selected scene elements
- Reconnection after WebXR scene reloads
- `stream.html` kept outside Vite HMR to avoid losing screen capture during hot reload

---

## Technologies

- A-Frame
- WebXR
- WebRTC
- Vite
- WebSocket
- JavaScript
- HTML

---

## Project Structure

```txt
tcc_v3/
├── package.json
├── vite.config.js
├── README.md
├── demo-scene.html
├── src/
│   └── dev-overlay.js
└── public/
    └── stream.html
```

### File responsibilities

```txt
demo-scene.html
```

Main XR demo scene. This is the page opened in the headset.

```txt
public/stream.html
```

Static page opened on the computer. It captures the desktop screen and sends it to the XR scene.

This file is placed inside `public/` so it is served by Vite as a static file and does not participate in Vite HMR. This avoids losing the screen capture when the XR scene reloads.

```txt
src/dev-overlay.js
```

Reusable A-Frame component responsible for:

- creating the virtual screen inside the scene
- connecting to the signaling WebSocket
- receiving the WebRTC stream
- toggling the overlay
- hiding and restoring selected scene elements
- managing reconnection

```txt
vite.config.js
```

Vite configuration file. It enables HTTPS and creates the custom WebSocket endpoint used for WebRTC signaling.

---

## Installation

Install the project dependencies:

```bash
npm install
```

If the project uses the custom WebSocket signaling server inside Vite, install `ws` as a development dependency:

```bash
npm install -D ws
```

---

## Running the project

Start the Vite development server:

```bash
npm run dev
```

Vite will show URLs similar to:

```txt
Local:   https://localhost:5173/
Network: https://192.168.0.10:5173/
```

Use the `Network` URL when opening the scene from the headset.

---

## Testing the demo

### 1. Open the stream page on the computer

On the computer, open:

```txt
https://localhost:5173/stream.html
```

Click:

```txt
Share screen
```

Then allow the browser to capture your screen.

### 2. Open the XR scene on the headset

On the Meta Quest or another WebXR compatible headset, open:

```txt
https://YOUR_LOCAL_IP:5173/demo-scene.html
```

Example:

```txt
https://192.168.0.10:5173/demo-scene.html
```

### 3. Enter WebXR mode

Enter the immersive session.

### 4. Activate the overlay

Click the overlay button inside the scene.

When the overlay is enabled:

- the streamed computer screen appears inside the scene
- elements marked with `dev-overlay-hide-when-active` are hidden

When the overlay is disabled:

- the streamed screen is hidden
- the marked scene elements are restored

---

## Complete integration into another project

To use Dev Overlay with screen streaming in another A-Frame project, you need to integrate three parts:

1. The overlay component inside the XR scene
2. The stream page used on the computer
3. The Vite WebSocket signaling configuration

---

### 1. Copy the required files

Copy these files into your project:

```txt
src/dev-overlay.js
public/stream.html
vite.config.js
```

Example structure:

```txt
my-project/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   └── dev-overlay.js
└── public/
    └── stream.html
```

---

### 2. Configure Vite

The project depends on Vite because Vite serves the application and hosts the custom WebSocket signaling endpoint.

A simplified version of the required Vite plugin is:

```js
import basicSsl from '@vitejs/plugin-basic-ssl';
import { WebSocketServer } from 'ws';

function devOverlaySignaling() {
  return {
    name: 'dev-overlay-signaling',

    configureServer(server) {
      if (!server.httpServer) {
        return;
      }

      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url, 'https://localhost');

        if (url.pathname !== '/dev-overlay-ws') {
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      });

      wss.on('connection', (ws) => {
        console.log('[vite] dev-overlay client connected');

        ws.on('message', (raw) => {
          let message;

          try {
            message = JSON.parse(raw.toString());
          } catch {
            return;
          }

          console.log('[vite] signal:', message.type, message.source);

          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === client.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
        });

        ws.on('close', () => {
          console.log('[vite] dev-overlay client disconnected');
        });
      });
    }
  };
}

export default {
  plugins: [
    basicSsl(),
    devOverlaySignaling()
  ],

  server: {
    host: true,
    https: true
  }
};
```

This configuration creates the WebSocket endpoint:

```txt
/dev-overlay-ws
```

This endpoint is used by both:

- `stream.html`
- `dev-overlay.js`

---

### 3. Import A-Frame and the component

In your main scene HTML file:

```html
<script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
<script type="module" src="/src/dev-overlay.js"></script>
```

---

### 4. Enable the component in the scene

Add the `dev-overlay` component to your `<a-scene>`:

```html
<a-scene dev-overlay>
</a-scene>
```

You can also configure the size and position of the streamed screen:

```html
<a-scene dev-overlay="width: 1.35; height: 0.76; position: 0 1.45 -1.25">
</a-scene>
```

---

### 5. Add a toggle button

The overlay can be activated using any entity with the `dev-overlay-trigger` component.

Basic example:

```html
<a-entity
  class="clickable"
  dev-overlay-trigger
  geometry="primitive: box; width: 0.06; height: 0.06; depth: 0.04"
  material="color: #24CAFF">
</a-entity>
```

Make sure your scene raycaster targets `.clickable` objects:

```html
<a-scene
  raycaster="objects: .clickable"
  cursor="rayOrigin: mouse">
</a-scene>
```

For controller interaction, you can also use:

```html
<a-entity
  laser-controls="hand: right"
  raycaster="objects: .clickable"
  cursor="rayOrigin: entity; fuse: false">
</a-entity>
```

---

## HUD style button

A recommended approach is to make the overlay button follow the user's view.

This can be done with the `follow-camera` component.

Example:

```html
<a-entity follow-camera>
  <a-box
    class="clickable"
    dev-overlay-trigger
    width="0.06"
    height="0.06"
    depth="0.08"
    material="opacity: 0; transparent: true">
  </a-box>

  <a-box
    width="0.06"
    height="0.06"
    depth="0.045"
    color="#24CAFF"
    material="
      roughness: 0.25;
      metalness: 0.1;
      emissive: #0A6B80;
      emissiveIntensity: 0.25
    ">
  </a-box>

  <a-box
    width="0.062"
    height="0.062"
    depth="0.047"
    color="#001018"
    material="wireframe: true">
  </a-box>
</a-entity>
```

This keeps the button visible during the XR session.

This approach is useful for development tools because the control remains accessible while the user moves inside the immersive environment.

---

## Hiding scene elements when the overlay is active

The component can automatically hide parts of the scene when the overlay is enabled.

To do this, add this class to any entity:

```txt
dev-overlay-hide-when-active
```

Example:

```html
<a-plane
  class="dev-overlay-hide-when-active"
  rotation="-90 0 0"
  width="5"
  height="5"
  color="#1F2937">
</a-plane>
```

When the overlay is enabled, this element will be hidden.

When the overlay is disabled, it will become visible again.

This feature is useful for creating a productivity mode, where the lower part of the virtual scene is cleared so the developer can better interact with real physical elements such as a keyboard or desk when using AR passthrough.

---

## AR passthrough behavior on Meta Quest

When using Meta Quest in WebXR AR mode, the real environment can be visible if the scene does not block it with virtual geometry.

To allow the real environment to remain visible:

- avoid using `<a-sky>`
- use transparent rendering
- hide lower scene elements when the overlay is active

Recommended scene configuration:

```html
<a-scene
  xr-mode="ar"
  renderer="colorManagement: true; alpha: true"
  background="transparent: true">
</a-scene>
```

Avoid this in AR passthrough mode:

```html
<a-sky color="#0F172A"></a-sky>
```

An `<a-sky>` creates a full virtual background and will block the real environment.

---

## Component configuration

The `dev-overlay` component accepts the following parameters:

```html
<a-scene dev-overlay="width: 1.35; height: 0.76; position: 0 1.45 -1.25">
</a-scene>
```

| Parameter | Description |
|---|---|
| `width` | Width of the streamed screen |
| `height` | Height of the streamed screen |
| `position` | Position of the streamed screen in the scene |

Example positions:

```html
<!-- Higher -->
<a-scene dev-overlay="position: 0 1.7 -1.25"></a-scene>

<!-- Lower -->
<a-scene dev-overlay="position: 0 1.2 -1.25"></a-scene>

<!-- Closer -->
<a-scene dev-overlay="position: 0 1.45 -0.8"></a-scene>

<!-- Farther -->
<a-scene dev-overlay="position: 0 1.45 -1.8"></a-scene>

<!-- To the right -->
<a-scene dev-overlay="position: 0.4 1.45 -1.25"></a-scene>
```

---

## Events

The component emits events when the overlay changes state.

Overlay enabled:

```js
scene.addEventListener('dev-overlay-enabled', () => {
  console.log('Overlay enabled');
});
```

Overlay disabled:

```js
scene.addEventListener('dev-overlay-disabled', () => {
  console.log('Overlay disabled');
});
```

These events can be used by the developer to add custom behavior when the overlay is activated or deactivated.

---

## Architecture

The system is divided into three main parts.

### 1. XR scene

The XR scene is loaded in the headset.

It contains:

- the A-Frame scene
- the `dev-overlay` component
- the virtual screen
- the toggle button
- optional elements that are hidden when the overlay is active

### 2. Stream page

The stream page is opened on the computer.

It is responsible for:

- requesting screen capture with `getDisplayMedia`
- creating a WebRTC connection
- sending the screen stream to the XR scene
- reconnecting when the XR scene reloads

The stream page is placed inside `public/stream.html` so it is not affected by Vite HMR.

This is important because if the stream page reloads, the browser stops the screen capture and the user must manually approve it again.

### 3. Vite signaling server

Vite is used as the development server.

A custom WebSocket endpoint is added to the Vite server:

```txt
/dev-overlay-ws
```

This endpoint forwards WebRTC signaling messages between the stream page and the XR scene.

The signaling messages are:

```txt
rtc:connect
rtc:offer
rtc:answer
rtc:ice
```

---

## Communication flow

```txt
1. demo-scene.html opens in the headset
2. dev-overlay connects to /dev-overlay-ws
3. public/stream.html opens on the computer
4. stream.html connects to /dev-overlay-ws
5. user clicks "Share screen"
6. stream.html captures the desktop with getDisplayMedia
7. stream.html sends rtc:offer
8. dev-overlay receives the offer
9. dev-overlay sends rtc:answer
10. both sides exchange rtc:ice candidates
11. WebRTC connection is established
12. the computer screen is rendered inside the XR scene
```

---

## Hot reload and reconnection

Earlier versions used Vite HMR directly for signaling.

That approach worked initially, but created a problem:

```txt
HTML file changes
→ Vite sends full reload to all HMR clients
→ stream.html reloads
→ browser stops getDisplayMedia
→ user must click Share screen again
```

The current version fixes this by moving `stream.html` into the `public/` directory and using a custom WebSocket endpoint instead of the Vite HMR client.

Now the behavior is:

```txt
developer changes the XR scene
→ Vite reloads the scene
→ stream.html does not reload
→ screen capture remains active
→ dev-overlay reconnects automatically
→ stream returns without clicking Share screen again
```

This preserves the purpose of the project: reducing the need to remove the headset during development.

---

## Why `stream.html` is inside `public/`

`public/stream.html` is served as a static asset by Vite.

This means it does not include the Vite HMR client and is not automatically reloaded when the developer changes the XR scene.

This is necessary because browser screen capture cannot survive a page reload.

If `stream.html` reloads, `getDisplayMedia` is stopped by the browser for security reasons.

---

## Limitations

- The first screen capture still requires a user gesture.
- If `stream.html` itself is reloaded, the user must click "Share screen" again.
- If the Vite server restarts, the WebSocket reconnects, but the WebRTC session may need to be recreated.
- Browser support depends on WebXR and WebRTC availability.
- Passthrough visibility depends on the headset browser and AR mode support.
- The project does not access headset camera frames directly.
- The component does not record the real environment.

---

## Why Vite is used

Vite is used because it provides:

- a fast development server
- HTTPS support through `@vitejs/plugin-basic-ssl`
- easy local network access with `--host`
- modern frontend workflow
- simple integration with custom plugins
- a convenient place to host the WebSocket signaling endpoint

This removes the need for a separate HTTPS Express server or manually generated certificates.

---

## Evolution of the project

### v1

The first version used:

- a custom HTTPS server
- Express
- WebSocket
- manually generated certificates

Problems:

- required manual certificate setup
- increased configuration complexity
- mixed app serving, signaling, and development logic
- made the project harder to reuse

### v2

The second version explored:

- PeerJS
- a more component based structure
- easier WebRTC abstraction

Problems:

- added external dependency
- reduced control over the signaling layer
- moved away from the original architecture being studied

### v3

The third version uses:

- Vite Dev Server
- WebRTC
- a custom WebSocket signaling endpoint
- a reusable A-Frame component
- a static stream page outside HMR
- automatic scene adaptation

Improvements:

- simpler architecture
- no manual certificates
- reusable component
- clearer demo
- better reconnection behavior
- better support for real development workflow

---

## Quick start

```bash
npm install
npm run dev
```

Then open:

```txt
Computer:
https://localhost:5173/stream.html

Headset:
https://YOUR_LOCAL_IP:5173/demo-scene.html
```

Click "Share screen" on the computer, then activate the overlay inside the WebXR scene.

---

## Summary

Dev Overlay for WebXR is a development tool that brings the computer screen into an immersive A-Frame scene.

It helps developers stay inside the headset while editing, debugging, and testing XR experiences.

The current version focuses on:

- reusable integration
- WebRTC screen streaming
- Vite based development
- stable screen capture during hot reload
- automatic scene adaptation
- practical use in Meta Quest AR or VR development