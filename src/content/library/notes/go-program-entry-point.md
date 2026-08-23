---
title: "What Happens Before main() in Go"
date: 2024-12-13
tags: ["go"]
description: "The Go runtime bootstrap sequence from _rt0_go and schedinit to topological package init execution."
---

Before the first line of your `main.main()` function executes, the Go runtime performs a multi-stage bootstrap sequence: detecting CPU hardware capabilities, setting up memory allocators, initializing logical processors, and executing package initializations in topological dependency order.

## The Bootstrap Execution Chain

When an operating system loads a compiled Go ELF or Mach-O binary, execution starts at the architecture-specific assembly entry point:

```mermaid
sequenceDiagram
    participant OS as Operating System Loader
    participant ASM as _rt0_amd64 / _rt0_arm64
    participant RT as runtime.rt0_go / schedinit
    participant MainG as Main Goroutine (runtime.main)
    participant User as main.main()

    OS->>ASM: Transfer control to binary entry point
    ASM->>RT: Setup g0 stack & m0 (main OS thread)
    RT->>RT: runtime.schedinit (Memory, GC, GOMAXPROCS)
    RT->>MainG: runtime.newproc -> Spawns Main Goroutine
    RT->>RT: runtime.mstart (Enter scheduler loop)
    MainG->>MainG: runtime.gcenable & Start sysmon thread
    MainG->>MainG: Execute package inittask graph in dependency order
    MainG->>User: Invoke main.main()
```

### Stage 1: CPU Detection and Machine Initialization (`runtime.rt0_go`)
The assembly bootstrap reads `argc` and `argv`, sets up the thread-local storage (`TLS`), determines hardware feature flags (such as AES-NI, AVX-512, or ARM NEON), and links the bootstrap OS thread (`m0`) with the system execution stack (`g0`).

### Stage 2: Subsystem Allocation (`runtime.schedinit`)
`schedinit` initializes all core runtime engines:
- **Memory Allocator** (`mallocinit`): Configures heap spans and thread caches (`mcache`).
- **Garbage Collector** (`gcinit`): Calculates heap pacing parameters and pacing targets.
- **Processors** (`procresize`): Allocates $P$ logical processors matching `GOMAXPROCS`.
- **System Stack**: Initializes stack pools and signal preemption handlers.

### Stage 3: The Main Goroutine (`runtime.main`)
Once the scheduler starts via `runtime.mstart`, the runtime spawns the first official user goroutine executing `runtime.main`. This goroutine starts the background `sysmon` thread, enables garbage collection (`gcenable`), and evaluates the compiler-generated package dependency graph.

## Package Initialization Order (`inittask`)

Go initializes packages strictly in **topological dependency order** (leaf dependencies first). Circular imports are rejected at compile time.

```mermaid
graph TD
    main["main package\n(Initialized last)"]
    Auth["auth package"]
    DB["database package"]
    Config["config package\n(Leaf: Initialized first)"]

    main --> Auth
    main --> DB
    Auth --> DB
    DB --> Config
    Auth --> Config

    class main diag-ingress;
    class Auth,DB diag-compute;
    class Config diag-success;
```

1. **Variables before `init()`**: Within a package, package-level variables are initialized first (evaluating expressions and dependencies).
2. **Lexical order across files**: If a package spans multiple source files, files are processed in **lexical (alphabetical) base name order** as presented to the compiler.
3. **Multiple `init()` functions**: A package can define multiple `init()` functions across several files. They execute sequentially in lexical file order and source code line order.

## Exit Behavior: `return` vs `os.Exit()`

The way a Go application terminates determines whether runtime cleanup occurs:

```mermaid
graph TD
    A["main.main() returns"] --> B["runtime.exit(0)"]
    B --> C["Defers in main run"]
    
    D["os.Exit(1) called"] --> E["Direct syscall: sys_exit"]
    E --> F["No defers execute"]
    E --> G["Buffered file writes lost"]

    class A diag-ingress;
    class B,C diag-success;
    class D diag-warning;
    class E,F,G diag-error;
```

```go
package main

import (
    "fmt"
    "os"
)

func main() {
    defer fmt.Println("Deferred cleanup executed")

    if err := run(); err != nil {
        fmt.Fprintf(os.Stderr, "Fatal error: %v\n", err)
        os.Exit(1) // Bypasses the deferred cleanup above!
    }
}
```

To ensure `defer` statements execute on error paths, structure `main` to return an exit code to a thin runner rather than calling `os.Exit` deep in your application logic.

## Runtime Invariants

1. **`init()` cannot be called manually**: `init` functions have no identifier in package scope and cannot be referenced or invoked by application code.
2. **Main goroutine lock**: The main goroutine is not pinned to `m0` unless explicitly locked with `runtime.LockOSThread()`.
3. **Program termination**: When `main.main()` returns, the runtime immediately terminates the process, even if background goroutines are actively running. Use `sync.WaitGroup` or context cancellation to manage graceful shutdown.
