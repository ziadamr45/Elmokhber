import { NextResponse } from 'next/server';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    hasDbUrl: !!dbUrl,
    dbUrlStart: dbUrl ? dbUrl.substring(0, 30) + '...' : 'not set',
    nodeEnv: process.env.NODE_ENV
  });
}
