import asyncio
from pathlib import Path

from fastapi import APIRouter, HTTPException
from starlette.background import BackgroundTask

from app.api.schemas import MediaRequest, UrlRequest, VideoDownloadRequest
from app.core.security import is_allowed, is_audio_url
from app.services import extractor
from app.services.download_jobs import download_jobs
from app.services.media import download_response, extractor_error, media_info

router = APIRouter()


def _validate_url(url: str) -> None:
    if not is_allowed(url):
        raise HTTPException(400, "Unsupported or unrecognized link.")


@router.get("/health")
@router.get("/")
async def health():
    return {"status": "ok", "service": "vscrap-backend", "version": "1.0.0"}


@router.post("/info")
async def legacy_info(body: UrlRequest):
    _validate_url(body.url)
    try:
        data = await asyncio.to_thread(extractor.get_info, body.url)
        return {
            "title": data.get("title"),
            "duration": data.get("duration"),
            "thumbnail": data.get("thumbnail"),
            "uploader": data.get("uploader"),
            "extractor": data.get("extractor"),
            "formats": [
                {
                    "format_id": item.get("format_id"),
                    "ext": item.get("ext"),
                    "resolution": item.get("resolution") or item.get("format_note"),
                    "filesize_approx": item.get("filesize") or item.get("filesize_approx"),
                    "vcodec": item.get("vcodec"),
                    "acodec": item.get("acodec"),
                }
                for item in data.get("formats", [])
                if item.get("vcodec") != "none"
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Could not read this link: {extractor_error(exc)}") from exc


@router.post("/api/download/info")
async def app_info(body: MediaRequest):
    _validate_url(body.url)
    try:
        return await asyncio.to_thread(media_info, body.url, body.format)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Could not read this link: {extractor_error(exc)}") from exc


@router.post("/api/download/jobs")
async def create_download_job(body: MediaRequest):
    _validate_url(body.url)
    job_id = download_jobs.create(body.url, body.format)
    return {"jobId": job_id, "status": "queued"}


@router.get("/api/download/jobs/{job_id}")
async def download_job_status(job_id: str):
    job = download_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Download job not found.")
    return {
        "jobId": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "bytesDownloaded": job["bytesDownloaded"],
        "totalBytes": job["totalBytes"],
        "error": job.get("error"),
    }


@router.get("/api/download/jobs/{job_id}/file")
async def download_job_file(job_id: str):
    job = download_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Download job not found.")
    if job["status"] != "completed":
        raise HTTPException(409, "Download is not ready yet.")

    path = job["path"]
    media_type = "audio" if Path(path).suffix.lower() == ".mp3" else "video"
    response = download_response(path, media_type)
    response.background = BackgroundTask(
        download_jobs.remove_after_delivery,
        job_id,
        str(Path(path).parent),
    )
    return response


@router.delete("/api/download/jobs/{job_id}")
async def cancel_download_job(job_id: str):
    download_jobs.cancel(job_id)
    return {"status": "cancelled"}


@router.post("/api/download/formats")
async def formats(body: UrlRequest):
    _validate_url(body.url)
    try:
        data = await asyncio.to_thread(extractor.get_info, body.url)
        return {
            "url": body.url,
            "source": data.get("extractor_key") or data.get("extractor"),
            "title": data.get("title"),
            "durationSeconds": data.get("duration"),
            "thumbnail": data.get("thumbnail"),
            "formats": extractor.app_formats(data),
        }
    except Exception as exc:
        raise HTTPException(422, f"Could not read this link: {extractor_error(exc)}") from exc


@router.post("/download/video")
async def download_video(body: VideoDownloadRequest):
    _validate_url(body.url)
    try:
        path = await asyncio.to_thread(extractor.download_video, body.url, body.format_id)
        return download_response(path, "video")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Download failed: {extractor_error(exc)}") from exc


@router.post("/download/audio")
async def download_audio(body: UrlRequest):
    _validate_url(body.url)
    try:
        path = await asyncio.to_thread(extractor.download_audio, body.url)
        return download_response(path, "audio")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Audio extraction failed: {extractor_error(exc)}") from exc


@router.get("/api/download/stream")
async def stream(url: str, format: str | None = None):
    _validate_url(url)
    try:
        if (format and format.startswith("audio:mp3:")) or is_audio_url(url):
            path = await asyncio.to_thread(extractor.download_audio, url, format)
            return download_response(path, "audio")
        path = await asyncio.to_thread(extractor.download_video, url, format)
        return download_response(path, "video")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, f"Download failed: {extractor_error(exc)}") from exc
