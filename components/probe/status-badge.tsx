'use client'

import { cn } from '@/lib/utils'
import type { ProbeStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: ProbeStatus
  size?: 'sm' | 'md' | 'lg'
  showPulse?: boolean
}

const statusConfig: Record<ProbeStatus, { label: string; className: string }> = {
  UP_HEALTHY: {
    label: 'Healthy',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  UP_DEGRADED: {
    label: 'Degraded',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  DOWN_CONTENT: {
    label: 'Content Down',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  DOWN_PLATFORM: {
    label: 'Platform Down',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
}

export function StatusBadge({ status, size = 'md', showPulse = true }: StatusBadgeProps) {
  const config = statusConfig[status]
  const isHealthy = status === 'UP_HEALTHY'
  const isDown = status === 'DOWN_CONTENT' || status === 'DOWN_PLATFORM'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border font-medium',
        config.className,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base'
      )}
    >
      {showPulse && (
        <span className="relative flex h-2 w-2">
          {(isHealthy || isDown) && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                isHealthy ? 'bg-emerald-400' : 'bg-red-400'
              )}
            />
          )}
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              isHealthy ? 'bg-emerald-400' : isDown ? 'bg-red-400' : 'bg-amber-400'
            )}
          />
        </span>
      )}
      {config.label}
    </span>
  )
}
