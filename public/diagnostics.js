'use strict';
const button = document.getElementById('run');
const result = document.getElementById('result');
function checkTunnel() {
  return new Promise(resolve => {
    let socket;
    const timer = setTimeout(() => finish('Timed out'), 10000);
    function finish(message) { clearTimeout(timer); if (socket) { socket.onclose = socket.onerror = null; socket.close(); } resolve(message); }
    try {
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/wisp/`);
      socket.onopen = () => finish('Connected');
      socket.onerror = () => finish('Connection failed');
      socket.onclose = () => finish('Connection closed');
    } catch { finish('Connection failed'); }
  });
}
button.onclick = async () => {
  button.disabled = true; result.textContent = 'Checking…';
  try {
    const [ready, tunnel, network] = await Promise.all([
      fetch('/health/ready', { cache:'no-store', signal:AbortSignal.timeout(15000) }).then(r=>r.json()),
      checkTunnel(),
      fetch('/health/network', { cache:'no-store', signal:AbortSignal.timeout(15000) }).then(r=>{ if(!r.ok) throw Error('Network diagnostic unavailable'); return r.json(); })
    ]);
    result.textContent = `Browser files: ${ready.status}\nConnection tunnel: ${tunnel}\n\n` + network.results.map(r=>`${r.host}: ${r.result}${r.status ? ' (HTTP '+r.status+')' : ''} — ${r.elapsedMs} ms`).join('\n');
  } catch { result.textContent = 'The checks could not finish. The server may be waking up or unreachable. Wait a moment and try again.'; }
  finally { button.disabled = false; }
};
