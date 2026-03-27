'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProbeResult } from '@/lib/types'
import { BarChart3 } from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface HistoryChartProps {
  results: ProbeResult[]
}

const statusToValue: Record<string, number> = {
  UP_HEALTHY: 4,
  UP_DEGRADED: 3,
  DOWN_CONTENT: 2,
  DOWN_PLATFORM: 1,
}

const valueToStatus: Record<number, string> = {
  4: 'Healthy',
  3: 'Degraded',
  2: 'Content Down',
  1: 'Platform Down',
}

const statusColors: Record<string, string> = {
  UP_HEALTHY: '#10b981',
  UP_DEGRADED: '#f59e0b',
  DOWN_CONTENT: '#ef4444',
  DOWN_PLATFORM: '#ef4444',
}

export function HistoryChart({ results }: HistoryChartProps) {
  const data = [...results]
    .reverse()
    .slice(-50)
    .map((r) => ({
      time: new Date(r.checked_at_epoch * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value: statusToValue[r.status] || 0,
      status: r.status,
      fps: r.content.video?.fps || 0,
      bytesReceived: r.platform.srt_bytes_received || 0,
    }))

  const latestStatus = results[0]?.status || 'UP_HEALTHY'

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Status History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No historical data</p>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="statusGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={statusColors[latestStatus]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={statusColors[latestStatus]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[1, 2, 3, 4]}
                  tickFormatter={(v) => valueToStatus[v] || ''}
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                  labelStyle={{ color: '#71717a' }}
                  formatter={(value: number) => [valueToStatus[value], 'Status']}
                />
                <Area
                  type="stepAfter"
                  dataKey="value"
                  stroke={statusColors[latestStatus]}
                  strokeWidth={2}
                  fill="url(#statusGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
