# VScrap Backend

FastAPI backend for VScrap. `yt-dlp` resolves supported social share URLs and
downloads video or audio; ffmpeg merges/transcodes media. Direct media file URLs
are accepted for common image, video, and audio extensions. Use it only for
content you own or are authorized to download.

## Code layout

- `main.py`: stable Uvicorn entry point (`uvicorn main:app`).
- `app/main.py`: FastAPI app factory, middleware, and lifecycle.
- `app/api/`: route handlers and request schemas.
- `app/core/`: environment configuration and URL safety checks.
- `app/services/extractor.py`: yt-dlp options, extraction, format selection,
  and temporary file creation.
- `app/services/download_jobs.py`: job state, progress, cancellation, and cleanup.
- `app/services/media.py`: media metadata shaping and file responses.
- `downloader.py`: small compatibility re-export for older scripts.

## Deploy on Render

1. Push the repository to GitHub.
2. In Render, select **New > Blueprint** and choose this repository.
3. Select `backend/render.yaml` as the blueprint file if Render does not find it
   automatically. The blueprint builds `backend/Dockerfile` and checks `/health`.
4. After deployment, copy the service's HTTPS URL into the app's existing
   **Settings > Backend URL** field.

No Cobalt service is needed. Render's free plan may spin down while idle; its
first request after idle can take longer. Its local download directory is
ephemeral, and completed files are deleted after they are sent or after 15
minutes.

## Run locally

```bash
python -m venv .venv
. .venv/bin/activate
pip install --pre -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 3000
```

Install ffmpeg in the local environment for merging video and MP3 conversion.
The Docker image installs it automatically.

## Routes

The app keeps using these routes:

- `GET /health`
- `POST /api/download/formats` with `{ "url": "..." }`
- `POST /api/download/info` with `{ "url": "...", "format": "video:720" }`
- `POST /api/download/jobs` with `{ "url": "...", "format": "video:720" }`
- `GET /api/download/jobs/{job_id}` for live preparation progress
- `GET /api/download/jobs/{job_id}/file` to transfer the completed file
- `DELETE /api/download/jobs/{job_id}` to cancel a job

For compatibility with the supplied FastAPI sample, these routes are also
available:

- `POST /info` with `{ "url": "..." }`
- `POST /download/video` with `{ "url": "...", "format_id": "..." }`
- `POST /download/audio` with `{ "url": "..." }`

The app polls the job endpoint while yt-dlp prepares the media, then downloads
the completed file into the phone's local document storage. The backend keeps
only a temporary working copy and removes it after the phone receives the file
or when the temporary file expires.

## Configuration

- Local optional settings live in `backend/.env`; it is loaded at startup and
  ignored by Git. `PORT` defaults to `8000` when running Uvicorn directly, while
  the documented local command uses port `3000` for the app.
- `ALLOWED_ORIGINS`: comma-separated browser origins; native React Native
  requests do not send an Origin header.
- The backend reads `backend/cookies.txt` directly for supported social sites
  when that file exists. It must use Netscape format. Never commit session
  cookies or expose them in the app.
- `YTDLP_USER_AGENT`: optional full browser User-Agent from the same browser
  session used to export the cookies. Add it to `.env` if needed. Instagram may
  reject extraction even when a cookie file is present.

The backend validates URL schemes, social hostnames, and public DNS results;
direct URLs must use a common media file extension. Temporary files are cleaned
up after transfer or expiry. No maximum download size is configured.
