# ashwingopalsamy (Go SDK)

Official Go module SDK for Ashwin Gopalsamy's developer API, profile, notes, and search index.

## Installation

```bash
go get github.com/ashwingopalsamy/ashwingopalsamy.in/packages/go
```

## Quickstart

```go
package main

import (
	"context"
	"fmt"
	"log"

	ashwingopalsamy "github.com/ashwingopalsamy/ashwingopalsamy.in/packages/go"
)

func main() {
	client := ashwingopalsamy.NewClient()
	ctx := context.Background()

	// Fetch authoritative profile
	profile, err := client.GetProfile(ctx)
	if err != nil {
		log.Fatalf("failed to fetch profile: %v", err)
	}
	fmt.Printf("%s - %s at %s\n", profile.Name, profile.Role, profile.Employer)

	// Search technical notes
	results, err := client.SearchSite(ctx, "rate limiters", 5)
	if err != nil {
		log.Fatalf("search failed: %v", err)
	}
	fmt.Printf("Found %d results\n", results.Total)

	// Get raw note Markdown
	note, err := client.GetNoteMarkdown(ctx, "designing-rate-limiters-for-payment-systems")
	if err != nil {
		log.Fatalf("failed to get note: %v", err)
	}
	fmt.Println(note.Markdown)
}
```

## Documentation

- Developer Portal: [ashwingopalsamy.in/developers](https://ashwingopalsamy.in/developers)
- OpenAPI Specification: [ashwingopalsamy.in/openapi.json](https://ashwingopalsamy.in/openapi.json)

## License

MIT
