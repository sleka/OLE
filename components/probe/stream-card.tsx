'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from './status-badge'
import type { ProbeResult } from '@/lib/types'
import { Activity, Tv, Volume2, Wifi, Clock } from 'lucide-react'

interface StreamCardProps {
  result: ProbeResult
  streamName?: string
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return 'N/A'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatTime(epoch: number): string {
  return new Date(epoch * 1000).toLocaleTimeString()
}

export function StreamCard({ result, streamName }: StreamCardProps) {
  const { status, summary, platform, content, checked_at_epoch, issues } = result

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              {streamName || 'Stream Monitor'}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{summary}</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricItem
            icon={<Wifi className="h-4 w-4" />}
            label="SRT"
            value={platform.srt_publish_connected ? 'Connected' : 'Disconnected'}
            status={platform.srt_publish_connected}
          />
          <MetricItem
            icon={<Activity className="h-4 w-4" />}
            label="API"
            value={platform.api_ok ? 'OK' : 'Error'}
            status={platform.api_ok}
          />
          <MetricItem
            icon={<Activity className="h-4 w-4" />}
            label="Received"
            value={formatBytes(platform.srt_bytes_received)}
          />
          <MetricItem
            icon={<Activity className="h-4 w-4" />}
            label="Sent"
            value={formatBytes(platform.srt_bytes_sent)}
          />
        </div>

        {/* Content Metrics */}
        {content.video && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricItem
              icon={<Tv className="h-4 w-4" />}
              label="Video"
              value={`${content.video.codec_name?.toUpperCase() || 'N/A'}`}
              status={content.has_video}
            />
            <MetricItem
              icon={<Tv className="h-4 w-4" />}
              label="Resolution"
              value={`${content.video.width}x${content.video.height}`}
            />
            <MetricItem
              icon={<Activity className="h-4 w-4" />}
              label="FPS"
              value={content.video.fps?.toFixed(1) || 'N/A'}
            />
            <MetricItem
              icon={<Volume2 className="h-4 w-4" />}
              label="Audio"
              value={content.audio?.codec_name?.toUpperCase() || 'None'}
              status={content.has_audio}
            />
          </div>
        )}

        {/* Issues */}
        {issues.length > 0 && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
            <h4 className="text-sm font-medium text-red-400 mb-2">Issues ({issues.length})</h4>
            <ul className="space-y-1">
              {issues.slice(0, 3).map((issue, i) => (
                <li key={i} className="text-xs text-red-300/80">
                  {issue}
                </li>
              ))}
              {issues.length > 3 && (
                <li className="text-xs text-red-300/60">+{issues.length - 3} more...</li>
              )}
            </ul>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Last checked: {formatTime(checked_at_epoch)}
        </div>
      </CardContent>
    </Card>
  )
}

interface MetricItemProps {
  icon: React.ReactNode
  label: string
  value: string
  status?: boolean
}

function MetricItem({ icon, label, value, status }: MetricItemProps) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={`text-sm font-medium ${
          status === true
            ? 'text-emerald-400'
            : status === false
            ? 'text-red-400'
            : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
