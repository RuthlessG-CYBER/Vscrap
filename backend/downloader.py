"""Backward-compatible imports for older scripts.

Implementation lives in app.core.security and app.services.extractor.
"""

from app.core.security import is_allowed, is_audio_url
from app.services.extractor import (
    DOWNLOAD_ROOT,
    app_formats,
    cancel_active_downloads,
    download_audio,
    download_video,
    get_info,
    safe_title,
)

__all__ = [
    "DOWNLOAD_ROOT",
    "app_formats",
    "cancel_active_downloads",
    "download_audio",
    "download_video",
    "get_info",
    "is_allowed",
    "is_audio_url",
    "safe_title",
]
