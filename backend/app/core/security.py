import ipaddress
import socket
from pathlib import Path
from urllib.parse import urlparse

ALLOWED_DOMAINS = {
    "youtube.com", "youtu.be", "facebook.com", "fb.watch",
    "twitter.com", "x.com", "instagram.com", "tiktok.com",
}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus"}
DIRECT_MEDIA_EXTENSIONS = {
    ".mp4", ".m4v", ".mov", ".webm", ".mkv",
    *AUDIO_EXTENSIONS,
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
}


def is_audio_url(url: str) -> bool:
    return Path(urlparse(url).path.lower()).suffix in AUDIO_EXTENSIONS


def is_allowed(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username:
            return False

        host = parsed.hostname.lower().rstrip(".")
        if host.startswith("www."):
            host = host[4:]

        addresses = {
            item[4][0]
            for item in socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        }
        if not addresses or not all(ipaddress.ip_address(addr).is_global for addr in addresses):
            return False

        is_social = any(
            host == domain or host.endswith("." + domain)
            for domain in ALLOWED_DOMAINS
        )
        return is_social or Path(parsed.path.lower()).suffix in DIRECT_MEDIA_EXTENSIONS
    except (ValueError, OSError):
        return False
