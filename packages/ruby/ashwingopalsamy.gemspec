# frozen_string_literal: true

require_relative "lib/ashwingopalsamy/version"

Gem::Specification.new do |spec|
  spec.name = "ashwingopalsamy"
  spec.version = AshwinGopalsamy::VERSION
  spec.authors = ["Ashwin Gopalsamy"]
  spec.email = ["hello@ashwingopalsamy.in"]

  spec.summary = "Official Ruby gem SDK for Ashwin Gopalsamy's developer API, profile, and notes"
  spec.description = "Official client library for Ashwin Gopalsamy's developer API, technical notes, and search index."
  spec.homepage = "https://ashwingopalsamy.in/developers"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.0.0"

  spec.metadata["homepage_uri"] = "https://ashwingopalsamy.in/developers"
  spec.metadata["source_code_uri"] = "https://github.com/ashwingopalsamy/site"
  spec.metadata["documentation_uri"] = "https://ashwingopalsamy.in/developers"
  spec.metadata["changelog_uri"] = "https://github.com/ashwingopalsamy/site/blob/main/CHANGELOG.md"

  spec.files = Dir["lib/**/*.rb", "README.md", "LICENSE"]
  spec.require_paths = ["lib"]
end
