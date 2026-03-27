import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/probe/dashboard-client'
import type { ProbeResult, ProbeAlert } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = await createClient()

  // Fetch latest probe results
  const { data: results } = await supabase
    .from('probe_results')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch active alerts
  const { data: alerts } = await supabase
    .from('probe_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <DashboardClient
      initialResults={(results as ProbeResult[]) || []}
      initialAlerts={(alerts as ProbeAlert[]) || []}
    />
  )
}
