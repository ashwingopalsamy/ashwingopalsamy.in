# frozen_string_literal: true

require "net/http"
require "json"
require "uri"

module AshwinGopalsamy
  class Error < StandardError
    attr_reader :status_code, :code, :resolution_hint

    def initialize(message, status_code: 500, code: nil, resolution_hint: nil)
      super(message)
      @status_code = status_code
      @code = code
      @resolution_hint = resolution_hint
    end
  end

  class Client
    DEFAULT_BASE_URL = "https://ashwingopalsamy.in"

    def initialize(base_url: DEFAULT_BASE_URL, user_agent: "ashwingopalsamy-ruby-sdk/#{AshwinGopalsamy::VERSION}")
      @base_url = base_url.chomp("/")
      @user_agent = user_agent
    end

    # Fetch authoritative profile summary and career facts.
    def get_profile
      request("/api/v1/profile")
    end

    # Search published technical notes, craft projects, and reading list.
    def search_site(query = nil, limit: 10)
      params = {}
      params[:query] = query if query
      params[:limit] = limit if limit
      request("/api/v1/search", params)
    end

    # List public entries filtered by kind (all, note, craft, book, watch, article).
    def list_content(kind: "all", limit: 20)
      request("/api/v1/content", { kind: kind, limit: limit })
    end

    # Retrieve raw Markdown content and metadata for a published note.
    def get_note_markdown(slug)
      request("/api/v1/notes/#{URI.encode_www_form_component(slug)}")
    end

    # Check API operational status and capabilities.
    def get_status
      request("/api/v1/status")
    end

    private

    def request(path, params = {})
      uri = URI("#{@base_url}#{path}")
      if params && !params.empty?
        uri.query = URI.encode_www_form(params.compact)
      end

      req = Net::HTTP::Get.new(uri)
      req["Accept"] = "application/json"
      req["User-Agent"] = @user_agent

      response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == "https") do |http|
        http.request(req)
      end

      body = response.body
      parsed = begin
        JSON.parse(body)
      rescue JSON::ParserError
        nil
      end

      unless response.is_a?(Net::HTTPSuccess)
        msg = parsed&.dig("detail") || parsed&.dig("message") || parsed&.dig("title") || "HTTP #{response.code}: #{response.message}"
        raise Error.new(
          msg,
          status_code: response.code.to_i,
          code: parsed&.dig("code"),
          resolution_hint: parsed&.dig("resolution_hint")
        )
      end

      parsed
    end
  end
end
