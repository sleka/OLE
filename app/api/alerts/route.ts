import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const acknowledged = searchParams.get('acknowledged')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('probe_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (acknowledged !== null) {
      query = query.eq('acknowledged', acknowledged === 'true')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Alerts GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, acknowledged } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Missing alert id' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('probe_alerts')
      .update({
        acknowledged,
        acknowledged_at: acknowledged ? new Date().toISOString() : null,
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Alerts PATCH error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
