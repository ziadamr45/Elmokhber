// Utility functions for sending real-time notifications via WebSocket service

const SOCIAL_SERVICE_URL = 'http://localhost:3010';

interface FriendRequestNotification {
  requestId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
}

interface FriendAcceptedNotification {
  friendId: string;
  friendName: string;
  accepterId: string;
  accepterName: string;
}

interface MessageNotification {
  messageId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
}

interface RoomMessageNotification {
  messageId: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  content: string;
  gameType: string;
}

interface RoomInviteNotification {
  inviteId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  roomCode: string;
  gameType: string;
}

/**
 * Notify the WebSocket service about a new friend request
 * This will send a real-time notification to the receiver
 */
export async function notifyFriendRequest(data: FriendRequestNotification): Promise<boolean> {
  try {
    const response = await fetch(`${SOCIAL_SERVICE_URL}/notify/friend-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('[SocialNotify] Failed to send friend request notification:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('[SocialNotify] Friend request notification sent:', result);
    return result.delivered;
  } catch (error) {
    console.error('[SocialNotify] Error sending friend request notification:', error);
    return false;
  }
}

/**
 * Notify the WebSocket service that a friend request was accepted
 * This will send a real-time notification to the original sender
 */
export async function notifyFriendAccepted(data: FriendAcceptedNotification): Promise<boolean> {
  try {
    const response = await fetch(`${SOCIAL_SERVICE_URL}/notify/friend-accepted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('[SocialNotify] Failed to send friend accepted notification:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('[SocialNotify] Friend accepted notification sent:', result);
    return result.delivered;
  } catch (error) {
    console.error('[SocialNotify] Error sending friend accepted notification:', error);
    return false;
  }
}

/**
 * Notify the WebSocket service about a new private message
 */
export async function notifyMessage(data: MessageNotification): Promise<boolean> {
  try {
    const response = await fetch(`${SOCIAL_SERVICE_URL}/notify/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('[SocialNotify] Failed to send message notification:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('[SocialNotify] Message notification sent:', result);
    return result.delivered;
  } catch (error) {
    console.error('[SocialNotify] Error sending message notification:', error);
    return false;
  }
}

/**
 * Notify the WebSocket service about a new room message
 */
export async function notifyRoomMessage(data: RoomMessageNotification): Promise<boolean> {
  try {
    const response = await fetch(`${SOCIAL_SERVICE_URL}/notify/room-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('[SocialNotify] Failed to send room message notification:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('[SocialNotify] Room message notification sent:', result);
    return result.success;
  } catch (error) {
    console.error('[SocialNotify] Error sending room message notification:', error);
    return false;
  }
}

/**
 * Notify the WebSocket service about a room invite
 */
export async function notifyRoomInvite(data: RoomInviteNotification): Promise<boolean> {
  try {
    const response = await fetch(`${SOCIAL_SERVICE_URL}/notify/room-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('[SocialNotify] Failed to send room invite notification:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('[SocialNotify] Room invite notification sent:', result);
    return result.delivered;
  } catch (error) {
    console.error('[SocialNotify] Error sending room invite notification:', error);
    return false;
  }
}
