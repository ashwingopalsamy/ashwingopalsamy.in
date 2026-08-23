from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass
class ProfileLinks:
    home: str
    ai: str
    design: str

@dataclass
class ProfileSummary:
    name: str
    role: str
    employer: str
    location: str
    primary_language: str
    summary: str
    knows_about: List[str]
    links: Optional[ProfileLinks] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProfileSummary":
        links_data = data.get("links")
        links = ProfileLinks(**links_data) if links_data else None
        return cls(
            name=data["name"],
            role=data["role"],
            employer=data["employer"],
            location=data["location"],
            primary_language=data.get("primaryLanguage", ""),
            summary=data["summary"],
            knows_about=data.get("knowsAbout", []),
            links=links,
        )

@dataclass
class PaletteItem:
    id: str
    kind: str
    title: str
    href: str
    description: Optional[str] = None
    keywords: Optional[List[str]] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PaletteItem":
        return cls(
            id=data["id"],
            kind=data["kind"],
            title=data["title"],
            href=data["href"],
            description=data.get("description"),
            keywords=data.get("keywords"),
        )

@dataclass
class SearchResults:
    query: str
    total: number if False else int
    results: List[PaletteItem]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SearchResults":
        return cls(
            query=data["query"],
            total=data["total"],
            results=[PaletteItem.from_dict(item) for item in data.get("results", [])],
        )

@dataclass
class ContentList:
    kind: str
    count: int
    items: List[PaletteItem]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ContentList":
        return cls(
            kind=data["kind"],
            count=data["count"],
            items=[PaletteItem.from_dict(item) for item in data.get("items", [])],
        )

@dataclass
class NoteMarkdown:
    slug: str
    markdown: str

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NoteMarkdown":
        return cls(
            slug=data["slug"],
            markdown=data["markdown"],
        )

@dataclass
class ApiStatus:
    service: str
    version: str
    api_version: str
    status: str
    mode: str
    rate_limit: Dict[str, Any]
    versioning: Dict[str, Any]
    capabilities: Dict[str, bool]
    links: Dict[str, str]

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ApiStatus":
        return cls(
            service=data["service"],
            version=data["version"],
            api_version=data.get("apiVersion", ""),
            status=data["status"],
            mode=data["mode"],
            rate_limit=data.get("rateLimit", {}),
            versioning=data.get("versioning", {}),
            capabilities=data.get("capabilities", {}),
            links=data.get("links", {}),
        )
