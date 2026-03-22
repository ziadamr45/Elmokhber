import { NextRequest, NextResponse } from 'next/server';

// Socket.io polling proxy to game-rooms server
// This bypasses Caddy gateway issues with trailing slashes and query parameters

const GAME_ROOMS_PORT = 3005;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Build target URL
  const targetUrl = `http://localhost:${GAME_ROOMS_PORT}/socket.io/?${searchParams.toString()}`;
  
  console.log('[Socket Proxy] GET:', targetUrl);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Content-Type': 'text/plain',
      },
    });
    
    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Socket Proxy] GET Error:', error);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  // Get body
  const body = await request.text();
  
  // Build target URL
  const targetUrl = `http://localhost:${GAME_ROOMS_PORT}/socket.io/?${searchParams.toString()}`;
  
  console.log('[Socket Proxy] POST:', targetUrl, 'body length:', body.length);
  
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body,
    });
    
    const data = await response.text();
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Socket Proxy] POST Error:', error);
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
