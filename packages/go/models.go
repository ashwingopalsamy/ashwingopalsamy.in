package ashwingopalsamy

// ProfileLinks holds social and machine links.
type ProfileLinks struct {
	Home   string `json:"home"`
	Ai     string `json:"ai"`
	Design string `json:"design"`
}

// ProfileSummary is the authoritative machine-readable career profile.
type ProfileSummary struct {
	Name            string        `json:"name"`
	Role            string        `json:"role"`
	Employer        string        `json:"employer"`
	Location        string        `json:"location"`
	PrimaryLanguage string        `json:"primaryLanguage"`
	Summary         string        `json:"summary"`
	KnowsAbout      []string      `json:"knowsAbout,omitempty"`
	Links           *ProfileLinks `json:"links,omitempty"`
}

// PaletteItem is an entry in the site's public content manifest.
type PaletteItem struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Title       string   `json:"title"`
	Href        string   `json:"href"`
	Description string   `json:"description,omitempty"`
	Keywords    []string `json:"keywords,omitempty"`
}

// SearchResults contains matches from the site search index.
type SearchResults struct {
	Query   string        `json:"query"`
	Total   int           `json:"total"`
	Results []PaletteItem `json:"results"`
}

// ContentList contains items filtered by content kind.
type ContentList struct {
	Kind  string        `json:"kind"`
	Count int           `json:"count"`
	Items []PaletteItem `json:"items"`
}

// NoteMarkdown represents raw markdown content and metadata for a note.
type NoteMarkdown struct {
	Slug     string `json:"slug"`
	Markdown string `json:"markdown"`
}

// RateLimitInfo describes current rate limit parameters.
type RateLimitInfo struct {
	Limit         int    `json:"limit"`
	WindowSeconds int    `json:"windowSeconds"`
	Policy        string `json:"policy"`
}

// VersioningInfo describes API versioning policy.
type VersioningInfo struct {
	Strategy          string `json:"strategy"`
	Current           string `json:"current"`
	DeprecationPolicy string `json:"deprecationPolicy"`
	SunsetHeader      string `json:"sunsetHeader,omitempty"`
	DeprecationHeader string `json:"deprecationHeader,omitempty"`
}

// ApiStatus holds operational status and capability flags.
type ApiStatus struct {
	Service      string            `json:"service"`
	Version      string            `json:"version"`
	ApiVersion   string            `json:"apiVersion"`
	Status       string            `json:"status"`
	Mode         string            `json:"mode"`
	RateLimit    RateLimitInfo     `json:"rateLimit"`
	Versioning   VersioningInfo    `json:"versioning"`
	Capabilities map[string]bool   `json:"capabilities"`
	Links        map[string]string `json:"links"`
}

// ProblemDetails represents RFC 9457 typed error responses.
type ProblemDetails struct {
	Type           string `json:"type"`
	Title          string `json:"title"`
	Status         int    `json:"status"`
	Detail         string `json:"detail"`
	Code           string `json:"code"`
	ResolutionHint string `json:"resolution_hint"`
	Instance       string `json:"instance,omitempty"`
}
