import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const statuses = ['UP_HEALTHY', 'UP_HEALTHY', 'UP_HEALTHY', 'UP_DEGRADED', 'DOWN_CONTENT'] as const

function generateMockResult(timestamp: number) {
  const status = statuses[Math.floor(Math.random() * statuses.length)]
  const fps = 29 + Math.random() * 2
  const bytesReceived = Math.floor(Math.random() * 1000000000)

  return {
    status,
    summary: status === 'UP_HEALTHY' 
      ? 'Platform healthy and media validated'
      : status === 'UP_DEGRADED'
      ? 'Platform healthy but media quality/profile degraded'
      : 'Path/platform alive but usable media is not valid',
    checked_at_epoch: timestamp,
    platform: {
      api_ok: true,
      metrics_ok: true,
      path_api_url: 'http://mediamtx:9997/v3/paths/get/live',
      metrics_url: 'http://mediamtx:9998/metrics',
      metrics_sample_count: 150,
      path_ready_metric: 1,
      path_bytes_received: bytesReceived,
      path_bytes_sent: Math.floor(bytesReceived * 0.8),
      path_readers: Math.floor(Math.random() * 10),
      srt_publish_connected: status !== 'DOWN_CONTENT',
      srt_packets_received: Math.floor(Math.random() * 100000),
      srt_packets_sent: Math.floor(Math.random() * 50000),
      srt_bytes_received: bytesReceived,
      srt_bytes_sent: Math.floor(bytesReceived * 0.5),
    },
    content: {
      ffprobe_ok: status !== 'DOWN_CONTENT',
      ffprobe_url: 'rtsp://mediamtx:8554/live',
      has_video: true,
      has_audio: true,
      format: {
        format_name: 'rtsp',
        format_long_name: 'RTSP input',
        nb_streams: 2,
        probe_score: 100,
      },
      video: {
        codec_name: 'h264',
        profile: 'High',
        width: 1280,
        height: 720,
        pix_fmt: 'yuv420p',
        fps: fps,
        avg_frame_rate: `${Math.round(fps * 1000)}/1000`,
        level: 31,
      },
      audio: {
        codec_name: 'aac',
        profile: 'LC',
        sample_rate: 48000,
        channels: 2,
        channel_layout: 'stereo',
      },
    },
    issues: status === 'UP_HEALTHY' ? [] : status === 'UP_DEGRADED' 
      ? ['Low FPS: 27.50 < 27.00'] 
      : ['ffprobe error: Connection refused'],
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const now = Date.now() / 1000
    
    // Generate 20 historical results
    const results = []
    for (let i = 19; i >= 0; i--) {
      const timestamp = now - (i * 60) // One result per minute
      results.push(generateMockResult(timestamp))
    }

    // Insert all results
    const { error } = await supabase
      .from('probe_results')
      .insert(results)

    if (error) {
      console.error('Error inserting demo data:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Add some demo alerts
    await supabase.from('probe_alerts').insert([
      {
        stream_id: 'demo',
        alert_type: 'status_change',
        severity: 'warning',
        message: 'Status changed from UP_HEALTHY to UP_DEGRADED: Low FPS detected',
        acknowledged: false,
      },
      {
        stream_id: 'demo',
        alert_type: 'threshold_exceeded',
        severity: 'info',
        message: 'FPS dropped below 29 fps threshold',
        acknowledged: true,
      },
    ])

    return NextResponse.json({ success: true, count: results.length })
  } catch (err) {
    console.error('Demo API error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
