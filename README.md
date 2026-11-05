# Watch Together

A private video room for exactly two people. One of you shares a movie, and **both faces stay on screen next to (or on top of) the movie**, unlike Google Meet, where sharing your screen hides the other person.

## Features

- **Rooms for two**: each room gets a random ID (`abc-defg-hij`) and a password. A third person is turned away.
- **Screen-share menu**: a floating button in the corner of the shared screen opens every screen action: layout, hide/show faces, reset position, fullscreen, movie and voice volume, and (for the sharer) stop sharing. It fades out when the mouse is idle.
- **Four layouts** that each person picks independently (from the screen-share menu, or press `L` to cycle):
  - **Cinema**: the movie fills the screen and both faces float on top. Drag them anywhere, resize from the corner grip, and double-click to reset.
  - **Sidebar**: movie on the left, both faces stacked on the right.
  - **Strip**: movie on top, faces in a row underneath.
  - **Faces**: you two big, the movie small in a corner.
- **Fullscreen keeps the faces**: fullscreen applies to the whole stage, not just the video, and the controls fade out.
- **The sharer stays in the room**: when you share a Chrome tab, the browser stays on the Watch Together tab (no jumping to the movie tab), so you watch the same layout they do.
- **Movie sound** is shared along with the picture (Chrome/Edge tab audio), with separate volume sliders for *movie* and *their voice*.
- **Quality**: VP9 video for everything (sharper than VP8 at the same bandwidth); the movie is captured at up to 1080p30 and may use up to 8 Mbps, with Chrome told to keep the resolution up when bandwidth dips; faces get up to 1.5 Mbps at 720p; movie sound is sent as **stereo Opus at up to 256 kbps** instead of WebRTC's default mono voice quality.
- Chat, floating emoji reactions, mic/camera toggles (turning the camera off really turns it off, so the light goes out), and automatic reconnection.
- Peer-to-peer: video goes directly between the two browsers. The server only relays connection setup messages. Nothing is recorded.

Built with **Next.js 16 (App Router) + React 19 + TypeScript**, running on **[Bun](https://bun.sh)**, with Socket.IO for signalling and WebRTC for the video.

## Run it

Requires [Bun](https://bun.sh) 1.3+ (`curl -fsSL https://bun.sh/install | bash`).

```bash
bun install
bun run dev                    # development with hot reload → http://localhost:3000
bun run build && bun start     # production                  (PORT=xxxx to change)
```

Open the page and click **Create a room**. The next screen shows the room ID, password and invite link, each with a copy button; **Copy invite** copies all three as one message. The link already contains the password.

### Keyboard shortcuts (in a call)

| Key | Action |
| --- | --- |
| `M` | Mute / unmute |
| `V` | Camera on / off |
| `S` | Start / stop sharing |
| `L` | Cycle layout |
| `H` | Hide / show faces (while sharing) |
| `F` | Fullscreen |
| `C` | Chat |

## How to share a movie with sound

1. Open the movie in **another Chrome/Edge tab**.
2. Click **Share movie** → choose the **Chrome Tab** option → pick the movie tab → keep **"Also share tab audio"** switched on.
3. Watch it from inside Watch Together. You'll see the movie with both faces, the same as she does.

> **Wear headphones** (at least the person who isn't sharing). Otherwise the movie coming out of her speakers goes back into her mic and you hear it twice.

> Some streaming sites (Netflix, Prime, Disney+) block screen capture with DRM, so they show up as a black screen. Turning off *hardware acceleration* in Chrome sometimes helps; local video files and most other sites work fine.

## Using it over the internet

Browsers only allow camera and screen sharing on **https** (or `localhost`), so for her to join from her own home you need to put this online:

- **Quickest (from your laptop)**: `bun start`, then in another terminal run
  `bunx cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`) and send her the `https://…` link.
- **Always on**: deploy to any Node host that supports long-running servers and WebSockets (Render, Railway, Fly.io, a small VPS). Install Bun on the host (or use the `oven/bun` Docker image); build command `bun install && bun run build`, start command `bun start`.
  **Vercel won't work**: its serverless functions can't keep the WebSocket connections that the custom server needs.

### If it gets stuck on "Connecting…"

The free STUN servers work for most home Wi-Fi, but some mobile or office networks need a **TURN** relay. Get one (e.g. Metered, Twilio, or your own `coturn`) and start the server with:

```bash
ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your.turn.host:3478","username":"user","credential":"pass"}]' bun start
```

## Notes

- Rooms live in memory: they disappear if the server restarts, and empty rooms are removed after 24 hours.
- Passwords are stored hashed (scrypt). Wrong-password attempts are rate-limited per IP.
- In the invite link the password sits after `#`, which the browser never sends to the server, and the page removes it from the address bar after reading it.

## Project layout

```
server.ts                       Custom server: Next.js + Socket.IO on one port (run directly by Bun)
lib/rooms.ts                    In-memory rooms, password hashing, rate limiting, ICE config
lib/signalling.ts               Socket.IO handlers: join/leave, relay WebRTC signals, chat, reactions
lib/protocol.ts                 Socket event types shared by server and browser
lib/call-client.ts              Browser engine: media, screen share, WebRTC perfect negotiation
lib/toast.ts                    Tiny toast store
app/page.tsx                    Home (create / join)
app/api/rooms/route.ts          POST endpoint that creates a room
app/room/[id]/page.tsx          Room page (checks the room exists, passes ICE servers)
components/HomeForms.tsx        Create / join forms
components/room/Room.tsx        Lobby → call → left; fullscreen, shortcuts, preferences
components/room/Stage.tsx       The four layouts + draggable/resizable floating tiles
components/room/Controls.tsx    Bottom bar: room ID, status, mic, camera, share, reactions, leave, invite, chat, fullscreen
components/room/ScreenMenu.tsx  Floating screen-share menu: layouts, faces, volume, fullscreen, stop sharing
components/Icon.tsx             Line icon set
components/room/…               Lobby, ChatPanel, InviteDialog, ShareDetails, VideoView
app/globals.css                 Theme and layout CSS
```

Why a custom server? Next.js route handlers can't hold WebSocket connections, so `server.ts` runs Socket.IO on the same HTTP server as Next. The room store sits on `globalThis` so the Socket.IO code and the Next.js server code (pages, route handlers) share it.
