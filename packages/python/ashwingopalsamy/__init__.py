"""Official Python SDK for Ashwin Gopalsamy's developer API."""

from .client import Client, AshwinGopalsamyError
from .models import (
    ProfileSummary,
    ProfileLinks,
    PaletteItem,
    SearchResults,
    ContentList,
    NoteMarkdown,
    ApiStatus,
)

__version__ = "1.0.0"
__all__ = [
    "Client",
    "AshwinGopalsamyError",
    "ProfileSummary",
    "ProfileLinks",
    "PaletteItem",
    "SearchResults",
    "ContentList",
    "NoteMarkdown",
    "ApiStatus",
]
