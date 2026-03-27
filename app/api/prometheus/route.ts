import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'up'; // Defaultne 'up'
  const url = `${process.env.PROMETHEUS_URL}/api/v1/query?query=${query}`;

  try {
    const response = await fetch(url, { cache: 'no-store' }); // Nechceme staré dáta
    const data = await response.json();
    return NextResponse.json(data.data.result);
  } catch (error) {
    return NextResponse.json({ error: 'VM unreachable' }, { status: 500 });
  }
}