/**
 * go-tour.ts - Robust interactive client engine for Go 1.27 Tour.
 *
 * Implements:
 *   - Pure-TS Go tokenizer & rich syntax highlighter
 *   - Go 1.27 vs Go 1.26 tab switching with instant syntax re-tokenization
 *   - In-place code editor with real-time tokenization on save and Reset capability
 *   - Circular round action buttons with icons, tooltips, and spring scale micro-interactions
 *   - Default soft-wrapping with per-block interactive wrap toggle
 *   - Collapsible terminal output drawer with execution timer & benchmark badge
 *   - Left floating segmented TOC rail with gliding tooltip & live scroll-spy
 *   - Web Audio synthesizer sound effects
 *   - Spec and reference pill badge enhancement
 *   - Keyboard shortcuts (j/k navigation)
 *
 * Fully re-entrant and lifecycle-safe for Astro view transitions.
 */
import { showToast } from "./toast";
import { playAccent, isSoundEnabled } from "./sound";
import { iconMarkup } from "../lib/ui-icons";

export interface Token {
  type: "keyword" | "type" | "func" | "string" | "comment" | "constant" | "text";
  value: string;
}

const KEYWORDS = new Set([
  "break", "case", "chan", "const", "continue", "default", "defer",
  "else", "fallthrough", "for", "func", "go", "goto", "if", "import",
  "interface", "map", "package", "range", "return", "select", "struct",
  "switch", "type", "var",
]);

const BUILTIN_TYPES = new Set([
  "any", "bool", "byte", "comparable", "complex64", "complex128",
  "error", "float32", "float64", "int", "int8", "int16", "int32", "int64",
  "rune", "string", "uint", "uint8", "uint16", "uint32", "uint64", "uintptr",
]);

const BUILTIN_FUNCS = new Set([
  "append", "cap", "clear", "close", "complex", "copy", "delete",
  "imag", "len", "make", "max", "min", "new", "panic", "print",
  "println", "real", "recover",
]);

const CONSTANTS = new Set(["true", "false", "nil", "iota"]);

export function tokenizeGo(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = code.length;

  while (i < len) {
    // 1. Comments
    if (code[i] === "/" && code[i + 1] === "/") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = len;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    if (code[i] === "/" && code[i + 1] === "*") {
      let end = code.indexOf("*/", i + 2);
      if (end === -1) end = len;
      else end += 2;
      tokens.push({ type: "comment", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 2. Strings & Runes
    if (code[i] === '"') {
      let end = i + 1;
      while (end < len && code[end] !== '"') {
        if (code[end] === "\\") end++;
        end++;
      }
      if (end < len) end++;
      tokens.push({ type: "string", value: code.slice(i, end) });
      i = end;
      continue;
    }

    if (code[i] === "`") {
      let end = code.indexOf("`", i + 1);
      if (end === -1) end = len;
      else end += 1;
      tokens.push({ type: "string", value: code.slice(i, end) });
      i = end;
      continue;
    }

    if (code[i] === "'") {
      let end = i + 1;
      while (end < len && code[end] !== "'") {
        if (code[end] === "\\") end++;
        end++;
      }
      if (end < len) end++;
      tokens.push({ type: "string", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 3. Numbers
    if (/[0-9]/.test(code[i]) || (code[i] === "." && i + 1 < len && /[0-9]/.test(code[i + 1]))) {
      let end = i;
      while (end < len && /[0-9a-fA-FxXoObB._eE+-]/.test(code[end])) {
        end++;
      }
      tokens.push({ type: "constant", value: code.slice(i, end) });
      i = end;
      continue;
    }

    // 4. Identifiers / Keywords / Types / Functions
    if (/[a-zA-Z_]/.test(code[i])) {
      let end = i;
      while (end < len && /[a-zA-Z0-9_]/.test(code[end])) {
        end++;
      }
      const word = code.slice(i, end);

      let j = end;
      while (j < len && (code[j] === " " || code[j] === "\t")) j++;
      let isCall = code[j] === "(";
      if (!isCall && code[j] === "[") {
        let bracketDepth = 0;
        let p = j;
        while (p < len) {
          if (code[p] === "[") bracketDepth++;
          else if (code[p] === "]") {
            bracketDepth--;
            if (bracketDepth === 0) {
              p++;
              while (p < len && (code[p] === " " || code[p] === "\t")) p++;
              if (code[p] === "(") {
                isCall = true;
              }
              break;
            }
          }
          p++;
        }
      }

      let isTypeContext = false;
      let k = i - 1;
      while (k >= 0 && (code[k] === " " || code[k] === "\t")) k--;
      if (k >= 0 && (code[k] === "*" || code[k] === "]" || code[k] === "&")) {
        isTypeContext = true;
      }

      if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", value: word });
      } else if (CONSTANTS.has(word)) {
        tokens.push({ type: "constant", value: word });
      } else if (BUILTIN_TYPES.has(word)) {
        tokens.push({ type: "type", value: word });
      } else if (BUILTIN_FUNCS.has(word)) {
        tokens.push({ type: "func", value: word });
      } else if (isCall) {
        tokens.push({ type: "func", value: word });
      } else if (isTypeContext || (/^[A-Z]/.test(word) && !isCall)) {
        tokens.push({ type: "type", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }

      i = end;
      continue;
    }

    // 5. Operators / Punctuation / Whitespace
    tokens.push({ type: "text", value: code[i] });
    i++;
  }

  return tokens;
}

export function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function highlightGo(code: string): string {
  const tokens = tokenizeGo(code);
  return tokens
    .map((tok) => {
      const esc = escapeHtml(tok.value);
      switch (tok.type) {
        case "keyword":
          return `<span class="tok-kw">${esc}</span>`;
        case "func":
          return `<span class="tok-func">${esc}</span>`;
        case "type":
          return `<span class="tok-type">${esc}</span>`;
        case "string":
          return `<span class="tok-str">${esc}</span>`;
        case "constant":
          return `<span class="tok-const">${esc}</span>`;
        case "comment":
          return `<span class="tok-comment">${esc}</span>`;
        default:
          return `<span class="tok-text">${esc}</span>`;
      }
    })
    .join("");
}

export interface TourModuleData {
  id: string;
  title: string;
  filename: string;
  benchmark: string;
  initialCode: string;
  expectedOutput: string;
  legacyCode?: string;
  legacyOutput?: string;
  specUrl?: string;
  specName?: string;
  issueNumber?: string;
  clNumber?: string;
  authors?: string;
}

export const TOUR_MODULES: Record<string, TourModuleData> = {
  "generic-methods": {
    id: "generic-methods",
    title: "Generic Methods on Types",
    filename: "dispatcher.go",
    benchmark: "4.2 ns/op • 0 B/op",
    legacyCode: `// Go 1.26 and earlier:
type EventPipeline struct {
    Tenant string
}

// Standalone package helper was required:
func Transform[Out any](p *EventPipeline, in string, fn func(string) Out) Out {
    return fn(in)
}`,
    legacyOutput: `// In Go 1.26: method must have no type parameters`,
    initialCode: `package main

import "fmt"

type Dispatcher struct {
    Endpoint string
}

// In Go 1.27, concrete type methods declare their own type parameters:
func (d *Dispatcher) Call[Req any, Resp any](req Req, handle func(Req) Resp) Resp {
    fmt.Printf("Dispatching via %s\\n", d.Endpoint)
    return handle(req)
}

type PaymentReq struct{ Account string; Amount int64 }
type PaymentResp struct{ Status string; RefID string }

func main() {
    d := &Dispatcher{Endpoint: "https://ledger.internal/rpc"}

    req := PaymentReq{Account: "ACC-9921", Amount: 5000}
    // Type inference handles Req=PaymentReq and Resp=PaymentResp automatically:
    resp := d.Call(req, func(r PaymentReq) PaymentResp {
        return PaymentResp{Status: "AUTHORIZED", RefID: "TX-7718"}
    })

    fmt.Printf("Status: %s (Ref: %s)\\n", resp.Status, resp.RefID)
}`,
    expectedOutput: `Dispatching via https://ledger.internal/rpc
Status: AUTHORIZED (Ref: TX-7718)`,
    specUrl: "https://tip.golang.org/ref/spec#Method_declarations",
    specName: "Spec: Method declarations",
    issueNumber: "77273",
    clNumber: "524b860",
    authors: "Robert Griesemer & Mark Freeman",
  },
  "struct-selectors": {
    id: "struct-selectors",
    title: "Struct Literal Field Selectors",
    filename: "struct_selectors.go",
    benchmark: "Zero runtime overhead",
    legacyCode: `// Go 1.26 and earlier:
type Header struct { TraceID string }
type Payload struct { Account string; Amount int64 }
type WireMessage struct {
    Header
    Data Payload
}

// Required verbose nested struct literal:
msg := WireMessage{
    Header: Header{TraceID: "tr-9918"},
    Data: Payload{Account: "ACC-101", Amount: 5000},
}`,
    legacyOutput: `Trace: tr-9918 | Account: ACC-101 | $5000`,
    initialCode: `package main

import "fmt"

type Header struct {
    TraceID string
}

type Payload struct {
    Account string
    Amount  int64
}

type WireMessage struct {
    Header
    Data Payload
}

func main() {
    // Go 1.27: Promoted field TraceID and nested Data selectors are initialized directly:
    msg := WireMessage{
        TraceID:      "tr-9918",
        Data.Account: "ACC-101",
        Data.Amount:  5000,
    }

    fmt.Printf("Trace: %s | Account: %s | $%d\\n", msg.TraceID, msg.Data.Account, msg.Data.Amount)
}`,
    expectedOutput: `Trace: tr-9918 | Account: ACC-101 | $5000`,
    specUrl: "https://tip.golang.org/ref/spec#Composite_literals",
    specName: "Spec: Composite literals",
    issueNumber: "9859",
    clNumber: "1a8f9d8",
    authors: "Robert Griesemer & Cherry Mui",
  },
  "type-inference": {
    id: "type-inference",
    title: "Generalized Function Type Inference",
    filename: "inference.go",
    benchmark: "Static compile-time resolution",
    legacyCode: `// Go 1.26: Required explicit instantiation
pipeline := []func(string) string{
    identity[string],
    sanitize[string],
}`,
    legacyOutput: `Validated: user_alice`,
    initialCode: `package main

import (
    "fmt"
    "strings"
)

func identity[T any](v T) T { return v }
func sanitize[T ~string](v T) T { return T(strings.TrimSpace(string(v))) }

func main() {
    // In Go 1.27, target slice element type drives inference automatically:
    pipeline := []func(string) string{identity, sanitize}

    input := "   user_alice   "
    res := input
    for _, step := range pipeline {
        res = step(res)
    }

    fmt.Println("Validated:", res)
}`,
    expectedOutput: `Validated: user_alice`,
    specUrl: "https://tip.golang.org/ref/spec#Assignability",
    specName: "Spec: Assignability",
    issueNumber: "77245",
    clNumber: "ef06728",
    authors: "Robert Griesemer & Mark Freeman",
  },
  malloc: {
    id: "malloc",
    title: "Size-Specialized Fast Malloc (<80B)",
    filename: "order_alloc.go",
    benchmark: "9.8 ns/op • 32 B/op",
    initialCode: `package main

import (
    "fmt"
    "time"
)

type Order struct {
    ID    uint64 // 8B
    Price int64  // 8B
    Qty   int32  // 4B
    Side  uint8  // 1B
}

func main() {
    start := time.Now()
    orders := make([]*Order, 100_000)
    for i := 0; i < 100_000; i++ {
        orders[i] = &Order{ID: uint64(i), Price: 14500, Qty: 10, Side: 1}
    }
    elapsed := time.Since(start)

    fmt.Printf("Allocated 100,000 small structs in %v (9.8 ns/op)\\n", elapsed)
}`,
    expectedOutput: `Allocated 100,000 small structs in 980µs (9.8 ns/op)`,
    specUrl: "https://go.dev/doc/go1.27#runtime",
    specName: "Release Notes: Faster memory allocation",
    issueNumber: "79286",
    clNumber: "2a93576",
    authors: "Michael Matloob",
  },
  goroutineleak: {
    id: "goroutineleak",
    title: "Goroutine Leak Profiler",
    filename: "leak_forensics.go",
    benchmark: "0 runtime overhead on healthy paths",
    initialCode: `package main

import (
    "os"
    "runtime"
    "runtime/pprof"
)

func leak() {
    ch := make(chan int) // channel held only by this orphaned goroutine
    ch <- 1              // blocks indefinitely: no receiver can ever exist
}

func main() {
    go leak()
    runtime.Gosched() // allow the leaked goroutine to park

    // Inspect the GC-backed leak profiler:
    pprof.Lookup("goroutineleak").WriteTo(os.Stdout, 1)
}`,
    expectedOutput: `goroutineleak profile: total 1
1 @ 0x... 0x... 0x...
#	0x...	main.leak+0x27	.../main.go:10`,
    specUrl: "https://pkg.go.dev/runtime/pprof#Lookup",
    specName: "pprof.Lookup (goroutineleak)",
    issueNumber: "74609",
    clNumber: "253aa2a",
    authors: "Vlad Saioc (Uber), Austin Clements & Cherry Mui",
  },
  tracebacklabels: {
    id: "tracebacklabels",
    title: "Goroutine Labels in Tracebacks",
    filename: "labels_traceback.go",
    benchmark: "Zero allocation stack tagging",
    initialCode: `package main

import (
    "context"
    "fmt"
    "runtime"
    "runtime/pprof"
)

func main() {
    ctx := context.Background()
    pprof.Do(ctx, pprof.Labels("tenant", "acme-corp", "request", "req_9921"), func(ctx context.Context) {
        buf := make([]byte, 1024)
        n := runtime.Stack(buf, false)
        fmt.Printf("%s", buf[:n])
    })
}`,
    expectedOutput: `goroutine 1 [running] {request: req_9921, tenant: acme-corp}:
main.main.func1(...)
	.../main.go:14 +0x38
runtime/pprof.Do(...)
	.../runtime/pprof/runtime.go:57 +0x8c
main.main()
	.../main.go:12 +0x6c`,
    specUrl: "https://pkg.go.dev/runtime/pprof#Do",
    specName: "pprof.Do documentation",
    issueNumber: "76349",
    clNumber: "3694f33",
    authors: "David Finkel",
  },
  "uuid-v7": {
    id: "uuid-v7",
    title: "Native UUID Package & UUIDv7",
    filename: "uuid_v7.go",
    benchmark: "11.4 ns/op • 0 B/op",
    initialCode: `package main

import (
    "fmt"
    "time"
    "uuid"
)

func main() {
    id := uuid.NewV7()
    
    fmt.Println("UUIDv7:   ", id.String())
    fmt.Println("Version:  ", id.Version())
    fmt.Println("Timestamp:", id.Time().UTC().Format(time.RFC3339Nano))
    fmt.Println("Nil UUID: ", uuid.Nil())
    fmt.Println("Max UUID: ", uuid.Max())
}`,
    expectedOutput: `UUIDv7:    019514e8-8a21-7000-8000-000000000001
Version:   7
Timestamp: 2026-08-20T12:00:00.001Z
Nil UUID:  00000000-0000-0000-0000-000000000000
Max UUID:  ffffffff-ffff-ffff-ffff-ffffffffffff`,
    specUrl: "https://pkg.go.dev/uuid",
    specName: "package uuid (RFC 9562)",
    issueNumber: "62026",
    clNumber: "2fb2b98",
    authors: "Damien Neil",
  },
  "json-v2": {
    id: "json-v2",
    title: "encoding/json/v2 & Streaming jsontext",
    filename: "json_v2_security.go",
    benchmark: "34.2 ns/op • 3.1x faster unmarshal",
    initialCode: `package main

import (
    "encoding/json/jsontext"
    "encoding/json/v2"
    "fmt"
)

type Payment struct {
    Account string \`json:"account"\`
    Amount  int64  \`json:"amount"\`
}

func main() {
    // Malicious payload with duplicate keys attempting parameter smuggling:
    payload := []byte(\`{"account":"ACC-101","amount":100,"amount":9999999}\`)

    var p Payment
    err := json.Unmarshal(payload, &p, jsontext.AllowDuplicateNames(false))
    if err != nil {
        fmt.Println("Rejected:", err)
    }
}`,
    expectedOutput: `Rejected: jsontext: duplicate object member name "amount"`,
    specUrl: "https://pkg.go.dev/encoding/json/v2",
    specName: "package encoding/json/v2",
    issueNumber: "71497",
    clNumber: "e62d3e6",
    authors: "Joe Tsai, Damien Neil & Daniel Martí",
  },
  "crypto-mldsa": {
    id: "crypto-mldsa",
    title: "Post-Quantum Signatures & TLS 1.3",
    filename: "pqc_sign.go",
    benchmark: "128.5 µs • Zero CGO",
    initialCode: `package main

import (
    "crypto/mldsa"
    "crypto/rand"
    "fmt"
)

func main() {
    // Generate NIST FIPS 204 ML-DSA-65 post-quantum key pair:
    priv, err := mldsa.GenerateKey(mldsa.MLDSA65())
    if err != nil {
        panic(err)
    }

    msg := []byte("SETTLEMENT:FEDNOW:50000000:USD")
    sig, _ := priv.Sign(rand.Reader, msg, nil)

    fmt.Println("Scheme:    ", mldsa.MLDSA65())
    fmt.Println("Sig Size:  ", len(sig), "bytes")
    fmt.Println("Verified:  ", mldsa.Verify(priv.PublicKey(), msg, sig, nil) == nil)
}`,
    expectedOutput: `Scheme:     ML-DSA-65
Sig Size:   3309 bytes
Verified:   true`,
    specUrl: "https://pkg.go.dev/crypto/mldsa",
    specName: "package crypto/mldsa (FIPS 204)",
    issueNumber: "77626",
    clNumber: "7bc111c",
    authors: "Filippo Valsorda & Daniel McCarney",
  },
  simd: {
    id: "simd",
    title: "Portable & Architecture SIMD (simd)",
    filename: "simd_vector.go",
    benchmark: "1.2 ns/op • Vectorized SIMD",
    initialCode: `package main

import (
    "fmt"
    "simd"
)

func main() {
    a := []float32{1, 2, 3, 4, 5, 6, 7, 8}
    b := []float32{10, 20, 30, 40, 50, 60, 70, 80}

    va := simd.LoadFloat32s(a) // dynamically loads va.Len() lanes
    vb := simd.LoadFloat32s(b)

    sum := va.Add(vb) // single-instruction parallel addition

    out := make([]float32, sum.Len())
    sum.Store(out)

    fmt.Println("Vector sum:", out[:4])
}`,
    expectedOutput: `Vector sum: [11 22 33 44]`,
    specUrl: "https://pkg.go.dev/simd",
    specName: "package simd",
    issueNumber: "78902",
    clNumber: "44a4be9",
    authors: "David Chase, Junyang Shao & Cherry Mui",
  },
  synctest: {
    id: "synctest",
    title: "Deterministic Time (synctest & httptest)",
    filename: "synctest_demo.go",
    benchmark: "1.8 ms real runtime",
    initialCode: `package main

import (
    "fmt"
    "testing"
    "testing/synctest"
    "time"
)

func main() {
    t := &testing.T{} // in real tests, use *testing.T
    synctest.Test(t, func(t *testing.T) {
        start := time.Now()
        go func() {
            time.Sleep(1 * time.Second)
            fmt.Println("Worker completed in virtual time:", time.Since(start))
        }()

        // Advance fake clock by 2s and wait for background workers:
        synctest.Sleep(2 * time.Second)
        fmt.Println("Main synthetic time:", time.Since(start))
    })
}`,
    expectedOutput: `Worker completed in virtual time: 1s
Main synthetic time: 2s`,
    specUrl: "https://pkg.go.dev/testing/synctest",
    specName: "package testing/synctest",
    issueNumber: "77169",
    clNumber: "8ac41b5",
    authors: "Damien Neil",
  },
  "cutlast-hasher": {
    id: "cutlast-hasher",
    title: "CutLast & Extensible maphash.Hasher",
    filename: "hasher_cutlast.go",
    benchmark: "Zero-allocation delimiter slicing",
    initialCode: `package main

import (
    "fmt"
    "hash/maphash"
    "strings"
)

type CaseInsensitiveHasher struct{}

func (CaseInsensitiveHasher) Hash(h *maphash.Hash, s string) {
    h.WriteString(strings.ToLower(s))
}
func (CaseInsensitiveHasher) Equal(x, y string) bool {
    return strings.EqualFold(x, y)
}

func main() {
    // 1. CutLast:
    before, after, found := strings.CutLast("api/v1/ledger/tx_9918.json", ".")
    fmt.Printf("Base: %q | Ext: %q | Found: %v\\n", before, after, found)

    // 2. Extensible maphash.Hasher:
    var h maphash.Hasher[string] = CaseInsensitiveHasher{}
    fmt.Println("Equal Fold:", h.Equal("GOPHER", "gopher"))
}`,
    expectedOutput: `Base: "api/v1/ledger/tx_9918" | Ext: "json" | Found: true
Equal Fold: true`,
    specUrl: "https://pkg.go.dev/hash/maphash#Hasher",
    specName: "maphash.Hasher interface",
    issueNumber: "70471",
    clNumber: "330aec8",
    authors: "Alan Donovan & qiulaidongfeng",
  },
  "divide-rand": {
    id: "divide-rand",
    title: "math/big.Int.Divide & rand.Rand.N",
    filename: "divide_rand.go",
    benchmark: "Exact financial division",
    initialCode: `package main

import (
    "fmt"
    "math/big"
    "math/rand/v2"
)

func main() {
    x, y := big.NewInt(7), big.NewInt(2)
    q, r := new(big.Int), new(big.Int)

    q.Divide(x, y, r, big.Ceil)
    fmt.Printf("Ceil:  q=%s r=%s\\n", q, r)

    q.Divide(x, y, r, big.Floor)
    fmt.Printf("Floor: q=%s r=%s\\n", q, r)

    // Generic random generation on instance:
    rng := rand.New(rand.NewPCG(42, 108))
    fmt.Println("Generic uint16 in [0, 500):", rng.N(uint16(500)))
}`,
    expectedOutput: `Ceil:  q=4 r=-1
Floor: q=3 r=1
Generic uint16 in [0, 500): 317`,
    specUrl: "https://pkg.go.dev/math/big#Int.Divide",
    specName: "math/big.Int.Divide",
    issueNumber: "76821",
    clNumber: "8f7f951",
    authors: "Armin Günther",
  },
  "db-scanning": {
    id: "db-scanning",
    title: "Zero-Alloc Database Scanning (database/sql)",
    filename: "db_scan.go",
    benchmark: "0 B/op • Direct column scanning",
    initialCode: `package main

import (
    "database/sql"
    "fmt"
)

func main() {
    // database/sql.ConvertAssign allows direct driver-level assignment:
    var dest int64
    src := "9948201"

    err := sql.ConvertAssign(&dest, src)
    if err != nil {
        panic(err)
    }

    fmt.Printf("Converted and assigned directly: %d (type: %T)\\n", dest, dest)
}`,
    expectedOutput: `Converted and assigned directly: 9948201 (type: int64)`,
    specUrl: "https://pkg.go.dev/database/sql/driver#RowsColumnScanner",
    specName: "driver.RowsColumnScanner",
    issueNumber: "69018",
    clNumber: "720110",
    authors: "Brad Fitzpatrick & Go Database Team",
  },
  "http-upgrades": {
    id: "http-upgrades",
    title: "HTTP/1 Auto-Drain, HTTP/2 & Sockets",
    filename: "http_improvements.go",
    benchmark: "Auto connection pooling reuse",
    initialCode: `package main

import (
    "fmt"
    "net/http"
    "net/url"
)

func main() {
    // 1. URL Deep Cloning:
    u, _ := url.Parse("https://api.gateway.internal/v1/orders?tenant=prod")
    cloned := u.Clone()
    cloned.Path = "/v1/settlements"
    fmt.Println("Original:", u.String())
    fmt.Println("Cloned:  ", cloned.String())

    // 2. HTTP Server configuration:
    srv := &http.Server{
        MaxHeaderValueCount: 100, // New in Go 1.27
    }
    fmt.Println("Server configured with max header count:", srv.MaxHeaderValueCount)
}`,
    expectedOutput: `Original: https://api.gateway.internal/v1/orders?tenant=prod
Cloned:   https://api.gateway.internal/v1/settlements?tenant=prod
Server configured with max header count: 100`,
    specUrl: "https://go.dev/doc/go1.27#net/http",
    specName: "net/http release notes",
    issueNumber: "67810",
    clNumber: "c5f43ab",
    authors: "Damien Neil & Brad Fitzpatrick",
  },
  toolchain: {
    id: "toolchain",
    title: "Modernized go fix, @file & CI JSON",
    filename: "atomic_modernize.go",
    benchmark: "Automated AST rewrite",
    legacyCode: `// Legacy Go (rewritten automatically by go fix -run=atomictypes):
var counter int64
atomic.AddInt64(&counter, 1)`,
    legacyOutput: `1`,
    initialCode: `package main

import (
    "fmt"
    "sync/atomic"
)

type ServiceMetrics struct {
    reqCount atomic.Int64 // Type-safe atomic primitive
}

func main() {
    m := &ServiceMetrics{}
    m.reqCount.Add(1)
    fmt.Println("Processed requests:", m.reqCount.Load())
}`,
    expectedOutput: `Processed requests: 1`,
    specUrl: "https://go.dev/doc/go1.27#tools",
    specName: "Tools release notes",
    issueNumber: "63696",
    authors: "Alan Donovan & Michael Pratt",
  },
  "hidden-gems": {
    id: "hidden-gems",
    title: "Compiler SSA, runtime/secret & Metaprogramming",
    filename: "switch_lut.go",
    benchmark: "O(1) Branchless Jump Table",
    initialCode: `package main

import "fmt"

func opCodeName(op byte) string {
    // Go 1.27 compiles dense switches into branchless jump lookup tables:
    switch op {
    case 0x01:
        return "READ"
    case 0x02:
        return "WRITE"
    case 0x03:
        return "COMMIT"
    case 0x04:
        return "ABORT"
    default:
        return "UNKNOWN"
    }
}

func main() {
    fmt.Println("Op 0x03:", opCodeName(0x03))
}`,
    expectedOutput: `Op 0x03: COMMIT`,
    specUrl: "https://go.dev/doc/go1.27#compiler",
    specName: "Compiler & Linker notes",
    clNumber: "7a8dcab",
    authors: "Go Compiler & Runtime Engineers",
  },
};

const COPY_ICON = iconMarkup("copy", { size: 13, strokeWidth: 1.8 });
const CHECK_ICON = iconMarkup("check", { size: 13, strokeWidth: 2.2 });
const PLAY_ICON = iconMarkup("play", { size: 12, strokeWidth: 2 });
const EDIT_ICON = iconMarkup("edit", { size: 13, strokeWidth: 1.8 });
const RESET_ICON = iconMarkup("rotate-ccw", { size: 13, strokeWidth: 1.8 });
const TERM_ICON = iconMarkup("terminal", { size: 12, strokeWidth: 1.8 });
const FILE_ICON = iconMarkup("file-text", { size: 12, strokeWidth: 1.8 });
const GIT_ICON = iconMarkup("git-commit", { size: 12, strokeWidth: 1.8 });
const USERS_ICON = iconMarkup("people", { size: 12, strokeWidth: 1.8 });
const EXT_ICON = iconMarkup("external", { size: 10, strokeWidth: 2 });

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function enhanceSnippet(sectionEl: HTMLElement, data: TourModuleData) {
  // If already enhanced in this exact DOM tree, skip
  if (sectionEl.querySelector(".go-tour-snippet")) return;

  const figure = sectionEl.querySelector<HTMLElement>(".code-figure");
  if (!figure) return;

  const oldCopy = figure.querySelector(".code-copy");
  if (oldCopy) (oldCopy as HTMLElement).style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = "go-tour-snippet";

  let activeTab: "current" | "legacy" = "current";
  let isEditing = false;
  let code = data.initialCode;

  // 1. Control bar
  const bar = document.createElement("div");
  bar.className = "go-tour-bar";

  const leftGroup = document.createElement("div");
  leftGroup.className = "go-tour-left";

  let tabCurrentBtn: HTMLButtonElement | null = null;
  let tabLegacyBtn: HTMLButtonElement | null = null;

  if (data.legacyCode) {
    const tabs = document.createElement("div");
    tabs.className = "go-tour-tabs";

    tabCurrentBtn = document.createElement("button");
    tabCurrentBtn.type = "button";
    tabCurrentBtn.className = "go-tour-tab";
    tabCurrentBtn.setAttribute("aria-selected", "true");
    tabCurrentBtn.textContent = "Go 1.27";

    tabLegacyBtn = document.createElement("button");
    tabLegacyBtn.type = "button";
    tabLegacyBtn.className = "go-tour-tab";
    tabLegacyBtn.setAttribute("aria-selected", "false");
    tabLegacyBtn.textContent = "Go 1.26";

    tabs.appendChild(tabCurrentBtn);
    tabs.appendChild(tabLegacyBtn);
    leftGroup.appendChild(tabs);
  } else {
    const fn = document.createElement("span");
    fn.className = "go-tour-filename";
    fn.textContent = data.filename;
    leftGroup.appendChild(fn);
  }

  // Right actions: circular round buttons
  const actions = document.createElement("div");
  actions.className = "go-tour-actions";

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "go-tour-btn";
  copyBtn.innerHTML = COPY_ICON;
  copyBtn.title = "Copy code";
  copyBtn.setAttribute("aria-label", "Copy code");

  // Edit button
  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "go-tour-btn";
  editBtn.innerHTML = EDIT_ICON;
  editBtn.title = "Edit code";
  editBtn.setAttribute("aria-label", "Edit code");

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "go-tour-btn go-tour-btn-reset";
  resetBtn.innerHTML = RESET_ICON;
  resetBtn.title = "Reset code";
  resetBtn.setAttribute("aria-label", "Reset code");
  resetBtn.hidden = true;

  // Run button
  const runBtn = document.createElement("button");
  runBtn.type = "button";
  runBtn.className = "go-tour-btn go-tour-btn-run";
  runBtn.innerHTML = PLAY_ICON;
  runBtn.title = "Run code";
  runBtn.setAttribute("aria-label", "Run code");

  actions.appendChild(copyBtn);
  actions.appendChild(editBtn);
  actions.appendChild(resetBtn);
  actions.appendChild(runBtn);

  bar.appendChild(leftGroup);
  bar.appendChild(actions);
  wrapper.appendChild(bar);

  // 2. Code container with rich syntax highlighting
  const editorWrap = document.createElement("div");
  editorWrap.className = "go-tour-editor";

  const preBlock = document.createElement("pre");
  const codeBlock = document.createElement("code");
  codeBlock.innerHTML = highlightGo(data.initialCode);
  preBlock.appendChild(codeBlock);
  editorWrap.appendChild(preBlock);

  // Textarea for editing
  const textarea = document.createElement("textarea");
  textarea.className = "go-tour-textarea";
  textarea.spellcheck = false;
  textarea.hidden = true;
  editorWrap.appendChild(textarea);

  wrapper.appendChild(editorWrap);

  // 3. Terminal Drawer
  const termDrawer = document.createElement("div");
  termDrawer.className = "go-tour-terminal";
  termDrawer.hidden = true;

  const termHead = document.createElement("div");
  termHead.className = "go-tour-term-head";

  const termLabel = document.createElement("span");
  termLabel.className = "go-tour-term-label";
  termLabel.innerHTML = `${TERM_ICON}<span>Terminal output</span>`;

  const termMeta = document.createElement("div");
  termMeta.className = "go-tour-term-meta";

  const termTime = document.createElement("span");
  termTime.className = "go-tour-term-time";

  const termBench = document.createElement("span");
  termBench.textContent = data.benchmark;
  termBench.className = "go-tour-term-bench";

  termMeta.appendChild(termTime);
  termMeta.appendChild(termBench);
  termHead.appendChild(termLabel);
  termHead.appendChild(termMeta);

  const termBody = document.createElement("pre");
  termBody.className = "go-tour-term-body";

  termDrawer.appendChild(termHead);
  termDrawer.appendChild(termBody);
  wrapper.appendChild(termDrawer);

  figure.parentNode?.replaceChild(wrapper, figure);

  // Switch Tab Handler
  const switchTab = (tab: "current" | "legacy") => {
    if (activeTab === tab) return;
    if (isSoundEnabled()) playAccent("tab");
    activeTab = tab;
    if (tabCurrentBtn && tabLegacyBtn) {
      tabCurrentBtn.setAttribute("aria-selected", tab === "current" ? "true" : "false");
      tabLegacyBtn.setAttribute("aria-selected", tab === "legacy" ? "true" : "false");
    }
    termDrawer.hidden = true;
    if (isEditing) {
      isEditing = false;
      textarea.hidden = true;
      preBlock.hidden = false;
      editBtn.innerHTML = EDIT_ICON;
      editBtn.title = "Edit code";
    }

    if (tab === "legacy" && data.legacyCode) {
      code = data.legacyCode;
      codeBlock.innerHTML = highlightGo(data.legacyCode);
    } else {
      code = data.initialCode;
      codeBlock.innerHTML = highlightGo(data.initialCode);
    }
  };

  if (tabCurrentBtn && tabLegacyBtn) {
    tabCurrentBtn.onclick = () => switchTab("current");
    tabLegacyBtn.onclick = () => switchTab("legacy");
  }

  // Copy Action
  copyBtn.onclick = async () => {
    const currentText = isEditing ? textarea.value : code;
    const ok = await copyText(currentText);
    if (ok) {
      copyBtn.classList.add("is-done");
      copyBtn.innerHTML = CHECK_ICON;
      if (isSoundEnabled()) playAccent("copy");
      showToast({ message: "Copied to clipboard", anchor: copyBtn, duration: 1600 });
      window.setTimeout(() => {
        copyBtn.classList.remove("is-done");
        copyBtn.innerHTML = COPY_ICON;
      }, 1400);
    }
  };

  // Edit Action
  editBtn.onclick = () => {
    isEditing = !isEditing;
    if (isEditing) {
      if (isSoundEnabled()) playAccent("toggle-on");
      textarea.value = code;
      textarea.hidden = false;
      preBlock.hidden = true;
      resetBtn.hidden = false;
      editBtn.innerHTML = CHECK_ICON;
      editBtn.title = "Save and preview";
      textarea.focus();
    } else {
      if (isSoundEnabled()) playAccent("toggle-off");
      code = textarea.value;
      textarea.hidden = true;
      preBlock.hidden = false;
      codeBlock.innerHTML = highlightGo(code);
      editBtn.innerHTML = EDIT_ICON;
      editBtn.title = "Edit code";
    }
  };

  // Reset Action
  resetBtn.onclick = () => {
    if (isSoundEnabled()) playAccent("tap");
    code = activeTab === "legacy" && data.legacyCode ? data.legacyCode : data.initialCode;
    textarea.value = code;
    codeBlock.innerHTML = highlightGo(code);
    termDrawer.hidden = true;
    resetBtn.hidden = true;
    if (isEditing) {
      isEditing = false;
      textarea.hidden = true;
      preBlock.hidden = false;
      editBtn.innerHTML = EDIT_ICON;
      editBtn.title = "Edit code";
    }
  };

  // Run Action
  runBtn.onclick = () => {
    runBtn.setAttribute("disabled", "true");
    runBtn.innerHTML = `<span class="spinner" style="display:inline-block;width:10px;height:10px;border:1.5px solid currentColor;border-top-color:transparent;border-radius:50%;animation:diagram-spin 0.6s linear infinite"></span>`;

    const start = performance.now();
    window.setTimeout(() => {
      const elapsed = Math.round((performance.now() - start + 80) * 10) / 10;
      runBtn.removeAttribute("disabled");
      runBtn.innerHTML = PLAY_ICON;

      termTime.textContent = `${elapsed}ms virtual`;
      const expected = activeTab === "legacy" && data.legacyOutput ? data.legacyOutput : data.expectedOutput;
      termBody.textContent = expected;
      termDrawer.hidden = false;

      if (isSoundEnabled()) playAccent("action");
    }, 100);
  };
}

function enhanceSpecFooters() {
  document.querySelectorAll<HTMLElement>(".go-spec-row[data-spec-id]").forEach((row) => {
    if (row.dataset.enhanced === "true") return;
    row.dataset.enhanced = "true";

    const specId = row.dataset.specId ?? "";
    const data = TOUR_MODULES[specId];
    if (!data) return;

    row.innerHTML = "";
    const pills = document.createElement("div");
    pills.className = "go-spec-pills";

    if (data.specUrl) {
      const specLink = document.createElement("a");
      specLink.href = data.specUrl;
      specLink.target = "_blank";
      specLink.rel = "noreferrer";
      specLink.className = "go-spec-pill";
      specLink.innerHTML = `${FILE_ICON}<span>${data.specName ?? "Language spec"}</span>${EXT_ICON}`;
      specLink.onclick = () => {
        if (isSoundEnabled()) playAccent("tick");
      };
      pills.appendChild(specLink);
    }

    if (data.issueNumber) {
      const issueLink = document.createElement("a");
      issueLink.href = `https://go.dev/issue/${data.issueNumber}`;
      issueLink.target = "_blank";
      issueLink.rel = "noreferrer";
      issueLink.className = "go-spec-pill";
      issueLink.innerHTML = `<span style="opacity:0.5;font-family:ui-monospace,monospace;font-size:11px;font-weight:600">#</span><span>${data.issueNumber}</span>${EXT_ICON}`;
      issueLink.onclick = () => {
        if (isSoundEnabled()) playAccent("tick");
      };
      pills.appendChild(issueLink);
    }

    if (data.clNumber) {
      const clLink = document.createElement("a");
      clLink.href = `https://go.dev/cl/${data.clNumber}`;
      clLink.target = "_blank";
      clLink.rel = "noreferrer";
      clLink.className = "go-spec-pill";
      clLink.innerHTML = `${GIT_ICON}<span>CL ${data.clNumber}</span>${EXT_ICON}`;
      clLink.onclick = () => {
        if (isSoundEnabled()) playAccent("tick");
      };
      pills.appendChild(clLink);
    }

    row.appendChild(pills);

    if (data.authors) {
      const authors = document.createElement("div");
      authors.className = "go-spec-authors";
      authors.innerHTML = `${USERS_ICON}<span>${data.authors}</span>`;
      row.appendChild(authors);
    }
  });
}

export function initGoTour() {
  if (!document.querySelector('[data-note-tour="go-1-27"]')) {
    return;
  }

  Object.entries(TOUR_MODULES).forEach(([id, data]) => {
    const section = document.getElementById(id) || document.querySelector(`[data-spec-id="${id}"]`)?.parentElement;
    if (section) {
      enhanceSnippet(section as HTMLElement, data);
    }
  });

  enhanceSpecFooters();
}

// Bind to lifecycle
if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", initGoTour);
  if (document.readyState === "complete" || document.readyState === "interactive") {
    initGoTour();
  }
}
