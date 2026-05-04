# TCC v3 · Dev Overlay para WebXR

Este projeto implementa um componente reutilizável para A-Frame que permite transmitir a tela do computador para dentro de uma cena WebXR.

A versão v3 usa Vite Dev Server, WebRTC e o websocket interno de HMR do Vite para fazer a sinalização entre a página da cena e a página de transmissão.

## Objetivo

O objetivo do projeto é reduzir o ciclo de desenvolvimento em experiências XR.

Durante o desenvolvimento de aplicações imersivas, o programador normalmente precisa tirar o headset para alterar código, visualizar logs ou consultar a IDE. Este componente permite visualizar a tela do computador dentro da cena WebXR, mantendo o desenvolvedor dentro da experiência imersiva.

Além disso, o componente permite ocultar partes da cena quando o overlay está ativo. Isso serve para liberar uma área visual inferior, por exemplo, para o usuário conseguir interagir melhor com teclado, mesa ou elementos físicos próximos.

## Tecnologias

- A-Frame
- WebXR
- WebRTC
- Vite Dev Server
- Vite HMR WebSocket
- JavaScript

## Estrutura

```txt
tcc_v3/
├── package.json
├── vite.config.js
├── README.md
├── demo-scene.html
├── stream.html
└── src/
    └── dev-overlay.js