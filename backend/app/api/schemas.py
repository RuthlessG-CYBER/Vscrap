from pydantic import BaseModel


class UrlRequest(BaseModel):
    url: str


class VideoDownloadRequest(UrlRequest):
    format_id: str | None = None


class MediaRequest(UrlRequest):
    format: str | None = None
