# Dev Overlay for WebXR

Dev Overlay is a WebXR development tool built with A-Frame, Vite, WebRTC and WebSocket signaling.

The project allows a developer to stream the computer screen into a WebXR AR scene while keeping the Meta Quest headset on. It also provides a stable AR shell that can reload only the editable project scene without reloading the page that owns the WebXR session.

This helps reduce the development loop for XR applications, especially when testing inside Meta Quest AR.

---

## Main idea

The project is divided into three main parts:

```txt
dev-shell.html
→ stable AR shell
→ owns the WebXR AR session
→ owns the dev overlay
→ owns the stream screen
→ owns the project-root container

src/project/project-scene.html
→ editable A-Frame scene
→ loaded inside project-root
→ can be changed during development

src/dev-overlay-position.js
→ editable overlay screen position and size
→ can be changed during development
→ updates the overlay without reloading dev-shell.html
```

The developer edits the project scene here:

```txt
src/project/project-scene.html
```

The developer edits the overlay screen position here:

```txt
src/dev-overlay-position.js
```

The shell stays alive:

```txt
dev-shell.html
```

This means the editable scene and overlay position can be updated without fully reloading the page that owns the AR session.

---

## What the project does

- Streams the computer screen into a WebXR scene
- Uses WebRTC for screen sharing
- Uses a custom WebSocket endpoint for signaling
- Keeps `stream.html` outside the Vite HMR pipeline
- Provides a stable AR shell for Meta Quest
- Loads the editable A-Frame scene from an external HTML file
- Reloads only the project scene during development
- Allows the overlay screen position and size to be adjusted through code
- Allows selected scene elements to disappear when the overlay is active
- Keeps other elements visible to preserve instructions or debugging context

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

## Project structure

```txt
tcc/
├── package.json
├── vite.config.js
├── README.md
├── dev-shell.html
├── public/
│   └── stream.html
└── src/
    ├── dev-overlay.js
    ├── dev-overlay-position.js
    └── project/
        ├── project-loader.js
        └── project-scene.html
```

---

## File responsibilities

### `dev-shell.html`

This is the main page used in the Meta Quest.

It is the stable AR shell.

It contains:

- `<a-scene>`
- WebXR AR configuration
- `dev-overlay`
- overlay toggle button
- hand controls
- lights
- `<a-entity id="project-root"></a-entity>`
- import for `dev-overlay.js`
- import for `dev-overlay-position.js`
- import for `project-loader.js`

This file should not contain the editable project scene.

The editable scene is loaded into:

```html
<a-entity id="project-root"></a-entity>
```

The overlay position can be configured through:

```txt
src/dev-overlay-position.js
```

Avoid editing `dev-shell.html` during an active AR session. It is the page that owns the WebXR session, so changing it may cause a full page reload.

---

### `src/dev-overlay.js`

This is the reusable A-Frame component.

It is responsible for:

- creating the virtual screen
- receiving the WebRTC stream
- rendering the computer screen inside the XR scene
- toggling the overlay on and off
- hiding elements marked with `dev-overlay-hide-when-active`
- updating the overlay screen layout when position or size changes
- keeping debugging context visible when needed
- logging XR/WebRTC state for development

The component supports dynamic layout updates through the component data:

```txt
width
height
position
```

This allows `src/dev-overlay-position.js` to update the overlay screen without reloading the shell.

---

### `src/dev-overlay-position.js`

This file controls the overlay screen position and size.

It is designed to be edited during development without reloading `dev-shell.html`.

Example:

```js
export const overlayPosition = {
  x: 0,
  y: 1.3,
  z: -1.25
};

export const overlaySize = {
  width: 1.35,
  height: 0.76
};
```

Changing this file allows the developer to move or resize the overlay screen while staying inside AR.

For example:

```js
export const overlayPosition = {
  x: 0.2,
  y: 1.45,
  z: -1.4
};

export const overlaySize = {
  width: 1.5,
  height: 0.84
};
```

After saving the file, Vite HMR updates only this module and reapplies the overlay configuration.

The shell does not need to reload.

---

### `src/project/project-scene.html`

This is the editable A-Frame scene.

This is where the developer creates or changes the project content.

It should contain only internal A-Frame entities, such as:

```html
<a-box></a-box>
<a-plane></a-plane>
<a-text></a-text>
<a-entity></a-entity>
```

It must not contain:

```html
<html>
<head>
<body>
<a-scene>
```

The stable shell already owns the `<a-scene>`.

---

### `src/project/project-loader.js`

This file loads the editable scene into the shell.

It imports the scene as raw HTML:

```js
import sceneHtml from './project-scene.html?raw';
```

Then it injects that HTML into:

```html
<a-entity id="project-root"></a-entity>
```

It also supports live scene reload during development.

When `project-scene.html` changes, the loader remounts the scene content without reloading the full page.

It also reapplies the overlay visibility state after remounting, so elements marked with `dev-overlay-hide-when-active` remain hidden if the overlay is already active.

---

### `public/stream.html`

This page is opened on the computer.

It asks the user to share the computer screen and sends the stream to the WebXR scene.

It stays inside `public/` so it is served as a static page and does not get reloaded by Vite HMR.

This is important because if `stream.html` reloads, the browser stops `getDisplayMedia`, and the user must click **Share screen** again.

---

### `vite.config.js`

This file configures the Vite development server.

It provides:

- HTTPS support for local WebXR testing
- host access for testing on Meta Quest
- a custom WebSocket endpoint used by the overlay and stream page

The WebSocket endpoint is used for WebRTC signaling:

```txt
/dev-overlay-ws
```

---

## How to run

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev -- --host
```

Vite will show URLs similar to:

```txt
Local:   https://localhost:5173/
Network: https://192.168.1.51:5173/
```

Use the `Network` URL on the Meta Quest.

---

## How to test on the computer

Open the stream page on the computer:

```txt
https://localhost:5173/stream.html
```

Click:

```txt
Share screen
```

Choose the screen, window or tab you want to share.

---

## How to test on Meta Quest

Open the stable AR shell in the Meta Quest browser:

```txt
https://YOUR_LOCAL_IP:5173/dev-shell.html
```

Example:

```txt
https://192.168.1.51:5173/dev-shell.html
```

Then:

1. Enter AR mode
2. Press the small blue overlay button
3. The streamed computer screen should appear inside the scene
4. Elements marked with `dev-overlay-hide-when-active` should disappear
5. Elements without that class should remain visible

---

## Recommended testing flow

```txt
1. Start the Vite dev server
2. Open /stream.html on the computer
3. Click Share screen
4. Open /dev-shell.html on the Quest
5. Enter AR mode
6. Press the blue overlay button
7. Edit src/project/project-scene.html
8. Save the file
9. The scene should update without leaving AR
10. Edit src/dev-overlay-position.js
11. Save the file
12. The overlay screen should move or resize without leaving AR
```

---

## Editing the project scene

The developer should edit:

```txt
src/project/project-scene.html
```

Example:

```html
<a-box
  position="0 1 -2"
  width="0.5"
  height="0.5"
  depth="0.5"
  color="#38BDF8">
</a-box>
```

Changing the color:

```html
color="#F97316"
```

After saving the file, the scene content is remounted inside the shell.

The full page does not need to reload.

---

## Editing the overlay screen position

The overlay screen position and size should be edited in:

```txt
src/dev-overlay-position.js
```

Example:

```js
export const overlayPosition = {
  x: 0,
  y: 1.3,
  z: -1.25
};

export const overlaySize = {
  width: 1.35,
  height: 0.76
};
```

The meaning of the position values:

```txt
x → horizontal position
y → vertical position
z → depth
```

In A-Frame, more negative `z` values move the overlay farther forward in front of the user.

Example:

```js
export const overlayPosition = {
  x: 0.15,
  y: 1.45,
  z: -1.45
};
```

This moves the overlay:

```txt
slightly to the right
slightly higher
farther forward
```

To make the overlay larger:

```js
export const overlaySize = {
  width: 1.5,
  height: 0.84
};
```

After saving `src/dev-overlay-position.js`, the overlay layout is reapplied through HMR without reloading `dev-shell.html`.

---

## What can be edited during AR

Safe to edit during an active AR session:

```txt
src/project/project-scene.html
src/dev-overlay-position.js
```

Avoid editing during an active AR session:

```txt
dev-shell.html
src/dev-overlay.js
src/project/project-loader.js
public/stream.html
vite.config.js
```

Reason:

```txt
dev-shell.html owns the WebXR AR session.
project-scene.html and dev-overlay-position.js are designed to update without full page reload.
```

---

## Project scene rules

The editable scene must be written inside:

```txt
src/project/project-scene.html
```

Do not include:

```html
<html>
<head>
<body>
<a-scene>
```

Only include A-Frame entities:

```html
<a-box></a-box>
<a-plane></a-plane>
<a-text></a-text>
<a-entity></a-entity>
<a-sphere></a-sphere>
<a-cylinder></a-cylinder>
<a-cone></a-cone>
```

The stable shell owns:

```html
<a-scene>
```

The editable scene is mounted inside:

```html
<a-entity id="project-root"></a-entity>
```

Do not rename or remove:

```html
id="project-root"
```

Do not remove this import from `dev-shell.html`:

```html
<script type="module" src="/src/dev-overlay.js"></script>
```

Do not remove this import from `dev-shell.html`:

```html
<script type="module" src="/src/dev-overlay-position.js"></script>
```

Do not remove this import from `dev-shell.html`:

```html
<script type="module" src="/src/project/project-loader.js"></script>
```

---

## Selective hiding

The overlay can hide only selected elements.

To make an element disappear when the overlay is active, add:

```html
class="dev-overlay-hide-when-active"
```

Example:

```html
<a-plane
  class="dev-overlay-hide-when-active"
  rotation="-90 0 0"
  width="4"
  height="4"
  color="#111827">
</a-plane>
```

When the overlay is active:

```txt
elements with dev-overlay-hide-when-active → hidden
elements without dev-overlay-hide-when-active → remain visible
```

This allows the developer to clear the lower work area while keeping titles, instructions and debugging panels visible.

---

## Example project scene

Example content for:

```txt
src/project/project-scene.html
```

```html
<a-plane
  class="dev-overlay-hide-when-active"
  rotation="-90 0 0"
  width="5"
  height="5"
  color="#111827"
  opacity="0.9"
  position="0 0 -1.5">
</a-plane>

<a-text
  value="Live WebXR scene"
  align="center"
  color="#FFFFFF"
  position="0 2 -2.5"
  width="4">
</a-text>

<a-box
  position="0 0.7 -1.6"
  width="0.5"
  height="0.5"
  depth="0.5"
  color="#38BDF8">
</a-box>

<a-text
  value="This text stays visible when the overlay is active"
  align="center"
  color="#E5E7EB"
  position="0 1.4 -2.4"
  width="3">
</a-text>
```

---

## How the live scene reload works

The shell loads the project scene using:

```js
import sceneHtml from './project-scene.html?raw';
```

The HTML is inserted into:

```html
<a-entity id="project-root"></a-entity>
```

When the project scene changes, the loader replaces the content inside `project-root`.

The shell itself remains alive.

This preserves:

- the WebXR AR session
- the dev overlay
- the WebRTC signaling connection
- the overlay button
- the stream page connection

---

## How the overlay position update works

The shell imports:

```html
<script type="module" src="/src/dev-overlay-position.js"></script>
```

That file exports:

```js
export const overlayPosition = {
  x: 0,
  y: 1.3,
  z: -1.25
};

export const overlaySize = {
  width: 1.35,
  height: 0.76
};
```

When the file is saved, it reapplies the overlay configuration to the active `dev-overlay` component.

The overlay screen position and size update without reloading the shell.

This preserves:

- the WebXR AR session
- the WebRTC stream
- the current project scene
- the overlay state

---

## Why the shell exists

Full page reloads can terminate or corrupt WebXR AR sessions on standalone headsets.

The shell avoids that by keeping the page that owns the AR session stable.

Instead of reloading:

```txt
entire page
```

the system reloads only:

```txt
editable project scene
overlay position configuration
```

This is why the architecture uses:

```txt
dev-shell.html
→ stable page

project-scene.html
→ editable scene content

dev-overlay-position.js
→ editable overlay layout config
```

---

## Stream page behavior

The stream page is located at:

```txt
public/stream.html
```

It is opened on the computer.

It captures the desktop using:

```js
navigator.mediaDevices.getDisplayMedia()
```

The stream page should not be moved back into the normal HMR flow.

If the stream page reloads, browser security stops the screen capture.

That is why the stream page is served as a static file.

---

## Communication flow

```txt
Computer:
public/stream.html
→ captures the screen
→ creates WebRTC offer

Vite WebSocket:
/dev-overlay-ws
→ forwards signaling messages

Quest:
dev-shell.html
→ receives WebRTC stream through dev-overlay
→ renders the screen inside WebXR
```

Signaling messages include:

```txt
rtc:connect
rtc:offer
rtc:answer
rtc:ice
```

---

## Main development workflow

```txt
Computer:
1. Open /stream.html
2. Click Share screen
3. Edit src/project/project-scene.html
4. Edit src/dev-overlay-position.js if the overlay screen needs to move

Quest:
1. Open /dev-shell.html
2. Enter AR
3. Press the overlay button
4. Watch the scene and overlay update while staying in AR
```

---

## Recommended video demo flow

For a short demo video:

```txt
1. Open stream.html on the computer
2. Click Share screen
3. Open dev-shell.html on Meta Quest
4. Enter AR mode
5. Press the overlay button
6. Show the computer screen inside AR
7. Edit src/project/project-scene.html
8. Change the color of a cube or pyramid
9. Save the file
10. Show the scene updating without leaving AR
11. Edit src/dev-overlay-position.js
12. Move the overlay screen by changing x, y or z
13. Save the file
14. Show the overlay moving without leaving AR
15. Toggle the overlay to show selected scene elements disappearing
```

Suggested caption:

```txt
Live WebXR development inside Meta Quest AR using A-Frame, Vite and WebRTC.
```

---

## What should stay visible when the overlay is active

Use no special class for elements that should stay visible.

Good examples:

```txt
title
instructions
debugging panels
context text
important labels
```

These elements should not use:

```html
class="dev-overlay-hide-when-active"
```

---

## What should disappear when the overlay is active

Use:

```html
class="dev-overlay-hide-when-active"
```

for elements such as:

```txt
floor
desk
lower work area
temporary objects
large scene geometry
objects that block keyboard visibility
```

This demonstrates selective scene control.

---

## Current main files

Use these files for the final workflow:

```txt
dev-shell.html
public/stream.html
src/dev-overlay.js
src/dev-overlay-position.js
src/project/project-loader.js
src/project/project-scene.html
vite.config.js
```

The recommended entry point for the current architecture is:

```txt
dev-shell.html
```

---

## Troubleshooting

### The scene does not update after saving

Make sure you are editing:

```txt
src/project/project-scene.html
```

Do not edit `dev-shell.html` for normal scene changes.

---

### The overlay does not move after editing its position

Make sure you are editing:

```txt
src/dev-overlay-position.js
```

Then save the file and check the browser console for:

```txt
[dev-overlay-position] overlay config applied
```

If the overlay still does not move, restart the Vite server and test again.

---

### The browser asks to share the screen again

This usually means `stream.html` was reloaded.

Open it again and click:

```txt
Share screen
```

Avoid editing `public/stream.html` during a live test.

---

### The overlay is active but hidden elements reappear after saving

The loader should reapply the overlay visibility state after remounting the scene.

Make sure the elements that should disappear have:

```html
class="dev-overlay-hide-when-active"
```

---

### AR turns black or leaves passthrough

Make sure the shell does not use:

```html
<a-sky></a-sky>
```

Use transparent rendering:

```html
renderer="colorManagement: true; alpha: true"
background="transparent: true"
```

The current entry point for AR testing should be:

```txt
dev-shell.html
```

---

## Summary

Dev Overlay for WebXR provides a stable AR development environment for A-Frame projects.

The key idea is to separate the stable AR shell from the editable project scene and the editable overlay layout configuration.

```txt
dev-shell.html
→ keeps AR alive

project-scene.html
→ changes scene content during development

dev-overlay-position.js
→ changes overlay screen position and size during development
```

This allows developers to edit A-Frame HTML content and adjust the streamed screen layout while staying inside the Meta Quest AR session.
