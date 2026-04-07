export type ProbeStatus = 'UP_HEALTHY' | 'UP_DEGRADED' | 'DOWN_CONTENT' | 'DOWN_PLATFORM'

export interface ProbeResult {
  id?: string
  stream_id?: string
  status: ProbeStatus
  summary: string
  checked_at_epoch: number
  platform: PlatformMetrics
  content: ContentMetrics
  issues: string[]
  created_at?: string
}

export interface PlatformMetrics {
  api_ok: boolean
  metrics_ok: boolean
  path_api_url?: string
  metrics_url?: string
  api_error?: string
  metrics_error?: string
  api_response?: Record<string, unknown>
  metrics_sample_count?: number
  path_ready_metric?: number
  path_bytes_received?: number
  path_bytes_sent?: number
  path_readers?: number
  hls_muxers?: number
  srt_publish_connected?: boolean
  srt_publish_labels?: Record<string, string>
  srt_packets_received?: number
  srt_packets_sent?: number
  srt_bytes_received?: number
  srt_bytes_sent?: number
  api_path_source_ready?: boolean
  api_path_ready?: boolean
  api_has_source?: boolean
  api_readers?: number
}

export interface ContentMetrics {
  ffprobe_ok: boolean
  ffprobe_url?: string
  ffprobe_error?: string
  ffprobe_stderr?: string
  has_video?: boolean
  has_audio?: boolean
  format?: {
    format_name?: string
    format_long_name?: string
    start_time?: string
    bit_rate?: string
    nb_streams?: number
    probe_score?: number
  }
  video?: {
    codec_name?: string
    profile?: string
    width?: number
    height?: number
    pix_fmt?: string
    fps?: number
    avg_frame_rate?: string
    r_frame_rate?: string
    level?: number
  } | null
  audio?: {
    codec_name?: string
    profile?: string
    sample_rate?: number
    channels?: number
    channel_layout?: string
  } | null
  ffprobe_warning_count?: number
  ffprobe_warning_lines?: string[]
}

export interface StreamConfig {
  id: string
  name: string
  mediamtx_url: string
  rtsp_url: string
  probe_interval_seconds: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StreamWithProbe extends StreamConfig {
  latest_probe: ProbeResult | null
}

export interface ProbeAlert {
  id: string
  stream_id: string
  probe_result_id?: string
  alert_type: 'status_change' | 'threshold_exceeded' | 'stream_down'
  severity: 'info' | 'warning' | 'critical'
  message: string
  acknowledged: boolean
  acknowledged_at?: string
  created_at: string
}