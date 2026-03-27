-- Probe results table for storing historical probe data
CREATE TABLE IF NOT EXISTS probe_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('UP_HEALTHY', 'UP_DEGRADED', 'DOWN_CONTENT', 'DOWN_PLATFORM')),
  summary TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Platform metrics
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  api_ok BOOLEAN DEFAULT FALSE,
  metrics_ok BOOLEAN DEFAULT FALSE,
  srt_publish_connected BOOLEAN DEFAULT FALSE,
  path_ready BOOLEAN DEFAULT FALSE,
  path_bytes_received BIGINT,
  path_bytes_sent BIGINT,
  path_readers INTEGER,
  srt_packets_received BIGINT,
  srt_bytes_received BIGINT,
  
  -- Content metrics
  ffprobe_ok BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  has_audio BOOLEAN DEFAULT FALSE,
  video_codec TEXT,
  video_width INTEGER,
  video_height INTEGER,
  video_fps NUMERIC(6,2),
  audio_codec TEXT,
  audio_sample_rate INTEGER,
  audio_channels INTEGER,
  
  -- Issues
  issues JSONB DEFAULT '[]'::JSONB,
  
  -- Full payload for debugging
  raw_payload JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by host/path and time range
CREATE INDEX IF NOT EXISTS idx_probe_results_host_path ON probe_results(host, path);
CREATE INDEX IF NOT EXISTS idx_probe_results_checked_at ON probe_results(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_probe_results_status ON probe_results(status);

-- Alerts table for storing alerts/notifications
CREATE TABLE IF NOT EXISTS probe_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_result_id UUID REFERENCES probe_results(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_probe_alerts_severity ON probe_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_probe_alerts_acknowledged ON probe_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_probe_alerts_created_at ON probe_alerts(created_at DESC);

-- Stream configurations table
CREATE TABLE IF NOT EXISTS stream_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  api_port INTEGER DEFAULT 9997,
  metrics_port INTEGER DEFAULT 9998,
  rtsp_port INTEGER DEFAULT 8554,
  expected_video_codec TEXT DEFAULT 'h264',
  expected_audio_codec TEXT DEFAULT 'aac',
  expected_width INTEGER DEFAULT 1280,
  expected_height INTEGER DEFAULT 720,
  expected_fps NUMERIC(5,2) DEFAULT 30.0,
  expected_audio_sample_rate INTEGER DEFAULT 48000,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(host, path)
);

CREATE INDEX IF NOT EXISTS idx_stream_configs_enabled ON stream_configs(enabled);
