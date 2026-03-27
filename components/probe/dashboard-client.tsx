'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { StreamCard } from './stream-card'
import { AlertsList } from './alerts-list'
import { HistoryChart } from './history-chart'
import { MetricsChart } from './metrics-chart'
import { StatusBadge } from './status-badge'
import type { ProbeResult, ProbeAlert } from '@/lib/types'
import { Activity, RefreshCw, Server, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DashboardClientProps {
  initialResults: ProbeResult[]
  initialAlerts: ProbeAlert[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function DashboardClient({ initialResults, initialAlerts }: DashboardClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingDemo, setIsLoadingDemo] = useState(false)

  const { data: results, mutate: mutateResults } = useSWR<ProbeResult[]>(
    '/api/probe',
    fetcher,
    {
      fallbackData: initialResults,
      refreshInterval: 10000, // Auto-refresh every 10 seconds
    }
  )

  const { data: alerts, mutate: mutateAlerts } = useSWR<ProbeAlert[]>(
    '/api/alerts',
    fetcher,
    {
      fallbackData: initialAlerts,
      refreshInterval: 10000,
    }
  )

  const latestResult = results?.[0]

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([mutateResults(), mutateAlerts()])
    setIsRefreshing(false)
  }

  const handleAcknowledge = async (id: string) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, acknowledged: true }),
    })
    mutateAlerts()
  }

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true)
    await fetch('/api/demo', { method: 'POST' })
    await Promise.all([mutateResults(), mutateAlerts()])
    setIsLoadingDemo(false)
  }

  // Calculate stats
  const stats = {
    total: results?.length || 0,
    healthy: results?.filter((r) => r.status === 'UP_HEALTHY').length || 0,
    degraded: results?.filter((r) => r.status === 'UP_DEGRADED').length || 0,
    down:
      results?.filter(
        (r) => r.status === 'DOWN_CONTENT' || r.status === 'DOWN_PLATFORM'
      ).length || 0,
  }

  const unacknowledgedAlerts = alerts?.filter((a) => !a.acknowledged).length || 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Server className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">OLE NOC</h1>
                <p className="text-sm text-muted-foreground">Stream Monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {latestResult && <StatusBadge status={latestResult.status} size="lg" />}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-border/30 bg-card/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-6 text-sm">
            <StatItem
              icon={<Activity className="h-4 w-4" />}
              label="Total Checks"
              value={stats.total}
            />
            <StatItem
              label="Healthy"
              value={stats.healthy}
              color="text-emerald-400"
            />
            <StatItem
              label="Degraded"
              value={stats.degraded}
              color="text-amber-400"
            />
            <StatItem label="Down" value={stats.down} color="text-red-400" />
            {unacknowledgedAlerts > 0 && (
              <div className="ml-auto flex items-center gap-2 text-red-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
                </span>
                {unacknowledgedAlerts} Active Alerts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Current Status & Chart */}
          <div className="lg:col-span-2 space-y-6">
            {latestResult ? (
              <StreamCard result={latestResult} streamName="Primary Stream" />
            ) : (
              <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-center">
                <Server className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No Probe Data
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start sending probe results from your EC2 instance to see data here.
                </p>
                <code className="block text-xs bg-secondary/50 rounded-lg p-4 text-left overflow-x-auto">
                  {`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/probe \\
  -H "Content-Type: application/json" \\
  -d @probe_result.json`}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadDemo}
                  disabled={isLoadingDemo}
                  className="mt-4"
                >
                  <Sparkles className={`h-4 w-4 mr-2 ${isLoadingDemo ? 'animate-pulse' : ''}`} />
                  {isLoadingDemo ? 'Loading...' : 'Load Demo Data'}
                </Button>
              </div>
            )}

            <HistoryChart results={results || []} />

            {/* Metrics Charts */}
            <div className="grid gap-6 sm:grid-cols-2">
              <MetricsChart
                results={results || []}
                metric="fps"
                title="Video FPS"
              />
              <MetricsChart
                results={results || []}
                metric="bytes"
                title="Bytes Received"
              />
            </div>
          </div>

          {/* Right Column - Alerts */}
          <div className="space-y-6">
            <AlertsList alerts={alerts || []} onAcknowledge={handleAcknowledge} />
          </div>
        </div>
      </main>
    </div>
  )
}

interface StatItemProps {
  icon?: React.ReactNode
  label: string
  value: number
  color?: string
}

function StatItem({ icon, label, value, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground">{label}:</span>
      <span className={`font-semibold ${color || 'text-foreground'}`}>{value}</span>
    </div>
  )
}
