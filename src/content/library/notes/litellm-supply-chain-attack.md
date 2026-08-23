---
title: "Anatomy of a Supply Chain Attack: LiteLLM on PyPI"
date: 2026-03-25
tags: ["security"]
description: "How a compromised LiteLLM package on PyPI reached a Cursor MCP plugin: anatomy of a real supply-chain hit."
---

On March 24, 2026, Callum McMahon at FutureSearch was testing a Cursor MCP plugin that pulled in litellm as a transitive dependency. Shortly after, his machine became unresponsive. He traced it to a newly installed litellm package.

## What Is LiteLLM?

LiteLLM is a Python library that works like a universal remote for AI APIs. 95 million downloads per month on PyPI. ~40,000 GitHub stars.

## The Attack Chain

```mermaid
sequenceDiagram
    participant A as Attacker (TeamPCP)
    participant T as Trivy GitHub Repo
    participant CI as LiteLLM CI (GitHub Actions)
    participant P as PyPI Registry

    Note over A,T: March 1 - Initial Compromise
    A->>T: Submit malicious PR (Pwn Request)
    T-->>A: CI leaks personal access token
    Note over CI,P: March 24 - Package Takeover
    CI->>T: Pull trivy-action@latest (not pinned to SHA)
    T-->>CI: Serve compromised action
    CI-->>A: Leak PyPI publisher token
    A->>P: Publish litellm v1.82.7 (inline payload)
    A->>P: Publish litellm v1.82.8 (.pth persistence)
```

```mermaid
graph LR
    A["Trivy Repo\n(compromised)"] --> B["GitHub Bot Army"]
    B --> C["PyPI Account Takeover"]
    C --> D["LiteLLM v1.82.7 / v1.82.8"]
    D --> E[".pth Backdoor"]
    E --> F["Credential Harvest"]
    F --> G["Exfil Server (ICP Canister)"]

    class A,D,E diag-compromised;
    class B,C diag-warning;
    class F diag-slow;
    class G diag-error;
```

## What the Malware Does

The payload was triple-nested: a base64 blob decodes to an orchestrator script, which decodes a second base64 blob containing the harvester.

```mermaid
graph TD
    ROOT[".pth Backdoor"]
    ROOT --> ENV["ENV Variables"]
    ROOT --> AWS["~/.aws/credentials"]
    ROOT --> DOTENV[".env Files"]
    ROOT --> PROC["/proc/self/environ"]
    ROOT --> EXFIL["Outbound HTTP Exfil to ICP canister"]
    ENV --> EXFIL
    AWS --> EXFIL
    DOTENV --> EXFIL
    PROC --> EXFIL

    class ROOT diag-compromised;
    class ENV,AWS,DOTENV,PROC diag-warning;
    class EXFIL diag-error;
```

Two versions were published:
- v1.82.7: injected payload at line 128 of `litellm/proxy/proxy_server.py`
- v1.82.8: added a `.pth` file that executes every time Python starts

> `.pth` files in `site-packages` execute code before your application begins, on every Python invocation: pytest, IDE language server, even pip install.

## Check Your Environment

```bash
ls ~/.config/sysmon/sysmon.py 2>/dev/null && echo "BACKDOOR FOUND"
find $(python3 -c "import site; print(' '.join(site.getsitepackages()))") \
  -name "litellm_init.pth" 2>/dev/null
```

> If anything shows up, upgrading the package is not enough. Rotate all LLM provider API keys, cloud credentials, GitHub and PyPI tokens, CI/CD secrets, and SSH keys. Rebuild from known-good images. The last known-clean version is 1.82.6.
