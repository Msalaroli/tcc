import fs from "fs";
import https from "https";
import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = https.createServer(
  {
    key: fs.readFileSync("cert.key"),
    cert: fs.readFileSync("cert.crt"),
  },
  app
);

app.use(express.static(__dirname));

const wss = new WebSocketServer({ server });
let sender = null;
const receivers = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const parsed = JSON.parse(msg);

    if (parsed.role === "sender") {
      sender = ws;
    } else if (parsed.role === "receiver") {
      receivers.set(parsed.id, ws);
      sender?.send(JSON.stringify({ type: "connect", id: parsed.id }));
    }

    if (parsed.type && parsed.id) {
      const target = ws === sender ? receivers.get(parsed.id) : sender;
      if (target) target.send(JSON.stringify(parsed));
    }
  });

  ws.on("close", () => {
    receivers.forEach((rws, id) => {
      if (rws === ws) receivers.delete(id);
    });
  });
});


fs.watch("index.html", (eventType) => {
  if (eventType === "change") {
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: "reload" }));
      }
    });
  }
});

server.listen(3000, () => {
  console.log("✅ HTTPS server running at https://localhost:3000");
});
