import os
import re
import threading
import uuid
from pathlib import Path
from urllib.parse import urlparse

import yt_dlp
from app.core.config import BASE_DIR, DOWNLOAD_ROOT
from app.core.security import ALLOWED_DOMAINS, is_allowed, is_audio_url

ROOT = BASE_DIR
_active_downloads: set[threading.Event] = set()
_active_downloads_lock = threading.Lock()


def cancel_active_downloads() -> None:
    """Ask running yt-dlp jobs to stop before the server shuts down."""
    with _active_downloads_lock:
        active = tuple(_active_downloads)
    for cancel_event in active:
        cancel_event.set()


def _download_options(
    url: str,
    folder: Path,
    cancel_event: threading.Event,
    progress_callback=None,
) -> dict:
    options = _base_options(url)

    def report_progress(data: dict) -> None:
        _raise_if_cancelled(cancel_event)
        if progress_callback:
            progress_callback(data)

    options.update({
        "outtmpl": str(folder / "%(title).100B [%(id)s].%(ext)s"),
        "progress_hooks": [report_progress],
    })
    return options


def _raise_if_cancelled(cancel_event: threading.Event) -> None:
    if cancel_event.is_set():
        raise yt_dlp.utils.DownloadError("Download cancelled because the server is shutting down.")


def _register_download(cancel_event: threading.Event) -> None:
    with _active_downloads_lock:
        _active_downloads.add(cancel_event)


def _unregister_download(cancel_event: threading.Event) -> None:
    with _active_downloads_lock:
        _active_downloads.discard(cancel_event)

def _cookiefile_for(url: str) -> str | None:
    host = (urlparse(url).hostname or "").lower()
    is_social_host = any(
        host == domain or host.endswith("." + domain)
        for domain in ALLOWED_DOMAINS
    )
    if not is_social_host:
        return None
    cookie_path = ROOT / "cookies.txt"
    return str(cookie_path) if cookie_path.is_file() else None


def _base_options(url: str) -> dict:
    options = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "restrictfilenames": True,
        "socket_timeout": 20,
    }
    user_agent = os.getenv("YTDLP_USER_AGENT")
    if user_agent:
        options["http_headers"] = {"User-Agent": user_agent}
    cookiefile = _cookiefile_for(url)
    if cookiefile:
        options["cookiefile"] = cookiefile
    return options


def get_info(url: str) -> dict:
    options = _base_options(url)
    options["skip_download"] = True
    with yt_dlp.YoutubeDL(options) as ydl:
        return ydl.extract_info(url, download=False)


def safe_title(value: str | None) -> str:
    title = re.sub(r'[\x00-\x1f\\/:*?"<>|]+', "-", str(value or "vscrap-media"))
    return title.strip(" .-")[:120] or "vscrap-media"


def app_formats(info: dict) -> list[dict]:
    by_height: dict[int, dict] = {}
    for item in info.get("formats", []):
        height = item.get("height")
        if not isinstance(height, int) or item.get("vcodec") in (None, "none"):
            continue
        current = by_height.get(height)
        if current is None or (item.get("filesize") or item.get("filesize_approx") or 0) > (
            current.get("filesize") or current.get("filesize_approx") or 0
        ):
            by_height[height] = item

    outputs = []
    for height in sorted(by_height, reverse=True)[:6]:
        outputs.append({
            "id": f"video:{height}",
            "kind": "video",
            "label": f"{height}p",
            "ext": "mp4",
            "height": height,
            "filesize": by_height[height].get("filesize") or by_height[height].get("filesize_approx"),
        })
    if any(item.get("acodec") not in (None, "none") for item in info.get("formats", [])):
        for bitrate in (320, 256, 128):
            outputs.append({
                "id": f"audio:mp3:{bitrate}",
                "kind": "audio",
                "label": f"MP3 · {bitrate} kbps",
                "ext": "mp3",
                "bitrate": bitrate,
                "filesize": None,
            })
    return outputs


def _job_dir() -> Path:
    folder = DOWNLOAD_ROOT / str(uuid.uuid4())
    folder.mkdir(parents=True, exist_ok=False)
    return folder


def _resolve_video_format(format_id: str | None) -> str:
    if not format_id:
        return "bestvideo*+bestaudio/best"
    match = re.fullmatch(r"video:(\d{3,4})", format_id)
    if match:
        height = int(match.group(1))
        return f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
    if re.fullmatch(r"[A-Za-z0-9._-]{1,80}", format_id):
        return f"{format_id}+bestaudio/{format_id}/best"
    raise ValueError("Invalid video format selection.")


def _finish_path(folder: Path, path: str, expected_ext: str) -> str:
    candidate = Path(path)
    if expected_ext and candidate.suffix.lower() != f".{expected_ext}":
        matching = list(folder.glob(f"*.{expected_ext}"))
        if matching:
            candidate = matching[0]
    if not candidate.is_file():
        raise ValueError("Downloaded file is missing.")
    return str(candidate)


def download_video(url: str, format_id: str | None = None, progress_callback=None, cancel_event=None) -> str:
    folder = _job_dir()
    cancel_event = cancel_event or threading.Event()
    _register_download(cancel_event)
    try:
        options = _download_options(url, folder, cancel_event, progress_callback)
        options.update({
            "format": _resolve_video_format(format_id),
            "merge_output_format": "mp4",
        })
        _raise_if_cancelled(cancel_event)
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            path = ydl.prepare_filename(info)
        return _finish_path(folder, path, "mp4")
    except BaseException:
        import shutil
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        _unregister_download(cancel_event)


def download_audio(url: str, format_id: str | None = None, progress_callback=None, cancel_event=None) -> str:
    folder = _job_dir()
    cancel_event = cancel_event or threading.Event()
    _register_download(cancel_event)
    bitrate = "192"
    match = re.fullmatch(r"audio:mp3:(\d{2,3})", format_id or "")
    if match:
        bitrate = str(min((64, 96, 128, 192, 256, 320), key=lambda item: abs(item - int(match.group(1)))))
    try:
        options = _download_options(url, folder, cancel_event, progress_callback)
        options.update({
            "format": "bestaudio/best",
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": bitrate,
            }],
        })
        _raise_if_cancelled(cancel_event)
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True)
            output = Path(ydl.prepare_filename(info)).with_suffix(".mp3")
        return _finish_path(folder, str(output), "mp3")
    except BaseException:
        import shutil
        shutil.rmtree(folder, ignore_errors=True)
        raise
    finally:
        _unregister_download(cancel_event)
