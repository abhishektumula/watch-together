import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';
import { MAX_MEMBERS, cleanup, isRateLimited, passwordMatches, recordFailure, rooms } from './rooms';

type SocketData = { roomId: string | null; name: string };

const cleanName = (name: unknown) => String(name ?? '').trim().slice(0, 32) || 'Guest';

/** Socket.IO only does room membership and relays WebRTC signalling; media goes peer-to-peer. */
export function attachSignalling(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    maxHttpBufferSize: 1e6,
    // Leave other WebSocket upgrades (Next.js dev HMR) alone.
    destroyUpgrade: false,
  });

  io.on('connection', (socket) => {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || socket.handshake.address;
    socket.data.roomId = null;

    const leave = () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.data.roomId = null;
      socket.leave(roomId);
      const room = rooms.get(roomId);
      if (!room) return;
      room.members.delete(socket.id);
      room.lastActive = Date.now();
      socket.to(roomId).emit('peer-left', { id: socket.id });
    };

    socket.on('join', (req, ack) => {
      if (typeof ack !== 'function') return;
      if (socket.data.roomId) return ack({ error: 'Already in a room.' });
      if (isRateLimited(ip)) return ack({ error: 'Too many wrong attempts. Try again in a few minutes.' });

      const roomId = String(req?.roomId ?? '');
      const room = rooms.get(roomId);
      if (!room) return ack({ error: 'This room does not exist (rooms are lost if the server restarts).' });
      if (!passwordMatches(room, req?.password)) {
        recordFailure(ip);
        return ack({ error: 'Wrong password.' });
      }
      if (room.members.size >= MAX_MEMBERS) return ack({ error: 'This room already has two people in it.' });

      const name = cleanName(req?.name);
      const existing = [...room.members].map(([id, m]) => ({ id, name: m.name }));
      room.members.set(socket.id, { name });
      room.lastActive = Date.now();
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.name = name;

      // The newcomer is the "polite" peer in WebRTC perfect negotiation; the existing peer makes the first offer.
      ack({ ok: true, peer: existing[0] ?? null, polite: existing.length > 0 });
      socket.to(roomId).emit('peer-joined', { id: socket.id, name });
    });

    socket.on('signal', (data) => {
      if (socket.data.roomId) socket.to(socket.data.roomId).emit('signal', data);
    });

    socket.on('chat', (text) => {
      const msg = String(text ?? '').trim().slice(0, 1000);
      if (socket.data.roomId && msg) {
        socket.to(socket.data.roomId).emit('chat', { text: msg, name: socket.data.name, ts: Date.now() });
      }
    });

    socket.on('reaction', (emoji) => {
      const e = String(emoji ?? '').slice(0, 8);
      if (socket.data.roomId && e) socket.to(socket.data.roomId).emit('reaction', e);
    });

    socket.on('leave', leave);
    socket.on('disconnect', leave);
  });

  setInterval(cleanup, 10 * 60 * 1000).unref();
  return io;
}
