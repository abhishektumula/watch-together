// Types shared by the Socket.IO server (lib/signalling.ts) and the browser client (lib/call-client.ts).

export type PeerInfo = { id: string; name: string };

/** What each side tells the other about its media, so streams can be told apart. */
export type MediaMeta = {
  camera: string | null; // MediaStream id of the camera/mic stream
  screen: string | null; // MediaStream id of the screen share, or null when not sharing
  camOn: boolean;
  micOn: boolean;
};

export type SignalPayload =
  | { description: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit }
  | { meta: MediaMeta };

export type JoinRequest = { roomId: string; password: string; name: string };
export type JoinResponse = { ok: true; peer: PeerInfo | null; polite: boolean } | { error: string };

export type ChatMessage = { name: string; text: string; ts: number };

export interface ServerToClientEvents {
  'peer-joined': (peer: PeerInfo) => void;
  'peer-left': (info: { id: string }) => void;
  signal: (data: SignalPayload) => void;
  chat: (msg: ChatMessage) => void;
  reaction: (emoji: string) => void;
}

export interface ClientToServerEvents {
  join: (req: JoinRequest, ack: (res: JoinResponse) => void) => void;
  signal: (data: SignalPayload) => void;
  chat: (text: string) => void;
  reaction: (emoji: string) => void;
  leave: () => void;
}

export const ROOM_ID_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
