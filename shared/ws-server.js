'use strict';
/**
 * Minimal, dependency-free WebSocket server implementation (RFC 6455 subset).
 *
 * Only what HotelOS needs is implemented:
 *   - text frame send/receive
 *   - close frame handling
 *   - client -> server frames are masked (per spec) and are unmasked here
 *   - server -> client frames are sent unmasked (per spec, servers must NOT mask)
 *
 * This avoids any external dependency (no "ws" package needed), which keeps
 * the project runnable on a fresh machine with nothing but Node.js installed.
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WSConnection extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this._buffer = Buffer.alloc(0);
    this.isAlive = true;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => {
      this.isAlive = false;
      this.emit('close');
    });
    socket.on('error', () => {
      this.isAlive = false;
    });
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    // Try to parse as many complete frames as are available.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const frame = this._tryParseFrame(this._buffer);
      if (!frame) return;
      this._buffer = this._buffer.subarray(frame.totalLength);
      this._handleFrame(frame);
    }
  }

  _tryParseFrame(buf) {
    if (buf.length < 2) return null;
    const byte1 = buf[0];
    const byte2 = buf[1];
    const fin = (byte1 & 0x80) !== 0;
    const opcode = byte1 & 0x0f;
    const masked = (byte2 & 0x80) !== 0;
    let payloadLen = byte2 & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buf.length < offset + 2) return null;
      payloadLen = buf.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLen === 127) {
      if (buf.length < offset + 8) return null;
      // We don't expect > 4GB messages; read low 32 bits only.
      payloadLen = Number(buf.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskKey = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      maskKey = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + payloadLen) return null;

    let payload = buf.subarray(offset, offset + payloadLen);
    if (masked) {
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i++) {
        unmasked[i] = payload[i] ^ maskKey[i % 4];
      }
      payload = unmasked;
    }

    return { fin, opcode, payload, totalLength: offset + payloadLen };
  }

  _handleFrame(frame) {
    switch (frame.opcode) {
      case 0x1: // text
        this.emit('message', frame.payload.toString('utf8'));
        break;
      case 0x8: // close
        this._sendRaw(0x8, Buffer.alloc(0));
        this.socket.end();
        break;
      case 0x9: // ping
        this._sendRaw(0xa, frame.payload); // pong
        break;
      case 0xa: // pong
        this.isAlive = true;
        break;
      default:
        // ignore binary/continuation frames - not used by HotelOS
        break;
    }
  }

  _sendRaw(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch (_err) {
      // socket already gone - ignore, close event will clean up
    }
  }

  send(str) {
    if (!this.isAlive && this.socket.destroyed) return;
    this._sendRaw(0x1, Buffer.from(str, 'utf8'));
  }

  close() {
    try {
      this._sendRaw(0x8, Buffer.alloc(0));
      this.socket.end();
    } catch (_err) {
      /* ignore */
    }
  }
}

/**
 * Attach a WebSocket upgrade handler to an existing http.Server.
 * @param {import('http').Server} httpServer
 * @param {(conn: WSConnection, requestUrl: URL) => void} onConnection
 */
function attachWebSocketServer(httpServer, onConnection) {
  httpServer.on('upgrade', (req, socket) => {
    if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + GUID)
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n');

    socket.write(responseHeaders);

    const conn = new WSConnection(socket);
    let requestUrl;
    try {
      requestUrl = new URL(req.url, 'http://localhost');
    } catch (_err) {
      requestUrl = new URL('http://localhost/');
    }
    onConnection(conn, requestUrl);
  });
}

module.exports = { attachWebSocketServer };
