// Package ashwingopalsamy provides the official Go SDK for Ashwin Gopalsamy's developer API.
//
// Homepage: https://ashwingopalsamy.in/developers
// Documentation: https://ashwingopalsamy.in/developers
// OpenAPI Spec: https://ashwingopalsamy.in/openapi.json
package ashwingopalsamy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is the authoritative public endpoint for Ashwin Gopalsamy's site.
	DefaultBaseURL = "https://ashwingopalsamy.in"
	// UserAgent identifies the Go SDK client.
	UserAgent = "ashwingopalsamy-go-sdk/1.0.0"
)

// APIError represents an error response from the API.
type APIError struct {
	StatusCode     int
	Message        string
	Code           string
	ResolutionHint string
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("ashwingopalsamy api error (status %d, code %s): %s", e.StatusCode, e.Code, e.Message)
	}
	return fmt.Sprintf("ashwingopalsamy api error (status %d): %s", e.StatusCode, e.Message)
}

// Client interacts with Ashwin Gopalsamy's REST and discovery APIs.
type Client struct {
	baseURL    string
	httpClient *http.Client
	userAgent  string
}

// Option configures a Client.
type Option func(*Client)

// WithBaseURL overrides the default base URL.
func WithBaseURL(rawURL string) Option {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(rawURL, "/")
	}
}

// WithHTTPClient overrides the default HTTP client.
func WithHTTPClient(httpClient *http.Client) Option {
	return func(c *Client) {
		c.httpClient = httpClient
	}
}

// WithUserAgent overrides the default user agent.
func WithUserAgent(userAgent string) Option {
	return func(c *Client) {
		c.userAgent = userAgent
	}
}

// NewClient returns a new Ashwin Gopalsamy API client.
func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL: DefaultBaseURL,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		userAgent: UserAgent,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) doRequest(ctx context.Context, path string, query url.Values, v any) error {
	reqURL := c.baseURL + path
	if len(query) > 0 {
		reqURL += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var prob ProblemDetails
		if err := json.Unmarshal(bodyBytes, &prob); err == nil && prob.Title != "" {
			msg := prob.Detail
			if msg == "" {
				msg = prob.Title
			}
			return &APIError{
				StatusCode:     resp.StatusCode,
				Message:        msg,
				Code:           prob.Code,
				ResolutionHint: prob.ResolutionHint,
			}
		}
		return &APIError{
			StatusCode: resp.StatusCode,
			Message:    string(bodyBytes),
		}
	}

	if err := json.Unmarshal(bodyBytes, v); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

// GetProfile retrieves the authoritative profile summary and career history.
func (c *Client) GetProfile(ctx context.Context) (*ProfileSummary, error) {
	var profile ProfileSummary
	if err := c.doRequest(ctx, "/api/v1/profile", nil, &profile); err != nil {
		return nil, err
	}
	return &profile, nil
}

// SearchSite searches technical notes, craft projects, and reading list items.
func (c *Client) SearchSite(ctx context.Context, query string, limit int) (*SearchResults, error) {
	q := make(url.Values)
	if query != "" {
		q.Set("query", query)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var results SearchResults
	if err := c.doRequest(ctx, "/api/v1/search", q, &results); err != nil {
		return nil, err
	}
	return &results, nil
}

// ListContent lists catalog items filtered by kind (all, note, craft, book, watch, article).
func (c *Client) ListContent(ctx context.Context, kind string, limit int) (*ContentList, error) {
	q := make(url.Values)
	if kind != "" {
		q.Set("kind", kind)
	}
	if limit > 0 {
		q.Set("limit", strconv.Itoa(limit))
	}
	var list ContentList
	if err := c.doRequest(ctx, "/api/v1/content", q, &list); err != nil {
		return nil, err
	}
	return &list, nil
}

// GetNoteMarkdown retrieves the raw markdown body and metadata for a published note.
func (c *Client) GetNoteMarkdown(ctx context.Context, slug string) (*NoteMarkdown, error) {
	path := "/api/v1/notes/" + url.PathEscape(slug)
	var note NoteMarkdown
	if err := c.doRequest(ctx, path, nil, &note); err != nil {
		return nil, err
	}
	return &note, nil
}

// GetStatus checks operational status, rate limits, and capabilities.
func (c *Client) GetStatus(ctx context.Context) (*ApiStatus, error) {
	var status ApiStatus
	if err := c.doRequest(ctx, "/api/v1/status", nil, &status); err != nil {
		return nil, err
	}
	return &status, nil
}
