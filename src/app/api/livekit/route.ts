import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';

// LiveKit configuration
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { roomName, participantName, participantId } = body;

    // Validate required fields
    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'roomName و participantName مطلوبان' },
        { status: 400 }
      );
    }

    // Check LiveKit configuration
    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error('[LiveKit] Missing configuration:', {
        hasUrl: !!LIVEKIT_URL,
        hasKey: !!LIVEKIT_API_KEY,
        hasSecret: !!LIVEKIT_API_SECRET,
      });
      return NextResponse.json(
        { error: 'LiveKit مش مُعد بشكل صحيح' },
        { status: 500 }
      );
    }

    // Create access token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantId || participantName,
      name: participantName,
    });

    // Grant permissions to the room
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    // Generate JWT token
    const jwt = await token.toJwt();

    console.log(`[LiveKit] ✅ Token created for ${participantName} in room ${roomName}`);

    return NextResponse.json({
      token: jwt,
      url: LIVEKIT_URL,
      roomName,
    });
  } catch (error) {
    console.error('[LiveKit] Error creating token:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في إنشاء رمز الوصول' },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  const isConfigured = !!(LIVEKIT_URL && LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
  
  return NextResponse.json({
    configured: isConfigured,
    url: LIVEKIT_URL || 'غير مُعد',
    message: isConfigured 
      ? 'LiveKit جاهز للاستخدام' 
      : 'LiveKit يحتاج إعداد. أضف LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET في .env',
  });
}
