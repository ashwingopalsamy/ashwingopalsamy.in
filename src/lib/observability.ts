import { CANONICAL_KNOWLEDGE } from "../data/canonical-knowledge";
import {
  CAPABILITY_PROTOCOL_VERSION,
  CANONICAL_PROMPTS,
  CANONICAL_RESOURCES,
  FIRST_PARTY_TOOL_NAMES,
} from "./canonical-capabilities";

export interface ObservabilityReport {
  timestamp: string;
  service: string;
  version: string;
  manifestType: "capability_manifest_and_build_verification";
  declared: {
    searchAeo: {
      googleSearchConsole: {
        status: "unconfigured_or_pending_rollout" | "configured";
        generativeAiReportsSupported: boolean;
        note: string;
      };
      canonicalization: {
        canonicalOrigin: string;
        trailingSlashCanonical: boolean;
        entityIds: {
          person: string;
          website: string;
        };
      };
    };
    aiDiscovery: {
      crawlersWelcomed: string[];
      scrapersBlocked: string[];
      contentSignal: string;
      oaiSearchBotAllowed: boolean;
      attributionRequired: boolean;
      contact: string;
    };
    agentProtocols: {
      webmcp: {
        supportedContexts: string[];
        firstPartyTools: readonly string[];
        cloudflareC2paSeparation: boolean;
        registrationMode: "async_with_gettools_dedup";
      };
      mcp: {
        protocolVersion: string;
        transport: string;
        endpoint: string;
        firstPartyToolsCount: number;
        resourcesCount: number;
        promptsCount: number;
        mode: "read_only_stateless";
      };
      a2a: {
        endpoint: string;
        mode: "read_only_deterministic";
      };
    };
    contentIntegrity: {
      sitemapLastmodSemantic: boolean;
      markdownNegotiationSupported: boolean;
    };
  };
  /** Backward-compatible alias */
  declaredCapabilities: ObservabilityReport["declared"];
  measuredAtBuild: {
    evaluator: string;
    source: "static_build_manifest" | "runtime_eval";
    deterministicBenchmarkAvailable: boolean;
    modelBenchmarkAvailable: boolean;
  };
  /** Backward-compatible alias */
  measuredEvaluation: ObservabilityReport["measuredAtBuild"];
  runtime: {
    status: "operational";
    deploymentCanaryScript: string;
    runtimeVerification: string;
    telemetryModel: {
      store: "cloudflare_analytics_engine";
      binding: "SITE_TELEMETRY";
      access: "private_edge_only";
    };
  };
}

export function getObservabilitySnapshot(): ObservabilityReport {
  const declared = {
    searchAeo: {
      googleSearchConsole: {
        status: "unconfigured_or_pending_rollout" as const,
        generativeAiReportsSupported: false,
        note: "Google Search Console / SGE API adapter gracefully reports unconfigured when no server credentials are provided in build/client environment.",
      },
      canonicalization: {
        canonicalOrigin: CANONICAL_KNOWLEDGE.origin,
        trailingSlashCanonical: true,
        entityIds: {
          person: CANONICAL_KNOWLEDGE.personId,
          website: CANONICAL_KNOWLEDGE.webSiteId,
        },
      },
    },
    aiDiscovery: {
      crawlersWelcomed: [
        "Googlebot",
        "Bingbot",
        "DuckDuckBot",
        "Applebot",
        "Applebot-Extended",
        "GPTBot",
        "OAI-SearchBot",
        "ChatGPT-User",
        "Claude-Web",
        "ClaudeBot",
        "Claude-SearchBot",
        "Google-Extended",
        "GoogleOther",
        "PerplexityBot",
        "Perplexity-User",
      ],
      scrapersBlocked: ["Bytespider", "CCBot"],
      contentSignal: "ai-train=yes, search=yes, ai-input=yes",
      oaiSearchBotAllowed: true,
      attributionRequired: true,
      contact: CANONICAL_KNOWLEDGE.email,
    },
    agentProtocols: {
      webmcp: {
        supportedContexts: [
          "document.modelContext",
          "navigator.modelContext",
          "window.modelContext",
        ],
        firstPartyTools: FIRST_PARTY_TOOL_NAMES,
        cloudflareC2paSeparation: true,
        registrationMode: "async_with_gettools_dedup" as const,
      },
      mcp: {
        protocolVersion: CAPABILITY_PROTOCOL_VERSION,
        transport: "streamable-http",
        endpoint: `${CANONICAL_KNOWLEDGE.origin}/mcp`,
        firstPartyToolsCount: FIRST_PARTY_TOOL_NAMES.length,
        resourcesCount: CANONICAL_RESOURCES.length,
        promptsCount: Object.keys(CANONICAL_PROMPTS).length,
        mode: "read_only_stateless" as const,
      },
      a2a: {
        endpoint: `${CANONICAL_KNOWLEDGE.origin}/a2a`,
        mode: "read_only_deterministic" as const,
      },
    },
    contentIntegrity: {
      sitemapLastmodSemantic: true,
      markdownNegotiationSupported: true,
    },
  };

  const measuredAtBuild = {
    evaluator: "tests/agent-eval.test.ts + scripts/agent-eval-*.mjs",
    source: "static_build_manifest" as const,
    deterministicBenchmarkAvailable: true,
    modelBenchmarkAvailable: true,
  };

  return {
    timestamp: new Date().toISOString(),
    service: "ashwingopalsamy.in declared capabilities & telemetry",
    version: "1.0.0",
    manifestType: "capability_manifest_and_build_verification",
    declared,
    declaredCapabilities: declared,
    measuredAtBuild,
    measuredEvaluation: measuredAtBuild,
    runtime: {
      status: "operational",
      deploymentCanaryScript: "scripts/verify-deployment.mjs",
      runtimeVerification: "Synthetic edge probes verify live endpoint SHA and protocol responses.",
      telemetryModel: {
        store: "cloudflare_analytics_engine",
        binding: "SITE_TELEMETRY",
        access: "private_edge_only",
      },
    },
  };
}
