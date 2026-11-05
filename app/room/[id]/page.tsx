import type { Metadata } from 'next';
import { Room } from '@/components/room/Room';
import { getIceServers, getRoomStatus } from '@/lib/rooms';

// Room state lives in server memory, so this page must never be cached.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Watch Together · Room' };

export default async function RoomPage({ params }: PageProps<'/room/[id]'>) {
  const { id } = await params;
  const roomId = decodeURIComponent(id);
  return <Room roomId={roomId} roomExists={getRoomStatus(roomId).exists} iceServers={getIceServers()} />;
}
