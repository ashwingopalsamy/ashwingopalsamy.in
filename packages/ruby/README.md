# ashwingopalsamy (Ruby Gem)

Official Ruby gem SDK for Ashwin Gopalsamy's developer API, profile, notes, and search index.

## Installation

Add this line to your application's Gemfile:

```ruby
gem "ashwingopalsamy"
```

Or install it yourself:

```bash
gem install ashwingopalsamy
```

## Quickstart

```ruby
require "ashwingopalsamy"

client = AshwinGopalsamy::Client.new

# Fetch authoritative profile
profile = client.get_profile
puts "#{profile['name']} - #{profile['role']} at #{profile['employer']}"

# Search technical notes
results = client.search_site("rate limiters", limit: 5)
puts "Found #{results['total']} results"

# Get raw note Markdown
note = client.get_note_markdown("designing-rate-limiters-for-payment-systems")
puts note["markdown"]
```

## Documentation

- Developer Portal: [ashwingopalsamy.in/developers](https://ashwingopalsamy.in/developers)
- OpenAPI Specification: [ashwingopalsamy.in/openapi.json](https://ashwingopalsamy.in/openapi.json)

## License

MIT
