'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProbeResult } from '@/lib/types'
import { Activity } from 'lucide-react'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface MetricsChartProps {
  results: ProbeResult[]
  metric: 'fps' | 'bytes'
  title: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function MetricsChart({ results, metric, title }: MetricsChartProps) {
  const data = [...results]
    .reverse()
    .slice(-50)
    .map((r) => ({
      time: new Date(r.checked_at_epoch * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      value:
        metric === 'fps'
          ? r.content.video?.fps || 0
          : r.platform.srt_bytes_received || 0,
    }))

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No data available</p>
          </div>
        ) : (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis
                  dataKey="time"
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 10 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  tickFormatter={(v) => (metric === 'bytes' ? formatBytes(v) : v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                  labelStyle={{ color: '#71717a' }}
                  formatter={(value: number) => [
                    metric === 'bytes' ? formatBytes(value) : `${value.toFixed(1)} fps`,
                    metric === 'fps' ? 'FPS' : 'Bytes Received',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
