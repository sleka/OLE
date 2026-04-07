import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query') || 'up'

  const url = `${process.env.PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'CF-Access-Client-Id': process.env.CF_ACCESS_CLIENT_ID ?? '',
        'CF-Access-Client-Secret': process.env.CF_ACCESS_CLIENT_SECRET ?? '',
      },
    })
    const data = await response.json()
    return NextResponse.json(data.data.result)
  } catch (error) {
    return NextResponse.json({ error: 'Prometheus unreachable' }, { status: 500 })
  }
}
