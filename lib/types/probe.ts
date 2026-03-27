export type ProbeStatus = 'UP_HEALTHY' | 'UP_DEGRADED' | 'DOWN_CONTENT' | 'DOWN_PLATFORM';

export interface PlatformMetrics {
  api_reachable: boolean;
  prometheus_reachable: boolean;
  srt_connections: number;
  bytes_received: number;
  bytes_sent: number;
}

export interface ContentMetrics {
  video_codec: string | null;
  audio_codec: string | null;
  resolution: string | null;
  fps: number | null;
  bitrate: number | null;
}

export interface ProbeResult {
  id: string;
  stream_id: string;
  status: ProbeStatus;
  summary: string;
  platform_metrics: PlatformMetrics;
  content_metrics: ContentMetrics;
  probe_duration_ms: number;
  created_at: string;
}

export interface StreamConfig {
  id: string;
  name: string;
  mediamtx_url: string;
  rtsp_url: string;
  is_active: boolean;
  probe_interval_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface ProbeAlert {
  id: string;
  stream_id: string;
  probe_result_id: string;
  alert_type: 'status_change' | 'degraded' | 'platform_down' | 'content_down';
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface StreamWithLatestProbe extends StreamConfig {
  latest_probe?: ProbeResult;
}
