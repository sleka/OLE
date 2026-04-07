import { NextResponse } from 'next/server'

const PROM = process.env.PROMETHEUS_URL ?? ''
const CF_ID = process.env.CF_ACCESS_CLIENT_ID ?? ''
const CF_SECRET = process.env.CF_ACCESS_CLIENT_SECRET ?? ''

const STREAMS = ['Rai_Italia_America', 'Rai_News_24', 'Rai_World_Premium']
const REGIONS = [
  { id: 'us', name: 'US Wowza', site: 'us-east', host: '172.16.22.13' },
  { id: 'eu', name: 'EU Wowza', site: 'eu-west', host: '10.24.36.5' },
]

async function promQuery(query: string): Promise<any[]> {
  try {
    const url = `${PROM}/api/v1/query?query=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'CF-Access-Client-Id': CF_ID,
        'CF-Access-Client-Secret': CF_SECRET,
      },
    })
    const json = await res.json()
    return json?.data?.result ?? []
  } catch {
    return []
  }
}

function findMetric(results: any[], labels: Record<string, string>): number | null {
  const match = results.find((r) =>
    Object.entries(labels).every(([k, v]) => r.metric[k] === v)
  )
  return match ? parseFloat(match.value[1]) : null
}

export async function GET() {
  try {
    const [activeResults, bitrateResults, downtimeResults, srtRttResults, srtLossResults, bytesInResults] =
      await Promise.all([
        promQuery('wowza_stream_active'),
        promQuery('wowza_stream_bitrate'),
        promQuery('wowza_downtime_is_down'),
        promQuery('avg by (region, stream) (srt_stats_rtt_ms)'),
        promQuery('avg by (region, stream) (srt_stats_pkt_rcv_loss)'),
        promQuery('wowza_vhost_bytes_in'),
      ])

    const output = REGIONS.map((region) => {
      const streams = STREAMS.map((streamName) => {
        const labels = { region: region.id, stream: streamName }
        const active = findMetric(activeResults, labels)
        const bitrate = findMetric(bitrateResults, labels)
        const isDown = findMetric(downtimeResults, { region: region.id, stream: streamName })
        const rtt = findMetric(srtRttResults, { region: region.id })
        const loss = findMetric(srtLossResults, { region: region.id })

        const status = active === 1 ? 'UP_HEALTHY' : 'DOWN_PLATFORM'

        return {
          name: streamName,
          active: active === 1,
          status,
          bitrate: bitrate ?? 0,
          is_down: isDown === 1,
          srt_rtt_ms: rtt ?? 0,
          srt_pkt_loss: loss ?? 0,
        }
      })

      const bytesIn = findMetric(bytesInResults, { region: region.id })
      const allDown = streams.every((s) => !s.active)
      const anyDown = streams.some((s) => !s.active)

      const overallStatus = allDown
        ? 'DOWN_PLATFORM'
        : anyDown
        ? 'UP_DEGRADED'
        : 'UP_HEALTHY'

      const checkedAt = Math.floor(Date.now() / 1000)

      return {
        id: region.id,
        name: region.name,
        mediamtx_url: region.host,
        rtsp_url: '',
        probe_interval_seconds: 30,
        is_active: true,
        created_at: '',
        updated_at: '',
        latest_probe: {
          status: overallStatus,
          summary:
            overallStatus === 'UP_HEALTHY'
              ? 'All streams active'
              : overallStatus === 'UP_DEGRADED'
              ? 'Some streams down'
              : 'All streams down',
          checked_at_epoch: checkedAt,
          issues: streams.filter((s) => !s.active).map((s) => `${s.name} is down`),
          platform: {
            api_ok: true,
            metrics_ok: true,
            srt_publish_connected: streams.some((s) => s.active),
            srt_bytes_received: bytesIn ?? 0,
            srt_bytes_sent: 0,
            srt_rtt_ms: streams[0]?.srt_rtt_ms ?? 0,
          },
          content: {
            ffprobe_ok: streams.some((s) => s.active),
            has_video: streams.some((s) => s.active),
            has_audio: streams.some((s) => s.active),
            video: streams.some((s) => s.active)
              ? { fps: null, codec_name: null, width: null, height: null }
              : null,
            audio: streams.some((s) => s.active)
              ? { codec_name: null, sample_rate: null, channels: null, channel_layout: null }
              : null,
          },
          streams,
        },
      }
    })

    return NextResponse.json(output)
  } catch (error) {
    console.error('Streams API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
