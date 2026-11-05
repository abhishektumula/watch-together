import crypto from 'node:crypto';

// In-memory room store. It lives on globalThis so the custom server (Socket.IO) and the
// Next.js server code (pages, route handlers) share the same Map, even though they are
// compiled as separate module instances inside one Node process.

export const MAX_MEMBERS = 2;
const EMPTY_ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS_PER_WINDOW = 20;

export type Room = {
  salt: Buffer;
  hash: Buffer;
  lastActive: number;
  members: Map<string, { name: string }>;
};

type Store = {
  rooms: Map<string, Room>;
  fails: Map<string, { count: number; resetAt: number }>;
};

const g = globalThis as typeof globalThis & { __watchTogether?: Store };
const store: Store = (g.__watchTogether ??= { rooms: new Map(), fails: new Map() });
export const rooms = store.rooms;

const ROOM_ALPHABET = 'abcdefghijkmnopqrstuvwxyz';
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(alphabet: string, length: number) {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

function makeRoomId() {
  let id: string;
  do {
    id = `${randomString(ROOM_ALPHABET, 3)}-${randomString(ROOM_ALPHABET, 4)}-${randomString(ROOM_ALPHABET, 3)}`;
  } while (rooms.has(id));
  return id;
}

const hashPassword = (password: string, salt: Buffer) => crypto.scryptSync(password, salt, 32);

export function createRoom(customPassword = ''): { roomId: string; password: string } | { error: string } {
  const custom = customPassword.trim();
  if (custom.length > 64) return { error: 'Password is too long (max 64 characters).' };
  const password = custom || randomString(PASSWORD_ALPHABET, 6);
  const roomId = makeRoomId();
  const salt = crypto.randomBytes(16);
  rooms.set(roomId, { salt, hash: hashPassword(password, salt), lastActive: Date.now(), members: new Map() });
  return { roomId, password };
}

export function getRoomStatus(id: string) {
  const room = rooms.get(id);
  return { exists: !!room, full: !!room && room.members.size >= MAX_MEMBERS };
}

export function passwordMatches(room: Room, password: unknown) {
  return crypto.timingSafeEqual(hashPassword(String(password ?? ''), room.salt), room.hash);
}

export function isRateLimited(key: string) {
  const e = store.fails.get(key);
  return !!e && e.resetAt > Date.now() && e.count >= MAX_FAILS_PER_WINDOW;
}

export function recordFailure(key: string) {
  const now = Date.now();
  const e = store.fails.get(key);
  if (!e || e.resetAt <= now) store.fails.set(key, { count: 1, resetAt: now + FAIL_WINDOW_MS });
  else e.count++;
}

export function cleanup() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (room.members.size === 0 && now - room.lastActive > EMPTY_ROOM_TTL_MS) rooms.delete(id);
  }
  for (const [key, e] of store.fails) if (e.resetAt <= now) store.fails.delete(key);
}

/**
 * STUN works for most home networks. For strict NATs / mobile networks add a TURN server:
 * ICE_SERVERS='[{"urls":"turn:host:3478","username":"u","credential":"p"}]'
 */
export function getIceServers(): RTCIceServer[] {
  const fallback = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (!process.env.ICE_SERVERS) return fallback;
  try {
    return JSON.parse(process.env.ICE_SERVERS);
  } catch {
    console.error('ICE_SERVERS is not valid JSON, falling back to public STUN');
    return fallback;
  }
}
