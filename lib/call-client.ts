import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  JoinResponse,
  MediaMeta,
  PeerInfo,
  ServerToClientEvents,
  SignalPayload,
} from './protocol';
import { toast } from './toast';

const AUDIO_CONSTRAINTS: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
  facingMode: 'user',
};
const SCREEN_MAX_BITRATE = 8_000_000; // the movie gets most of the bandwidth
const SCREEN_AUDIO_BITRATE = 256_000; // stereo movie sound
const CAM_MAX_BITRATE = 1_500_000; // sharp 720p faces

/** Prefer VP9 for every video stream: noticeably sharper than VP8 at the same bitrate. */
function preferVp9(transceiver: RTCRtpTransceiver | undefined) {
  const caps = typeof RTCRtpReceiver !== 'undefined' ? RTCRtpReceiver.getCapabilities('video')?.codecs : undefined;
  if (!transceiver?.setCodecPreferences || !caps) return;
  const isVp9 = (c: RTCRtpCodec) => c.mimeType.toLowerCase() === 'video/vp9';
  const profile0First = (a: RTCRtpCodec, b: RTCRtpCodec) =>
    Number(!a.sdpFmtpLine?.includes('profile-id=0')) - Number(!b.sdpFmtpLine?.includes('profile-id=0'));
  const vp9 = caps.filter(isVp9).sort(profile0First);
  if (!vp9.length) return;
  try {
    transceiver.setCodecPreferences([...vp9, ...caps.filter((c) => !isVp9(c))]);
  } catch {
    /* transceiver already stopped */
  }
}

/**
 * WebRTC sends Opus as mono ~32 kbps by default, which is tuned for voices. Advertising stereo and a
 * high bitrate in the description we receive makes our side send full-quality stereo movie sound.
 */
export function enableStereoOpus(sdp: string) {
  const pt = sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/i)?.[1];
  if (!pt) return sdp;
  return sdp.replace(new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`, 'g'), (line, params: string) =>
    params.includes('stereo=1') ? line : `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=510000`,
  );
}

export type Connection = 'idle' | 'waiting' | 'connecting' | 'connected' | 'trouble' | 'reconnecting';
export type ChatEntry = { id: number; name: string; text: string; mine: boolean };
export type Reaction = { id: number; emoji: string; left: number; drift: number };

export type CallState = {
  phase: 'lobby' | 'call' | 'left';
  micOn: boolean;
  camOn: boolean;
  /** Bumped whenever tracks are added to/removed from the local camera stream. */
  localVersion: number;
  localCam: MediaStream | null;
  localScreen: MediaStream | null;
  peer: PeerInfo | null;
  remoteMeta: MediaMeta;
  remoteStreams: Record<string, MediaStream>;
  connection: Connection;
  deviceMessage: string;
  chat: ChatEntry[];
  unread: number;
  reactions: Reaction[];
};

const emptyMeta = (): MediaMeta => ({ camera: null, screen: null, camOn: false, micOn: false });

export const INITIAL_STATE: CallState = {
  phase: 'lobby',
  micOn: false,
  camOn: false,
  localVersion: 0,
  localCam: null,
  localScreen: null,
  peer: null,
  remoteMeta: emptyMeta(),
  remoteStreams: {},
  connection: 'idle',
  deviceMessage: '',
  chat: [],
  unread: 0,
  reactions: [],
};

let nextId = 1;

/**
 * Owns the socket, the local media and the RTCPeerConnection for one room.
 * React reads it through subscribe/getSnapshot (useSyncExternalStore).
 */
export class CallClient {
  private state: CallState = INITIAL_STATE;
  private listeners = new Set<() => void>();
  private socket: Socket<ServerToClientEvents, ClientToServerEvents>;
  private readonly localCam = new MediaStream();
  private pc: RTCPeerConnection | null = null;
  private camSender: RTCRtpSender | null = null;
  private micSender: RTCRtpSender | null = null;
  private screenSenders: RTCRtpSender[] = [];
  private makingOffer = false;
  private ignoreOffer = false;
  private polite = false;
  private joined = false;
  private destroyed = false;
  private chatOpen = false;
  private name = '';
  private password = '';

  constructor(
    readonly roomId: string,
    private readonly iceServers: RTCIceServer[],
  ) {
    this.state = { ...INITIAL_STATE, localCam: this.localCam };
    this.socket = io({ autoConnect: false });
    this.wireSocket();
  }

  // ───────────── store plumbing ─────────────
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  // ───────────── local media ─────────────
  async initMedia() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.set({ deviceMessage: 'This browser cannot access a camera here (needs https or localhost).' });
      return;
    }
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const c of [{ audio: AUDIO_CONSTRAINTS, video: VIDEO_CONSTRAINTS }, { audio: AUDIO_CONSTRAINTS }, { video: VIDEO_CONSTRAINTS }]) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (this.destroyed) {
      stream?.getTracks().forEach((t) => t.stop());
      return;
    }
    if (!stream) {
      this.set({
        deviceMessage:
          (lastErr as DOMException)?.name === 'NotAllowedError'
            ? 'Camera/mic permission was denied. You can still join and watch.'
            : 'No camera or microphone found. You can still join and watch.',
      });
      return;
    }
    for (const t of stream.getTracks()) this.localCam.addTrack(t);
    const micOn = stream.getAudioTracks().length > 0;
    const camOn = stream.getVideoTracks().length > 0;
    this.set({
      micOn,
      camOn,
      localVersion: this.state.localVersion + 1,
      deviceMessage: !camOn ? 'No camera available. Joining with audio only.' : !micOn ? 'No microphone available.' : '',
    });
  }

  async setMic(on: boolean) {
    let track = this.localCam.getAudioTracks()[0];
    if (on && !track) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        track = s.getAudioTracks()[0];
        this.localCam.addTrack(track);
        if (this.pc) {
          if (this.micSender) await this.micSender.replaceTrack(track);
          else this.micSender = this.pc.addTrack(track, this.localCam);
        }
      } catch {
        toast('Could not turn on the microphone.');
        return;
      }
    }
    if (track) track.enabled = on;
    this.set({ micOn: on && !!track });
    this.sendMeta();
  }

  async setCam(on: boolean) {
    if (on) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: VIDEO_CONSTRAINTS });
        const track = s.getVideoTracks()[0];
        this.localCam.addTrack(track);
        if (this.pc) {
          if (this.camSender) await this.camSender.replaceTrack(track);
          else {
            this.camSender = this.pc.addTrack(track, this.localCam);
            preferVp9(this.transceiverOf(this.camSender));
          }
          this.tuneSenders();
        }
      } catch {
        toast('Could not turn on the camera.');
        return;
      }
    } else {
      // Really release the camera so its light turns off.
      for (const t of this.localCam.getVideoTracks()) {
        t.stop();
        this.localCam.removeTrack(t);
      }
      await this.camSender?.replaceTrack(null).catch(() => {});
    }
    this.set({ camOn: on, localVersion: this.state.localVersion + 1 });
    this.sendMeta();
  }

  // ───────────── screen share ─────────────
  async startShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast('Screen sharing is not supported in this browser. Use desktop Chrome, Edge or Firefox.');
      return;
    }
    if (this.state.peer && this.state.remoteMeta.screen) {
      toast(`${this.state.peer.name} is already sharing.`);
      return;
    }
    const controller = 'CaptureController' in window ? new CaptureController() : null;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 }, width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 } },
        // Movie audio: no voice processing, so music and effects aren't mangled.
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 },
          sampleRate: { ideal: 48000 },
        },
        // Chrome-specific capture hints (not yet in lib.dom typings).
        ...({
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          preferCurrentTab: false,
          ...(controller ? { controller } : {}),
        } as object),
      });
    } catch (e) {
      if ((e as DOMException).name !== 'NotAllowedError') toast('Could not start screen sharing.');
      return;
    }
    // Stay on this tab (with both faces) instead of jumping to the shared movie tab.
    try {
      controller?.setFocusBehavior('no-focus-change');
    } catch {
      /* only possible for tabs/windows */
    }

    const [video] = stream.getVideoTracks();
    if (video) {
      video.contentHint = 'motion';
      video.addEventListener('ended', () => this.stopShare());
    }
    for (const a of stream.getAudioTracks()) a.contentHint = 'music';

    this.set({ localScreen: stream });
    if (this.pc) this.addScreenTracks(stream);
    if (!stream.getAudioTracks().length) {
      toast('No movie sound is being shared. Share a Chrome tab and turn on "Also share tab audio".', 8000);
    }
    this.sendMeta();
  }

  stopShare() {
    const screen = this.state.localScreen;
    if (!screen) return;
    for (const t of screen.getTracks()) t.stop();
    if (this.pc && this.pc.signalingState !== 'closed') {
      for (const s of this.screenSenders) {
        try {
          this.pc.removeTrack(s);
        } catch {
          /* already gone */
        }
      }
    }
    this.screenSenders = [];
    this.set({ localScreen: null });
    this.sendMeta();
  }

  private addScreenTracks(stream: MediaStream) {
    this.screenSenders = stream.getTracks().map((t) => this.pc!.addTrack(t, stream));
    for (const s of this.screenSenders) if (s.track?.kind === 'video') preferVp9(this.transceiverOf(s));
  }

  private transceiverOf(sender: RTCRtpSender | null) {
    return sender ? this.pc?.getTransceivers().find((t) => t.sender === sender) : undefined;
  }

  // ───────────── room membership ─────────────
  async join(name: string, password: string): Promise<string | null> {
    this.name = name;
    this.password = password;
    if (!this.socket.connected) this.socket.connect();
    const res = await this.emitJoin();
    if ('error' in res) return res.error;
    this.set({ phase: 'call' });
    this.onJoined(res);
    return null;
  }

  leave() {
    this.joined = false;
    this.socket.emit('leave');
    this.socket.disconnect();
    this.stopShare();
    this.closePeer();
    for (const t of this.localCam.getTracks()) t.stop();
    this.set({ phase: 'left', peer: null, connection: 'idle' });
  }

  destroy() {
    this.destroyed = true;
    this.joined = false;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.closePeer();
    this.state.localScreen?.getTracks().forEach((t) => t.stop());
    for (const t of this.localCam.getTracks()) t.stop();
    this.listeners.clear();
  }

  private emitJoin() {
    return new Promise<JoinResponse>((resolve) => {
      this.socket.emit('join', { roomId: this.roomId, password: this.password, name: this.name }, resolve);
    });
  }

  private onJoined(res: Extract<JoinResponse, { ok: true }>) {
    this.joined = true;
    this.polite = res.polite;
    // The person already in the room sends the first offer; our side is created when it arrives.
    this.closePeer();
    this.set({ peer: res.peer });
    this.sendMeta();
    this.updateConnection();
  }

  private wireSocket() {
    const s = this.socket;
    s.on('signal', (data) => void this.onSignal(data));

    s.on('peer-joined', (peer) => {
      this.polite = false; // whoever was here first is the impolite peer
      this.set({ peer, remoteMeta: emptyMeta(), remoteStreams: {} });
      this.createPeer();
      toast(`${peer.name} joined`);
    });

    s.on('peer-left', () => {
      if (this.state.peer) toast(`${this.state.peer.name} left`);
      this.closePeer();
      this.set({ peer: null, remoteMeta: emptyMeta(), remoteStreams: {} });
      this.updateConnection();
    });

    s.on('disconnect', () => {
      if (!this.joined) return;
      this.closePeer();
      this.set({ peer: null, remoteMeta: emptyMeta(), remoteStreams: {}, connection: 'reconnecting' });
    });

    // Automatic rejoin after a network blip.
    s.on('connect', async () => {
      if (!this.joined) return;
      const res = await this.emitJoin();
      if ('error' in res) toast(res.error, 8000);
      else this.onJoined(res);
    });

    s.on('chat', ({ name, text }) => this.addChat(name, text, false));
    s.on('reaction', (emoji) => this.showReaction(emoji));
  }

  // ───────────── WebRTC ─────────────
  private signal(data: SignalPayload) {
    this.socket.emit('signal', data);
  }

  private sendMeta() {
    if (!this.state.peer) return;
    this.signal({
      meta: {
        camera: this.localCam.id,
        screen: this.state.localScreen?.id ?? null,
        camOn: this.state.camOn,
        micOn: this.state.micOn,
      },
    });
  }

  private async tuneSender(
    sender: RTCRtpSender | null | undefined,
    encoding: Partial<RTCRtpEncodingParameters>,
    degradationPreference?: 'balanced' | 'maintain-framerate' | 'maintain-resolution',
  ) {
    if (!sender?.track) return;
    const p = sender.getParameters() as RTCRtpSendParameters & { degradationPreference?: string };
    if (!p.encodings?.length) return;
    Object.assign(p.encodings[0], encoding);
    if (degradationPreference) p.degradationPreference = degradationPreference;
    await sender.setParameters(p).catch(() => {});
  }

  private tuneSenders() {
    void this.tuneSender(this.camSender, { maxBitrate: CAM_MAX_BITRATE, maxFramerate: 30 });
    const screenVideo = this.screenSenders.find((s) => s.track?.kind === 'video');
    const screenAudio = this.screenSenders.find((s) => s.track?.kind === 'audio');
    const high = { priority: 'high', networkPriority: 'high' } as Partial<RTCRtpEncodingParameters>;
    // "balanced" stops Chrome from collapsing the resolution the moment bandwidth dips.
    void this.tuneSender(screenVideo, { maxBitrate: SCREEN_MAX_BITRATE, maxFramerate: 30, ...high }, 'balanced');
    void this.tuneSender(screenAudio, { maxBitrate: SCREEN_AUDIO_BITRATE, ...high });
  }

  private closePeer() {
    if (this.pc) {
      this.pc.ontrack = this.pc.onicecandidate = this.pc.onnegotiationneeded = null;
      this.pc.onconnectionstatechange = this.pc.onsignalingstatechange = null;
      this.pc.close();
    }
    this.pc = null;
    this.camSender = this.micSender = null;
    this.screenSenders = [];
  }

  private createPeer() {
    this.closePeer();
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.pc = pc;
    this.makingOffer = false;
    this.ignoreOffer = false;

    for (const t of this.localCam.getTracks()) {
      const sender = pc.addTrack(t, this.localCam);
      if (t.kind === 'video') {
        this.camSender = sender;
        preferVp9(this.transceiverOf(sender));
      } else this.micSender = sender;
    }
    if (this.state.localScreen) this.addScreenTracks(this.state.localScreen);

    pc.ontrack = ({ streams: [stream], transceiver, track }) => {
      // Set before our answer is created so both directions negotiate VP9.
      if (track.kind === 'video') preferVp9(transceiver);
      if (!stream) return;
      const bump = () => this.set({ remoteStreams: { ...this.state.remoteStreams, [stream.id]: stream } });
      stream.onaddtrack = stream.onremovetrack = bump;
      bump();
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.signal({ candidate: candidate.toJSON() });
    };
    // "Perfect negotiation": either side can renegotiate (e.g. start a screen share) at any time.
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        this.signal({ description: pc.localDescription!.toJSON() });
      } catch (e) {
        console.error('negotiation failed', e);
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
      this.updateConnection();
    };
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') this.tuneSenders();
    };
    this.sendMeta();
    this.updateConnection();
  }

  private async onSignal(data: SignalPayload) {
    if ('meta' in data) {
      this.set({ remoteMeta: { ...this.state.remoteMeta, ...data.meta } });
      return;
    }
    if (!this.state.peer) return;
    if (!this.pc) this.createPeer();
    const pc = this.pc!;
    try {
      if ('description' in data) {
        const { description } = data;
        const collision = description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && collision;
        if (this.ignoreOffer) return;
        await pc.setRemoteDescription({ type: description.type, sdp: enableStereoOpus(description.sdp ?? '') });
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.signal({ description: pc.localDescription!.toJSON() });
        }
      } else if ('candidate' in data) {
        try {
          await pc.addIceCandidate(data.candidate);
        } catch (e) {
          if (!this.ignoreOffer) throw e;
        }
      }
    } catch (e) {
      console.error('signal handling failed', e);
    }
  }

  private updateConnection() {
    let connection: Connection;
    if (!this.joined) connection = 'idle';
    else if (!this.socket.connected) connection = 'reconnecting';
    else if (!this.state.peer) connection = 'waiting';
    else {
      const cs = this.pc?.connectionState;
      connection = cs === 'connected' ? 'connected' : cs === 'failed' || cs === 'disconnected' ? 'trouble' : 'connecting';
    }
    if (connection !== this.state.connection) this.set({ connection });
  }

  // ───────────── chat & reactions ─────────────
  sendChat(text: string) {
    const t = text.trim();
    if (!t) return;
    this.socket.emit('chat', t);
    this.addChat(this.name, t, true);
  }

  setChatOpen(open: boolean) {
    this.chatOpen = open;
    if (open && this.state.unread) this.set({ unread: 0 });
  }

  private addChat(name: string, text: string, mine: boolean) {
    const incomingWhileClosed = !mine && !this.chatOpen;
    this.set({
      chat: [...this.state.chat, { id: nextId++, name, text, mine }],
      unread: this.state.unread + (incomingWhileClosed ? 1 : 0),
    });
    if (incomingWhileClosed) toast(`${name}: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}`);
  }

  sendReaction(emoji: string) {
    this.socket.emit('reaction', emoji);
    this.showReaction(emoji);
  }

  private showReaction(emoji: string) {
    const r: Reaction = { id: nextId++, emoji, left: 10 + Math.random() * 80, drift: (Math.random() - 0.5) * 120 };
    this.set({ reactions: [...this.state.reactions, r] });
    setTimeout(() => this.set({ reactions: this.state.reactions.filter((x) => x.id !== r.id) }), 3200);
  }
}
