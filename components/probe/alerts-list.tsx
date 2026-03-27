'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProbeAlert } from '@/lib/types'
import { AlertTriangle, AlertCircle, Info, Check, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertsListProps {
  alerts: ProbeAlert[]
  onAcknowledge?: (id: string) => void
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    className: 'text-red-400 bg-red-500/10 border-red-500/20',
    iconClass: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    className: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    iconClass: 'text-amber-400',
  },
  info: {
    icon: Info,
    className: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    iconClass: 'text-blue-400',
  },
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleString()
}

export function AlertsList({ alerts, onAcknowledge }: AlertsListProps) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged)

  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alerts
          </CardTitle>
          {unacknowledged.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
              {unacknowledged.length}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map((alert) => {
              const config = severityConfig[alert.severity]
              const Icon = config.icon
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'rounded-lg border p-3 transition-opacity',
                    config.className,
                    alert.acknowledged && 'opacity-50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', config.iconClass)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(alert.created_at)}
                      </p>
                    </div>
                    {!alert.acknowledged && onAcknowledge && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAcknowledge(alert.id)}
                        className="shrink-0"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
