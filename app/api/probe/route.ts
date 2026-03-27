import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ProbeResult, ProbeAlert } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json() as ProbeResult & { stream_id?: string }

    if (!body.status || !body.summary || !body.checked_at_epoch) {
      return NextResponse.json(
        { error: 'Missing required fields: status, summary, checked_at_epoch' },
        { status: 400 }
      )
    }

    // Get previous status to detect changes
    let previousStatus: string | null = null
    if (body.stream_id) {
      const { data: lastResult } = await supabase
        .from('probe_results')
        .select('status')
        .eq('stream_id', body.stream_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      previousStatus = lastResult?.status || null
    }

    // Insert probe result
    const { data: result, error } = await supabase
      .from('probe_results')
      .insert({
        stream_id: body.stream_id || null,
        status: body.status,
        summary: body.summary,
        checked_at_epoch: body.checked_at_epoch,
        platform: body.platform,
        content: body.content,
        issues: body.issues,
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting probe result:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create alert if status changed
    if (previousStatus && previousStatus !== body.status) {
      const severity = body.status === 'DOWN_PLATFORM' || body.status === 'DOWN_CONTENT'
        ? 'critical'
        : body.status === 'UP_DEGRADED'
        ? 'warning'
        : 'info'

      const alert: Partial<ProbeAlert> = {
        stream_id: body.stream_id || 'unknown',
        probe_result_id: result.id,
        alert_type: 'status_change',
        severity,
        message: `Status changed from ${previousStatus} to ${body.status}: ${body.summary}`,
        acknowledged: false,
      }

      await supabase.from('probe_alerts').insert(alert)
    }

    // Create alert if stream is down
    if (body.status === 'DOWN_PLATFORM' || body.status === 'DOWN_CONTENT') {
      const { data: existingAlert } = await supabase
        .from('probe_alerts')
        .select('id')
        .eq('stream_id', body.stream_id || 'unknown')
        .eq('alert_type', 'stream_down')
        .eq('acknowledged', false)
        .limit(1)
        .single()

      if (!existingAlert) {
        await supabase.from('probe_alerts').insert({
          stream_id: body.stream_id || 'unknown',
          probe_result_id: result.id,
          alert_type: 'stream_down',
          severity: 'critical',
          message: `Stream is down: ${body.summary}`,
          acknowledged: false,
        })
      }
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (err) {
    console.error('Probe API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get('stream_id')
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    let query = supabase
      .from('probe_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (streamId) {
      query = query.eq('stream_id', streamId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Probe GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
