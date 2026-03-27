#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import re
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class ProbeConfig:
    host: str
    user: str
    password: str
    path: str
    api_port: int = 9997
    metrics_port: int = 9998
    rtsp_port: int = 8554
    timeout_seconds: int = 8
    expected_video_codec: str = "h264"
    expected_audio_codec: str = "aac"
    expected_width: int = 1280
    expected_height: int = 720
    expected_fps: float = 30.0
    min_fps_ratio: float = 0.9
    expected_audio_sample_rate: int = 48000
    require_audio: bool = True
    require_video: bool = True


@dataclass
class ProbeResult:
    status: str
    summary: str
    checked_at_epoch: float
    platform: Dict[str, Any]
    content: Dict[str, Any]
    issues: List[str]


def _basic_auth_header(user: str, password: str) -> Dict[str, str]:
    token = base64.b64encode(f"{user}:{password}".encode("utf-8")).decode("ascii")
    return {"Authorization": f"Basic {token}"}


def http_get_json(url: str, user: str, password: str, timeout: int) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    req = urllib.request.Request(url, headers=_basic_auth_header(user, password))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except Exception as e:
        return None, str(e)


def http_get_text(url: str, user: str, password: str, timeout: int) -> Tuple[Optional[str], Optional[str]]:
    req = urllib.request.Request(url, headers=_basic_auth_header(user, password))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8"), None
    except Exception as e:
        return None, str(e)


_METRIC_LINE = re.compile(r'^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(.+)$')
_LABELS = re.compile(r'(\w+)="([^"]*)"')


def parse_prometheus_metrics(text: str) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = _METRIC_LINE.match(line)
        if not m:
            continue
        name, label_blob, value = m.groups()
        labels: Dict[str, str] = {}
        if label_blob:
            for key, val in _LABELS.findall(label_blob):
                labels[key] = val
        try:
            numeric_value: Any = float(value)
            if numeric_value.is_integer():
                numeric_value = int(numeric_value)
        except Exception:
            numeric_value = value
        rows.append({"name": name, "labels": labels, "value": numeric_value})
    return rows


def metric_value(rows: List[Dict[str, Any]], name: str, required_labels: Optional[Dict[str, str]] = None) -> Optional[Any]:
    required_labels = required_labels or {}
    for row in rows:
        if row["name"] != name:
            continue
        labels = row["labels"]
        if all(labels.get(k) == v for k, v in required_labels.items()):
            return row["value"]
    return None


def run_ffprobe(url: str, timeout: int) -> Tuple[Optional[Dict[str, Any]], str, Optional[str]]:
    cmd = [
        "ffprobe",
        "-v", "warning",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        url,
    ]
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except Exception as e:
        return None, "", str(e)

    stderr = completed.stderr.strip()
    stdout = completed.stdout.strip()

    if completed.returncode != 0 and not stdout:
        return None, stderr, f"ffprobe exited with code {completed.returncode}"

    try:
        data = json.loads(stdout) if stdout else {}
    except Exception as e:
        return None, stderr, f"ffprobe JSON parse error: {e}"

    return data, stderr, None


def parse_fps(fps_value: Optional[str]) -> Optional[float]:
    if not fps_value or fps_value in {"0/0", "N/A"}:
        return None
    if "/" in fps_value:
        num, den = fps_value.split("/", 1)
        try:
            num_f = float(num)
            den_f = float(den)
            if den_f == 0:
                return None
            return num_f / den_f
        except Exception:
            return None
    try:
        return float(fps_value)
    except Exception:
        return None


def probe_platform(cfg: ProbeConfig) -> Tuple[Dict[str, Any], List[str]]:
    issues: List[str] = []

    path_url = f"http://{cfg.host}:{cfg.api_port}/v3/paths/get/{cfg.path}"
    path_json, path_err = http_get_json(path_url, cfg.user, cfg.password, cfg.timeout_seconds)

    metrics_url = f"http://{cfg.host}:{cfg.metrics_port}/metrics"
    metrics_text, metrics_err = http_get_text(metrics_url, cfg.user, cfg.password, cfg.timeout_seconds)

    platform: Dict[str, Any] = {
        "api_ok": path_err is None,
        "metrics_ok": metrics_err is None,
        "path_api_url": path_url,
        "metrics_url": metrics_url,
    }

    if path_err:
        issues.append(f"API error: {path_err}")
        platform["api_error"] = path_err
    else:
        platform["api_response"] = path_json

    rows: List[Dict[str, Any]] = []
    if metrics_err:
        issues.append(f"Metrics error: {metrics_err}")
        platform["metrics_error"] = metrics_err
    else:
        rows = parse_prometheus_metrics(metrics_text or "")
        platform["metrics_sample_count"] = len(rows)

    platform["path_ready_metric"] = metric_value(rows, "paths", {"name": cfg.path, "state": "ready"})
    platform["path_bytes_received"] = metric_value(rows, "paths_bytes_received", {"name": cfg.path, "state": "ready"})
    platform["path_bytes_sent"] = metric_value(rows, "paths_bytes_sent", {"name": cfg.path, "state": "ready"})
    platform["path_readers"] = metric_value(rows, "paths_readers", {"name": cfg.path, "state": "ready"})
    platform["hls_muxers"] = metric_value(rows, "hls_muxers", {"name": cfg.path})

    srt_publish_conn = None
    for row in rows:
        if row["name"] == "srt_conns" and row["labels"].get("path") == cfg.path and row["labels"].get("state") == "publish":
            srt_publish_conn = row
            break
    platform["srt_publish_connected"] = bool(srt_publish_conn)
    if srt_publish_conn:
        labels = srt_publish_conn["labels"]
        platform["srt_publish_labels"] = labels
        platform["srt_packets_received"] = metric_value(rows, "srt_conns_packets_received", labels)
        platform["srt_packets_sent"] = metric_value(rows, "srt_conns_packets_sent", labels)
        platform["srt_bytes_received"] = metric_value(rows, "srt_conns_bytes_received", labels)
        platform["srt_bytes_sent"] = metric_value(rows, "srt_conns_bytes_sent", labels)

    if isinstance(path_json, dict):
        item = path_json.get("item") or path_json
        if isinstance(item, dict):
            platform["api_path_source_ready"] = item.get("sourceReady")
            platform["api_path_ready"] = item.get("ready")
            platform["api_has_source"] = bool(item.get("source"))
            readers = item.get("readers", []) or []
            platform["api_readers"] = len(readers)

    return platform, issues


def probe_content(cfg: ProbeConfig) -> Tuple[Dict[str, Any], List[str]]:
    issues: List[str] = []
    url = f"rtsp://{cfg.host}:{cfg.rtsp_port}/{cfg.path}"

    ffprobe_json, ffprobe_stderr, ffprobe_err = run_ffprobe(url, cfg.timeout_seconds)

    content: Dict[str, Any] = {
        "ffprobe_ok": ffprobe_err is None,
        "ffprobe_url": url,
        "ffprobe_stderr": ffprobe_stderr,
    }

    if ffprobe_err:
        issues.append(f"ffprobe error: {ffprobe_err}")
        content["ffprobe_error"] = ffprobe_err
        return content, issues

    streams = ffprobe_json.get("streams", []) if isinstance(ffprobe_json, dict) else []
    fmt = ffprobe_json.get("format", {}) if isinstance(ffprobe_json, dict) else {}

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    content["format"] = {
        "format_name": fmt.get("format_name"),
        "format_long_name": fmt.get("format_long_name"),
        "start_time": fmt.get("start_time"),
        "bit_rate": fmt.get("bit_rate"),
        "nb_streams": fmt.get("nb_streams"),
        "probe_score": fmt.get("probe_score"),
    }

    content["has_video"] = video_stream is not None
    content["has_audio"] = audio_stream is not None

    if video_stream:
        fps = parse_fps(video_stream.get("avg_frame_rate")) or parse_fps(video_stream.get("r_frame_rate"))
        content["video"] = {
            "codec_name": video_stream.get("codec_name"),
            "profile": video_stream.get("profile"),
            "width": video_stream.get("width"),
            "height": video_stream.get("height"),
            "pix_fmt": video_stream.get("pix_fmt"),
            "fps": fps,
            "avg_frame_rate": video_stream.get("avg_frame_rate"),
            "r_frame_rate": video_stream.get("r_frame_rate"),
            "level": video_stream.get("level"),
        }
        if video_stream.get("codec_name") != cfg.expected_video_codec:
            issues.append(f"Unexpected video codec: {video_stream.get('codec_name')} != {cfg.expected_video_codec}")
        if video_stream.get("width") != cfg.expected_width or video_stream.get("height") != cfg.expected_height:
            issues.append(
                f"Unexpected video resolution: {video_stream.get('width')}x{video_stream.get('height')} != "
                f"{cfg.expected_width}x{cfg.expected_height}"
            )
        min_fps = cfg.expected_fps * cfg.min_fps_ratio
        if fps is None:
            issues.append("Unable to determine video FPS")
        elif fps < min_fps:
            issues.append(f"Low FPS: {fps:.2f} < {min_fps:.2f}")
    else:
        content["video"] = None
        if cfg.require_video:
            issues.append("Missing video stream")

    if audio_stream:
        sample_rate = int(audio_stream.get("sample_rate")) if str(audio_stream.get("sample_rate", "")).isdigit() else audio_stream.get("sample_rate")
        content["audio"] = {
            "codec_name": audio_stream.get("codec_name"),
            "profile": audio_stream.get("profile"),
            "sample_rate": sample_rate,
            "channels": audio_stream.get("channels"),
            "channel_layout": audio_stream.get("channel_layout"),
        }
        if audio_stream.get("codec_name") != cfg.expected_audio_codec:
            issues.append(f"Unexpected audio codec: {audio_stream.get('codec_name')} != {cfg.expected_audio_codec}")
        if sample_rate != cfg.expected_audio_sample_rate:
            issues.append(f"Unexpected audio sample rate: {sample_rate} != {cfg.expected_audio_sample_rate}")
    else:
        content["audio"] = None
        if cfg.require_audio:
            issues.append("Missing audio stream")

    warn_lines = [line for line in ffprobe_stderr.splitlines() if line.strip()]
    content["ffprobe_warning_count"] = len(warn_lines)
    content["ffprobe_warning_lines"] = warn_lines[:20]

    return content, issues


def classify_status(platform: Dict[str, Any], content: Dict[str, Any], issues: List[str]) -> Tuple[str, str]:
    path_ready = platform.get("path_ready_metric") in (1, 1.0)
    srt_connected = bool(platform.get("srt_publish_connected"))
    ffprobe_ok = bool(content.get("ffprobe_ok"))
    has_video = bool(content.get("has_video"))
    has_audio = bool(content.get("has_audio"))

    platform_up = (platform.get("api_ok") or platform.get("metrics_ok")) and (path_ready or srt_connected)
    content_up = ffprobe_ok and has_video and has_audio
    quality_issues = [x for x in issues if x.startswith("Unexpected") or x.startswith("Low FPS") or x.startswith("Unable to determine")]

    if platform_up and content_up and not quality_issues:
        return "UP_HEALTHY", "Platform healthy and media validated"
    if platform_up and content_up and quality_issues:
        return "UP_DEGRADED", "Platform healthy but media quality/profile degraded"
    if platform_up and not content_up:
        return "DOWN_CONTENT", "Path/platform alive but usable media is not valid"
    return "DOWN_PLATFORM", "Routing/platform issue or path not ready"


def run_probe(cfg: ProbeConfig) -> ProbeResult:
    platform, platform_issues = probe_platform(cfg)
    content, content_issues = probe_content(cfg)
    issues = platform_issues + content_issues
    status, summary = classify_status(platform, content, issues)
    return ProbeResult(
        status=status,
        summary=summary,
        checked_at_epoch=time.time(),
        platform=platform,
        content=content,
        issues=issues,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MediaMTX + ffprobe probe service")
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--path", required=True)
    parser.add_argument("--api-port", type=int, default=9997)
    parser.add_argument("--metrics-port", type=int, default=9998)
    parser.add_argument("--rtsp-port", type=int, default=8554)
    parser.add_argument("--timeout-seconds", type=int, default=8)
    parser.add_argument("--interval", type=int, default=0, help="Run continuously every N seconds")
    parser.add_argument("--output", default="", help="Write JSON result to this file")
    parser.add_argument("--expected-video-codec", default="h264")
    parser.add_argument("--expected-audio-codec", default="aac")
    parser.add_argument("--expected-width", type=int, default=1280)
    parser.add_argument("--expected-height", type=int, default=720)
    parser.add_argument("--expected-fps", type=float, default=30.0)
    parser.add_argument("--expected-audio-sample-rate", type=int, default=48000)
    parser.add_argument("--min-fps-ratio", type=float, default=0.9)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    cfg = ProbeConfig(
        host=args.host,
        user=args.user,
        password=args.password,
        path=args.path,
        api_port=args.api_port,
        metrics_port=args.metrics_port,
        rtsp_port=args.rtsp_port,
        timeout_seconds=args.timeout_seconds,
        expected_video_codec=args.expected_video_codec,
        expected_audio_codec=args.expected_audio_codec,
        expected_width=args.expected_width,
        expected_height=args.expected_height,
        expected_fps=args.expected_fps,
        expected_audio_sample_rate=args.expected_audio_sample_rate,
        min_fps_ratio=args.min_fps_ratio,
    )

    def emit(result: ProbeResult) -> None:
        payload = json.dumps(asdict(result), indent=2)
        print(payload)
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(payload + "\n")

    if args.interval and args.interval > 0:
        while True:
            try:
                emit(run_probe(cfg))
            except KeyboardInterrupt:
                return 0
            except Exception as e:
                print(json.dumps({
                    "status": "DOWN_PLATFORM",
                    "summary": "Probe crashed",
                    "error": str(e),
                    "checked_at_epoch": time.time(),
                }, indent=2))
            time.sleep(args.interval)
    else:
        emit(run_probe(cfg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
