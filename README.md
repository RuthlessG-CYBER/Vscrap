# VScrap

VScrap is a mobile media downloader with an Expo frontend and an Express
backend. The backend handles direct media URLs and resolves supported
YouTube, Instagram, and Facebook links with `yt-dlp`.

## Project layout

```text
.
├── VScrap/       Expo / React Native app
├── backend/      Express API and media extractor
├── docs/         Local project notes (excluded from Git)
└── cookies.txt   Local platform cookie jar (excluded from Git)
```

Keep credentials and cookie files out of source control. The root `.gitignore`
excludes local environment files, cookies, dependencies, build output, and the
`docs/` folder.

## Run locally

### Backend

```bash
cd backend
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Create `backend/.env` with the settings you need. For local development, the
backend uses port `3000` by default. To enable posts that require a signed-in
platform session, set the cookie jar path:

```dotenv
YTDLP_COOKIES_FILE=/absolute/path/to/cookies.txt
```

The cookie jar must use Netscape format. It can contain cookies from multiple
platforms. Keep the file private and never commit it. Run the API with:

```bash
npm start
```

### Frontend

In another terminal:

```bash
cd VScrap
npm install
npm start
```

Set the backend address in the app's **Settings → Backend URL**. For a
production app build, provide `EXPO_PUBLIC_API_URL` with the deployed backend
URL before building. For local development on the same computer, the backend
defaults to port `3000`.

## API

The backend listens on `PORT` (default `3000`). Its root URL (`GET /`) returns
service status. Download endpoints are:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/download/formats` | List available video and audio formats |
| `POST` | `/api/download/info` | Return media metadata before downloading |
| `GET` | `/api/download/stream` | Stream a validated media file |

The formats and info endpoints accept JSON such as:

```json
{ "url": "https://www.instagram.com/reel/example/" }
```

The stream endpoint accepts `url` and optional `format` query parameters.

## Deploy the backend on Render

The Git repository connected to Render must contain the `backend/` directory.
Create a Render **Web Service** with:

- **Root Directory:** `backend`
- **Build Command:** `npm install && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- **Start Command:** `npm start`

Set `NODE_ENV` to `production` in the service's environment settings. Render
provides `PORT` automatically. For session based extraction, add a Render
Secret File named `cookies.txt` containing the Netscape cookie jar and set:

```text
YTDLP_COOKIES_FILE=/etc/secrets/cookies.txt
```

Use the service's HTTPS URL as the frontend backend address. For mobile builds,
set `EXPO_PUBLIC_API_URL` to that URL when building the app. If using the app
in a web browser, set `ALLOWED_ORIGINS` on the backend to the web app's origin.

## Configuration

The backend reads optional settings from environment variables, including:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port (`PORT` is assigned by Render) |
| `NODE_ENV` | `development` | Runtime environment |
| `ALLOWED_ORIGINS` | empty | Comma-separated browser origins allowed by CORS |
| `YTDLP_COOKIES_FILE` | unset | Path to the server-side cookie jar |
| `MAX_DOWNLOAD_BYTES` | 500 MiB | Maximum streamed file size |
| `MAX_VIDEO_HEIGHT` | `2160` | Maximum requested video resolution |

No end-user account login is required by this app. Platform cookies, when
configured, are used only by the backend extractor.
