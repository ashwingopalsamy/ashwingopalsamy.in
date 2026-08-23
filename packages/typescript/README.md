# @ashwingopalsamy/sdk

Official TypeScript/JavaScript SDK for Ashwin Gopalsamy's developer API, profile, notes, and search index.

## Installation

```bash
npm install @ashwingopalsamy/sdk
```

## Quickstart

```typescript
import { AshwinGopalsamyClient } from "@ashwingopalsamy/sdk";

const client = new AshwinGopalsamyClient();

// Fetch authoritative profile
const profile = await client.getProfile();
console.log(`${profile.name} - ${profile.role} at ${profile.employer}`);

// Search technical notes and projects
const search = await client.searchSite("rate limiters", 5);
console.log(`Found ${search.total} results`);

// List published notes
const notes = await client.listContent("note", 10);

// Get raw note Markdown
const note = await client.getNoteMarkdown("designing-rate-limiters-for-payment-systems");
console.log(note.markdown);
```

## Documentation

- Developer Portal: [ashwingopalsamy.in/developers](https://ashwingopalsamy.in/developers)
- OpenAPI Specification: [ashwingopalsamy.in/openapi.json](https://ashwingopalsamy.in/openapi.json)

## License

MIT
