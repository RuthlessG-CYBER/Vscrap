# Media Downloader — Backend Proxy

Backend for direct-URL downloads and supported social video links. Platform
cookies are kept on the backend and are never sent to the mobile app.

## Setup

```bash
cd backend
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt   # yt-dlp + a static ffmpeg
cp .env.example .env   # fill in real values
npm start               # or: npm run dev
```

The Python environment powers YouTube, Instagram, and Facebook share links.
`yt-dlp` extracts the media and the bundled `ffmpeg` muxes separate video/audio streams
into a phone-friendly MP4. Override the binary locations with `YTDLP_PATH` and
`FFMPEG_PATH` if they are installed globally.

## Endpoints

| Method | Path                      | Purpose                                         |
|--------|---------------------------|--------------------------------------------------|
| GET    | `/health`                 | Liveness check + service metadata               |
| POST   | `/api/download/formats`   | List selectable video qualities and MP3 options |
| POST   | `/api/download/info`      | Validate a URL and return type/size before download |
| GET    | `/api/download/stream`    | Stream the file through the server to the client |

### `GET /health`

```json
{
  "status": "ok",
  "service": "vscrap-backend",
  "version": "1.0.0",
  "uptimeSeconds": 42,
  "maxDownloadBytes": 524288000
}
```

The mobile app polls this endpoint to show the connection status pill and to
disable downloads while the backend is unreachable.

### `POST /api/download/formats`

Lists the qualities a share link can be downloaded in. Direct file URLs return
an empty list.

```json
{ "url": "https://youtu.be/JQix0eKwlww" }
```

```json
{
  "url": "https://youtu.be/JQix0eKwlww",
  "source": "youtube",
  "title": "Example video",
  "durationSeconds": 192,
  "formats": [
    { "id": "video:1080", "kind": "video", "label": "1080p", "ext": "mp4", "height": 1080 },
    { "id": "video:720",  "kind": "video", "label": "720p",  "ext": "mp4", "height": 720 },
    { "id": "audio:mp3:320", "kind": "audio", "label": "MP3 · 320 kbps", "ext": "mp3", "bitrate": 320 }
  ]
}
```

Use the `id` as the `format` field for `/info` and `/stream`. Video ids map to
the closest available resolution at or below the requested height; MP3 ids are
re-encoded with `libmp3lame` at the requested bitrate (64–320 kbps).

### `POST /api/download/info`

Request:

```json
{ "url": "https://example.com/media/clip.mp4" }
```

Add `"format": "video:720"` or `"format": "audio:mp3:192"` to describe a
specific quality. When `format` is omitted, the best video up to
`MAX_VIDEO_HEIGHT` is used.

Response:

```json
{
  "url": "https://example.com/media/clip.mp4",
  "contentType": "video/mp4",
  "contentLength": 10485760,
  "mediaType": "video",
  "filename": "clip.mp4"
}
```

`contentLength` is `null` when the source does not report a size. `mediaType`
is one of `image`, `video`, `audio`, or `file`.

YouTube (`youtube.com`, `youtu.be`, Shorts), Instagram (`instagram.com`,
`instagr.am`), and Facebook (`facebook.com`, `fb.watch`) URLs are resolved with
`yt-dlp` instead of being fetched directly, so they do not need a file extension:

```json
{
  "url": "https://youtu.be/JQix0eKwlww?si=...",
  "source": "youtube",
  "title": "Example video",
  "contentType": "video/mp4",
  "contentLength": 8765429,
  "mediaType": "video",
  "filename": "Example video.mp4",
  "durationSeconds": 210
}
```

Private, age-restricted, or region-locked posts return `422` with a readable
message. Posts requiring a logged-in session use a Netscape-format cookies file
containing the cookies for the relevant platform:

```bash
# .env
YTDLP_COOKIES_FILE=/absolute/path/to/cookies.txt
```

Export Instagram and Facebook cookies from a browser where you are signed in,
combine them into one Netscape-format file, and point `YTDLP_COOKIES_FILE` at
that file. If the configured file is read-only, the backend makes a private,
writable temporary copy because `yt-dlp` updates its cookie jar. The current
local cookie jar contains Instagram and YouTube entries;
it needs Facebook entries added before Facebook-only/private posts can use your
Facebook session. Keep the cookie jar out of source control and restrict its
file permissions (`chmod 600 cookies.txt`). Do not put raw session IDs in app
code or logs.

### `GET /api/download/stream?url=...&format=...`

Streams the validated media back with `Content-Type`,
`Content-Disposition` (sanitized filename), and `Cache-Control: no-store`.
The URL is re-validated here — a successful `/info` call is never trusted on its own.

The optional `format` parameter accepts the ids returned by
`/api/download/formats`. Audio formats are transcoded to MP3 and streamed
directly; video formats are muxed on the fly into fragmented MP4 and streamed
via `pipe:1`, so bytes start flowing immediately and the phone's 10 s read
timeout is never hit. Because the final size is unknown while muxing, the
response is chunked (no `Content-Length`); in-app progress may stay at 0 %
then jump to 100 % when the file completes.

The byte cap (`MAX_DOWNLOAD_BYTES`, default 2 GB) is enforced as bytes flow,
so downloads are aborted mid-stream if they exceed the limit rather than
failing only after the whole file is ready.

For share links, this endpoint resolves the direct stream URLs and muxes
video + audio on the fly into a fragmented MP4, so bytes start flowing before
the whole file is ready (YouTube no longer serves progressive MP4s). Image
posts are proxied directly. Because the body is chunked, `Content-Length` is
not set for muxed videos. `MAX_VIDEO_HEIGHT` (default `1080`) caps the
resolution that is fetched.

`yt-dlp` and `ffmpeg` are only used server-side; the phone still receives a
normal HTTP file and saves it with `expo-file-system`.

## Connecting the mobile app

The app resolves the backend URL in this order:

1. `EXPO_PUBLIC_API_URL` (build-time override).
2. `expo.extra.apiUrl` in `media-downloader/app.json`.
3. The Expo dev server host with port `3000` (physical device on the same Wi-Fi).
4. `http://10.0.2.2:3000` on the Android emulator, `http://localhost:3000` elsewhere.

Start the backend on `0.0.0.0` so a phone on the LAN can reach it:

```bash
cd backend
npm run dev
# or: PORT=3000 node src/server.js
```

The server listens on all interfaces by default, so devices on the same
network can reach `http://<your-computer-LAN-IP>:3000`.

During development `CORS` also allows `http://localhost:<port>` origins and
native requests (which send no `Origin` header) so Expo Go and development
builds can connect without editing `ALLOWED_ORIGINS`. Production still uses
the strict `ALLOWED_ORIGINS` allowlist.

The app can also point at a different backend at runtime from **Settings →
Backend URL** — useful for testing a LAN address or a deployed HTTPS server.
Because `/api/download/stream` is called directly by the device, use the same
host from the phone's point of view, not `localhost`.

## Security measures implemented

- **SSRF protection** (`src/middleware/ssrfGuard.js`): resolves every target
  hostname and rejects private, loopback, link-local, and reserved IP ranges
  before any outbound request — on both the `/info` check and the `/stream`
  call, independently, so a validated-then-rebound DNS record can't slip through.
- **HTTPS enforcement**: redirects HTTP to HTTPS in production (put a real TLS
  terminator — e.g. a load balancer or reverse proxy — in front in practice).
- **Rate limiting**: per-IP request cap via `express-rate-limit`.
- **CORS allowlist**: only origins listed in `ALLOWED_ORIGINS` are permitted.
- **Secrets stay server-side**: platform cookies are read only by the backend
  extractor and never sent to the client.
- **Content-type allowlisting + byte cap**: only image/video/audio responses
  under `MAX_DOWNLOAD_BYTES` are streamed back.
- **Platform allowlist for share links**: `yt-dlp` is only invoked for
  youtube.com / youtu.be / instagram.com / facebook.com / fb.watch hosts.
  Instagram `/share/` redirects are followed only while they stay on
  instagram.com. Extracted temp files are deleted on response close, and
  `--max-filesize` / `MAX_VIDEO_HEIGHT` bound each job.
- **Small request bodies only**: JSON body limited to 10kb — this server
  brokers URLs and codes, not file uploads.

## Notes

- This is a starting point, not a finished production deployment: add
  structured logging, a process manager (e.g. PM2) or container orchestration,
  and real TLS termination before shipping.
