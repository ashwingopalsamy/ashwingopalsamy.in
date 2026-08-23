import json
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

from .models import (
    ProfileSummary,
    SearchResults,
    ContentList,
    NoteMarkdown,
    ApiStatus,
)

class AshwinGopalsamyError(Exception):
    def __init__(self, message: str, status_code: int = 500, code: Optional[str] = None, resolution_hint: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.resolution_hint = resolution_hint

class Client:
    """Official Python client for Ashwin Gopalsamy's developer API."""

    def __init__(self, base_url: str = "https://ashwingopalsamy.in", user_agent: str = "ashwingopalsamy-python-sdk/1.0.0"):
        self.base_url = base_url.rstrip("/")
        self.user_agent = user_agent

    def _request(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        if params:
            query_string = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
            if query_string:
                url = f"{url}?{query_string}"

        req = urllib.request.Request(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": self.user_agent,
            }
        )

        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            try:
                parsed = json.loads(error_body)
            except Exception:
                parsed = {}
            msg = parsed.get("detail") or parsed.get("message") or parsed.get("title") or f"HTTP {e.code}: {e.reason}"
            raise AshwinGopalsamyError(
                message=msg,
                status_code=e.code,
                code=parsed.get("code"),
                resolution_hint=parsed.get("resolution_hint"),
            ) from e

    def get_profile(self) -> ProfileSummary:
        """Fetch authoritative profile summary and career facts for Ashwin Gopalsamy."""
        data = self._request("/api/v1/profile")
        return ProfileSummary.from_dict(data)

    def search_site(self, query: Optional[str] = None, limit: int = 10) -> SearchResults:
        """Search published technical notes, craft projects, and reading list."""
        data = self._request("/api/v1/search", {"query": query, "limit": limit})
        return SearchResults.from_dict(data)

    def list_content(self, kind: str = "all", limit: int = 20) -> ContentList:
        """List public entries filtered by kind (all, note, craft, book, watch, article)."""
        data = self._request("/api/v1/content", {"kind": kind, "limit": limit})
        return ContentList.from_dict(data)

    def get_note_markdown(self, slug: str) -> NoteMarkdown:
        """Retrieve raw Markdown content and metadata for a published note."""
        data = self._request(f"/api/v1/notes/{urllib.parse.quote(slug)}")
        return NoteMarkdown.from_dict(data)

    def get_status(self) -> ApiStatus:
        """Check API operational status, rate limit policy, and capabilities."""
        data = self._request("/api/v1/status")
        return ApiStatus.from_dict(data)
