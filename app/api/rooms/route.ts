import { createRoom } from '@/lib/rooms';

// A plain route handler rather than a Server Action: Server Actions reject requests whose
// Origin doesn't match Host, which is exactly what tunnels like cloudflared/ngrok produce.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const result = createRoom(typeof body.password === 'string' ? body.password : '');
  if ('error' in result) return Response.json(result, { status: 400 });
  return Response.json(result);
}
