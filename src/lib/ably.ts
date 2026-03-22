import Ably from 'ably';

declare global {
  var ably: Ably.Realtime | undefined;
}

// Event names
export const ABLY_EVENTS = {
  ROOM_MESSAGE: 'room-message',
  USER_JOINED: 'user-joined-room',
  USER_LEFT: 'user-left-room',
  USER_MESSAGE: 'user-message',
  NOTIFICATION: 'notification',
} as const;

// Channel names
export const getRoomChannel = (roomCode: string) => `room:${roomCode}`;
export const getUserChannel = (userId: string) => `user:${userId}`;

// Lazy Ably client - only initialized when needed
let _ablyClient: Ably.Realtime | null = null;

function getAblyClient(): Ably.Realtime | null {
  if (_ablyClient) return _ablyClient;
  
  const key = process.env.ABLY_API_KEY;
  
  if (!key) {
    console.log('[Ably] ABLY_API_KEY not set - realtime features disabled');
    return null;
  }
  
  try {
    if (typeof global !== 'undefined' && global.ably) {
      _ablyClient = global.ably;
    } else {
      _ablyClient = new Ably.Realtime({ key });
      if (typeof global !== 'undefined') {
        global.ably = _ablyClient;
      }
    }
    return _ablyClient;
  } catch (error) {
    console.error('[Ably] Failed to initialize:', error);
    return null;
  }
}

// Publish helper - safe to call even without Ably
export async function publishToRoom(roomCode: string, event: string, data: unknown) {
  const client = getAblyClient();
  
  if (!client) {
    console.log(`[Ably] Skipping publish to room ${roomCode} - not initialized`);
    return;
  }
  
  try {
    const channel = client.channels.get(getRoomChannel(roomCode));
    await channel.publish(event, data);
    console.log(`[Ably] Published to room ${roomCode}: ${event}`);
  } catch (error) {
    console.error(`[Ably] Failed to publish to room ${roomCode}:`, error);
  }
}

// Publish to user channel
export async function publishToUser(userId: string, event: string, data: unknown) {
  const client = getAblyClient();
  
  if (!client) {
    console.log(`[Ably] Skipping publish to user ${userId} - not initialized`);
    return;
  }
  
  try {
    const channel = client.channels.get(getUserChannel(userId));
    await channel.publish(event, data);
    console.log(`[Ably] Published to user ${userId}: ${event}`);
  } catch (error) {
    console.error(`[Ably] Failed to publish to user ${userId}:`, error);
  }
}

// Export a dummy ably object to avoid breaking imports
export const ably = {
  get channels() {
    return getAblyClient()?.channels;
  },
  get connection() {
    return getAblyClient()?.connection;
  },
};
