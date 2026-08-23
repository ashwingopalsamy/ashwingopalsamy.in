# ashwingopalsamy

Official Python SDK for Ashwin Gopalsamy's developer API, profile, notes, and search index.

## Installation

```bash
pip install ashwingopalsamy
```

## Quickstart

```python
from ashwingopalsamy import Client

client = Client()

# Fetch authoritative profile
profile = client.get_profile()
print(f"{profile.name} - {profile.role} at {profile.employer}")

# Search technical notes and projects
search = client.search_site("rate limiters", limit=5)
print(f"Found {search.total} results")
for item in search.results:
    print(f"- {item.title} ({item.href})")

# List published notes
notes = client.list_content(kind="note", limit=10)

# Get raw note Markdown
note = client.get_note_markdown("designing-rate-limiters-for-payment-systems")
print(note.markdown)
```

## Documentation

- Developer Portal: [ashwingopalsamy.in/developers](https://ashwingopalsamy.in/developers)
- OpenAPI Specification: [ashwingopalsamy.in/openapi.json](https://ashwingopalsamy.in/openapi.json)

## License

MIT
