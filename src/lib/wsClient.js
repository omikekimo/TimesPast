/**
 * WebSocket client stub.
 * Set VITE_WS_URL in .env.local to activate.
 * e.g.  VITE_WS_URL=ws://localhost:4242
 *
 * When active, the server can send JSON messages:
 *   { "raw": "search -p napoleon" }
 * and the app will execute them as console commands.
 */
const WS_URL = import.meta.env.VITE_WS_URL || null;

/**
 * @param {{ onCommand: (msg: { raw: string }) => void }} opts
 * @returns {WebSocket|null}
 */
export function connectCommandSocket({ onCommand }) {
  if (!WS_URL) {
    // Stub — no-op until VITE_WS_URL is configured
    return null;
  }

  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.info('[wsClient] connected to command socket', WS_URL);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.raw) onCommand(msg);
    } catch {
      // plain-text fallback
      onCommand({ raw: e.data });
    }
  };

  ws.onerror = (e) => {
    console.warn('[wsClient] error', e);
  };

  ws.onclose = () => {
    console.info('[wsClient] disconnected');
  };

  return ws;
}
