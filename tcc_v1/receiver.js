const video = document.getElementById("remoteVideo");
const ws = new WebSocket("wss://" + location.host);
const id = crypto.randomUUID(); // id único

let pc = new RTCPeerConnection();

pc.ontrack = (e) => {
  video.srcObject = e.streams[0];
  video.play();
};

pc.onicecandidate = (e) => {
  if (e.candidate) {
    ws.send(JSON.stringify({ type: "ice", data: e.candidate, id }));
  }
};

ws.onopen = () => {
  ws.send(JSON.stringify({ role: "receiver", id }));
};

ws.onmessage = async (msg) => {
  const { type, data } = JSON.parse(msg.data);

  if (type === "reload") {
    console.log("[hot reload] Página recarregando...");
    location.reload();
    return;
  }

  if (type === "offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(data));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: "answer", data: answer, id }));

  } else if (type === "ice") {
    await pc.addIceCandidate(new RTCIceCandidate(data));
  }
};
