import { DashboardClient } from '@/components/probe/dashboard-client'
import { createClient } from '@/lib/supabase/server'
import type { StreamWithProbe, ProbeAlert } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getDashboardData(): Promise<{
  streams: StreamWithProbe[]
  alerts: ProbeAlert[]
}> {
  try {
    const supabase = await createClient()

    const { data: streamConfigs } = await supabase
      .from('stream_configs')
      .select('*')
      .eq('is_active', true)
      .order('name')

    const streamsWithProbes: StreamWithProbe[] = await Promise.all(
      (streamConfigs || []).map(async (stream) => {
        const { data: latestProbe } = await supabase
          .from('probe_results')
          .select('*')
          .eq('stream_id', stream.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return { ...stream, latest_probe: latestProbe || null }
      })
    )

    const { data: alerts } = await supabase
      .from('probe_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    return {
      streams: streamsWithProbes,
      alerts: (alerts || []) as ProbeAlert[],
    }
  } catch {
    return { streams: [], alerts: [] }
  }
}

export default async function HomePage() {
  const { streams, alerts } = await getDashboardData()

  return (
    <DashboardClient
      initialStreams={streams}
      initialAlerts={alerts}
    />
  )
}