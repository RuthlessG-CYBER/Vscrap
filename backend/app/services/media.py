import re
import shutil
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services import extractor
from app.core.security import is_audio_url


def extractor_error(exc: Exception) -> str:
    message = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", str(exc)).strip()
    if "[Instagram]" in message and "HTTP Error 400" in message:
        return (
            "Instagram rejected the extraction request (HTTP 400). Refresh the "
            "logged-in cookies.txt from the same browser and network; Instagram "
            "may also be blocking this connection."
        )
    return message


def media_info(url: str, format_id: str | None = None) -> dict:
    info = extractor.get_info(url)
    formats = extractor.app_formats(info)
    has_video = any(
        item.get("vcodec") not in (None, "none")
        for item in info.get("formats", [])
    )
    is_audio = bool(
        (format_id and format_id.startswith("audio:mp3:"))
        or is_audio_url(url)
        or (
            not has_video
            and info.get("ext") in {"mp3", "m4a", "aac", "wav", "ogg", "opus"}
        )
    )
    if is_audio:
        ext, content_type, media_type = "mp3", "audio/mpeg", "audio"
    else:
        ext, content_type, media_type = "mp4", "video/mp4", "video"

    size = info.get("filesize") or info.get("filesize_approx")
    title = extractor.safe_title(info.get("title"))
    return {
        "source": info.get("extractor_key") or info.get("extractor"),
        "title": info.get("title"),
        "contentType": content_type,
        "contentLength": size,
        "sizeEstimated": bool(info.get("filesize_approx") and not info.get("filesize")),
        "mediaType": media_type,
        "filename": f"{title}.{ext}",
        "durationSeconds": info.get("duration"),
        "format": format_id,
        "formats": formats,
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
    }


def download_response(path: str, media_type: str) -> FileResponse:
    file_path = Path(path)
    if not file_path.is_file():
        raise HTTPException(500, "File was not produced.")
    content_type = "audio/mpeg" if media_type == "audio" else "video/mp4"
    return FileResponse(
        file_path,
        filename=file_path.name,
        media_type=content_type,
        background=BackgroundTask(shutil.rmtree, file_path.parent, True),
    )
