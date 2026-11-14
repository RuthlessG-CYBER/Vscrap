import asyncio
import shutil
import threading
import time
import uuid
from pathlib import Path

from app.core.config import DOWNLOAD_ROOT, MAX_FILE_AGE_SECONDS
from app.core.security import is_audio_url
from app.services import extractor
from app.services.media import extractor_error


class DownloadJobManager:
    """In-process job registry for extraction, progress, and temporary files."""

    def __init__(self) -> None:
        self.jobs: dict[str, dict] = {}
        self._tasks: set[asyncio.Task] = set()

    def create(self, url: str, format_id: str | None) -> str:
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "status": "queued",
            "progress": 0,
            "bytesDownloaded": 0,
            "totalBytes": None,
            "cancel_event": threading.Event(),
            "createdAt": time.time(),
        }
        task = asyncio.create_task(self._run(job_id, url, format_id))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return job_id

    def get(self, job_id: str) -> dict | None:
        return self.jobs.get(job_id)

    async def _run(self, job_id: str, url: str, format_id: str | None) -> None:
        job = self.jobs.get(job_id)
        if not job:
            return
        job["status"] = "processing"

        def on_progress(data: dict) -> None:
            current = self.jobs.get(job_id)
            if not current:
                return
            downloaded = int(data.get("downloaded_bytes") or 0)
            total = int(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            current.update({
                "bytesDownloaded": downloaded,
                "totalBytes": total or None,
                "progress": max(
                    current.get("progress", 0),
                    min(99, downloaded * 100 / total) if total else 0,
                ),
            })

        try:
            audio = bool(
                (format_id and format_id.startswith("audio:mp3:"))
                or is_audio_url(url)
            )
            download_fn = extractor.download_audio if audio else extractor.download_video
            path = await asyncio.to_thread(
                download_fn,
                url,
                format_id,
                on_progress,
                job["cancel_event"],
            )
            job.update({"status": "completed", "progress": 100, "path": path})
        except Exception as exc:
            job.update({"status": "failed", "error": extractor_error(exc)})

    def cancel(self, job_id: str) -> None:
        job = self.jobs.pop(job_id, None)
        if not job:
            return
        job["cancel_event"].set()
        if job.get("path"):
            shutil.rmtree(Path(job["path"]).parent, ignore_errors=True)

    def remove_after_delivery(self, job_id: str, folder: str) -> None:
        shutil.rmtree(folder, ignore_errors=True)
        self.jobs.pop(job_id, None)

    async def cleanup_loop(self) -> None:
        DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        while True:
            now = time.time()
            for job_dir in DOWNLOAD_ROOT.iterdir():
                try:
                    if job_dir.is_dir() and now - job_dir.stat().st_mtime > MAX_FILE_AGE_SECONDS:
                        shutil.rmtree(job_dir, ignore_errors=True)
                except FileNotFoundError:
                    pass

            for job_id, job in list(self.jobs.items()):
                if (
                    job.get("status") in {"completed", "failed"}
                    and now - job.get("createdAt", now) > MAX_FILE_AGE_SECONDS
                ):
                    if job.get("path"):
                        shutil.rmtree(Path(job["path"]).parent, ignore_errors=True)
                    self.jobs.pop(job_id, None)
            await asyncio.sleep(120)

    def shutdown(self) -> None:
        extractor.cancel_active_downloads()


download_jobs = DownloadJobManager()
