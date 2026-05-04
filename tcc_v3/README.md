# TCC v3 · Dev Overlay para WebXR

Este projeto implementa um componente reutilizável para A-Frame que permite transmitir a tela do computador para dentro de uma cena WebXR em tempo real.

A versão v3 utiliza Vite Dev Server, WebRTC e o WebSocket interno do Vite HMR como mecanismo de sinalização.

## Objetivo

O objetivo do projeto é reduzir o ciclo de desenvolvimento em experiências XR.

Durante o desenvolvimento de aplicações imersivas, o desenvolvedor frequentemente precisa remover o headset para visualizar código, debugar ou acessar documentação.

Este componente permite visualizar a tela do computador diretamente dentro da cena WebXR, mantendo o desenvolvedor em imersão.

Além disso, o sistema adapta automaticamente a cena ao ativar o overlay, ocultando elementos previamente definidos.

## Tecnologias

- A-Frame
- WebXR
- WebRTC
- Vite Dev Server
- WebSocket HMR
- JavaScript

## Estrutura do Projeto

    tcc_v3/
    ├── package.json
    ├── vite.config.js
    ├── README.md
    ├── demo-scene.html
    ├── stream.html
    └── src/
        └── dev-overlay.js

## Como rodar o projeto

### 1. Instalar dependências

    npm install

### 2. Iniciar servidor

    npm run dev

O Vite mostrará um endereço local e um endereço de rede.

Exemplo:

    Local:   https://localhost:5173/
    Network: https://192.168.0.10:5173/

## Como testar

### No computador

Abra:

    https://localhost:5173/stream.html

Clique em:

    Compartilhar tela

### No headset

Abra:

    https://SEU-IP:5173/demo-scene.html

Exemplo:

    https://192.168.0.10:5173/demo-scene.html

Entre no modo WebXR e clique no botão do overlay.

## Como usar em outro projeto

### 1. Importar o A-Frame e o componente

    <script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
    <script type="module" src="/src/dev-overlay.js"></script>

### 2. Ativar o componente na cena

    <a-scene dev-overlay>
    </a-scene>

### 3. Adicionar botão de controle

Exemplo de botão fixo na visão do usuário:

    <a-entity
      follow-camera
      class="clickable"
      dev-overlay-trigger
      geometry="primitive: box; width: 0.06; height: 0.06; depth: 0.04"
      material="color: #24CAFF">
    </a-entity>

Esse botão permanece sempre visível, independente da movimentação do usuário.

## Ocultação automática da cena

O componente permite esconder elementos da cena quando o overlay está ativo.

Para isso, adicione a classe:

    class="dev-overlay-hide-when-active"

Exemplo:

    <a-plane
      class="dev-overlay-hide-when-active"
      rotation="-90 0 0"
      width="5"
      height="5"
      color="#7BC8A4">
    </a-plane>

Comportamento:

| Estado | Comportamento |
|---|---|
| Overlay ON | Tela aparece e elementos marcados somem |
| Overlay OFF | Tela some e elementos marcados voltam |

## Configuração do componente

Você pode ajustar tamanho e posição do overlay:

    <a-scene dev-overlay="width: 1.2; height: 0.7; position: 0 1.4 -1">
    </a-scene>

Parâmetros:

| Parâmetro | Descrição |
|---|---|
| width | Largura da tela virtual |
| height | Altura da tela virtual |
| position | Posição da tela virtual no espaço |

## Eventos disponíveis

    scene.addEventListener('dev-overlay-enabled', () => {
      console.log('Overlay ativado');
    });

    scene.addEventListener('dev-overlay-disabled', () => {
      console.log('Overlay desativado');
    });

## Arquitetura

O sistema possui dois lados principais.

### stream.html

Página aberta no computador.

Responsabilidades:

- Capturar a tela com getDisplayMedia
- Criar uma conexão WebRTC
- Enviar o vídeo para a cena WebXR

### demo-scene.html

Página aberta no headset.

Responsabilidades:

- Carregar a cena A-Frame
- Ativar o componente dev-overlay
- Receber o stream WebRTC
- Renderizar a tela dentro da experiência XR

### vite.config.js

Responsabilidades:

- Iniciar o Vite Dev Server
- Habilitar HTTPS no ambiente local
- Usar o WebSocket interno do Vite como canal de sinalização WebRTC

As mensagens usadas na sinalização são:

    rtc:connect
    rtc:offer
    rtc:answer
    rtc:ice

Fluxo:

    stream.html -> offer -> Vite -> demo-scene.html
    demo-scene.html -> answer -> Vite -> stream.html
    ICE candidates -> troca contínua entre as páginas

## Por que usar Vite

A versão v3 substitui a abordagem anterior baseada em servidor HTTPS manual e WebSocket próprio.

Com Vite:

- Não é necessário manter um server.js próprio
- Não é necessário criar manualmente cert.key e cert.crt
- O projeto fica mais próximo do fluxo moderno de desenvolvimento web
- O HMR continua funcionando
- A sinalização WebRTC aproveita a conexão WebSocket já existente do Vite

## Limitações

O componente não acessa diretamente o passthrough ou as câmeras externas do headset.

A ocultação da parte inferior da cena não revela o mundo real por meio de câmera. Ela apenas remove elementos virtuais marcados pelo desenvolvedor, permitindo que a cena fique menos obstrutiva durante o uso do overlay.

## Evolução do projeto

### v1

A primeira versão usava um servidor próprio com HTTPS, Express e WebSocket.

Problemas:

- Exigia certificado manual
- Aumentava a complexidade de configuração
- Misturava servidor, sinalização e aplicação

### v2

A segunda tentativa explorou alternativas como PeerJS e uma estrutura mais próxima de componente.

Problemas:

- Adicionava dependência externa
- Reduzia o controle sobre a sinalização
- Afastava o projeto da arquitetura base estudada

### v3

A terceira versão usa Vite, WebRTC e um componente A-Frame reutilizável.

Melhorias:

- Arquitetura mais simples
- Componente reutilizável
- Demo mais clara
- Ocultação automática de elementos da cena
- Documentação voltada para uso por outros desenvolvedores

## Execução rápida

    npm install
    npm run dev

Depois disso:

    PC:      https://localhost:5173/stream.html
    Headset: https://SEU-IP-LOCAL:5173/demo-scene.html

## 🔧 Integração completa em outro projeto (com streaming)

Para utilizar o Dev Overlay com transmissão de tela em outro projeto, é necessário integrar três partes:

1. O componente de overlay na cena XR  
2. A página de transmissão (stream.html)  
3. A configuração do Vite para sinalização WebRTC  

---

### 1. Copiar os arquivos necessários

Copie os seguintes arquivos para o seu projeto:

```
src/dev-overlay.js
stream.html
vite.config.js
```

Estrutura exemplo:

```
meu-projeto/
├── index.html
├── stream.html
├── vite.config.js
└── src/
    └── dev-overlay.js
```

---

### 2. Configurar o Vite

Adicione no seu `vite.config.js`:

```js
{
  name: 'dev-overlay-rtc-signaling',
  configureServer(server) {
    server.ws.on('dev-overlay:signal', (message) => {
      server.ws.send('dev-overlay:signal', message);
    });
  }
}
```

---

### 3. Importar o componente na cena

No seu HTML principal:

```html
<script src="https://aframe.io/releases/1.4.2/aframe.min.js"></script>
<script type="module" src="/src/dev-overlay.js"></script>
```

---

### 4. Ativar o componente

```html
<a-scene dev-overlay>
```

---

### 5. Criar botão de controle

```html
<a-entity
  follow-camera
  class="clickable"
  dev-overlay-trigger
  geometry="primitive: box; width: 0.06; height: 0.06; depth: 0.04"
  material="color: #24CAFF">
</a-entity>
```

---

### 6. Marcar elementos que devem desaparecer

Adicione a classe:

```
dev-overlay-hide-when-active
```

Exemplo:

```html
<a-plane
  class="dev-overlay-hide-when-active"
  rotation="-90 0 0"
  width="5"
  height="5">
</a-plane>
```

---

### 7. Executar o sistema

```bash
npm install
npm run dev
```

---

### 8. Abrir as duas partes

No computador:

```
https://localhost:5173/stream.html
```

No headset:

```
https://SEU-IP:5173/index.html
```

---

### 9. Iniciar transmissão

1. Clique em "Compartilhar tela" no computador  
2. Entre no modo WebXR  
3. Clique no botão do overlay  

---

## ⚠️ Importante

O sistema só funciona corretamente quando:

- o Vite está rodando  
- a página `stream.html` está aberta  
- o usuário autorizou a captura de tela  

Caso contrário, o overlay será exibido sem conteúdo (tela preta).

---

## 🧠 Arquitetura resumida

```
stream.html → captura tela → envia via WebRTC
Vite → faz sinalização
dev-overlay → recebe e renderiza na cena
```