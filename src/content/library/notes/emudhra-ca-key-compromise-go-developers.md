---
title: "Lets talk about eMudhra Certificate Vulnerability"
seoTitle: "Lets talk about eMudhra Certificate Vulnerability"
date: 2026-10-21
updated: 2026-10-21
tags: ["security", "go", "fintech"]
description: "Eight eMudhra CA keys were guessable, one was just 4. Who's exposed, how an attack works, and what fintech and Go teams must do (CVE-2026-111943)."
image: /blog/emudhra/og-hero.png
imageAlt: "The title Lets talk about eMudhra Certificate Vulnerability, beside a large violet 4 and four rows of zeros that end in 4."
---

A CA's private key should be a random number up to 116 digits long. One of eMudhra's was 4.

- **What happened:** eMudhra, an Indian company that vouches for websites (a CA), made eight secret keys that anyone can guess in under a second.
- **Who is affected:** people on an updated browser are safe. The risk is in old Go programs, servers with an old list of trusted CAs, and devices that never update.
- **What to do:** if you ship Go, rebuild and redeploy with Go 1.27.3 or 1.26.10, which block the eight keys (CVE-2026-111943). Then update the CA list in your container images.

## What is a CA, and why should you care?

**What it is.** A certificate authority (CA) is a notary for the internet. It checks that a website really belongs to, say, your bank, and then stamps a certificate for it. A certificate is a digital ID that a website shows your phone or computer.

**Where it is used.** Behind the padlock in every browser, inside UPI and net-banking apps, on the GST portal and in software updates. It also works between servers you never see: a payment gateway calling a bank API, a KYC check, or your own service calling a partner.

**Who uses it.** Browsers, phones, servers and any program that opens a secure HTTPS connection.

**When.** On every connection, in a fraction of a second, before any data moves.

**How trust works.** A root CA is kept locked away and offline. It signs an intermediate CA, the stamp that is used every day. The intermediate signs your bank's certificate.

Your phone or server keeps a list of root CAs it trusts. On Linux servers, that list comes from a package called `ca-certificates`.

When you connect, your app follows the chain back to a root on that list. If every signature checks out, it trusts the site.

**The secret key.** Every stamp has a secret key (also called a private key), a very large number that only the CA should know. Whoever knows it can stamp a certificate for any website, and every app that trusts the chain will accept it. So the number must be random and impossible to guess.

![A locked-away root CA signs the everyday stamp, which signs your bank's certificate, and your device trusts it because that root is on its list.](/blog/emudhra/trust-basic.svg)

_Each CA signs the one below it, and your device checks the chain against its own list of roots._

## What went wrong at eMudhra?

eMudhra is a CA based in Bengaluru and listed on the NSE and BSE. Its root CAs are called emSign, and Firefox has trusted them since 2019.

In April 2025, eMudhra made eight new intermediate CAs, so eight new stamps. Six sign website certificates and two sign software.

Each secret key should have been a random number up to 116 digits long. All eight were between 1 and 255. One was 4.

That made them easy to find. The public half of each key is printed in its certificate, which anyone can download.

You try 1, 2, 3 and so on. For each guess, you work out its public half and compare it with the one in the certificate. It takes at most 255 tries, which is under a second on a laptop.

Guessing a properly random key, even at a trillion tries a second, would take far longer than the age of the universe.

![Every possible key from 0 to 255 fits in a small grid, and trying 1, 2, 3 and 4 finds eMudhra's key 4 on the fourth guess.](/blog/emudhra/d4-keyspace.svg)

_All eight keys fit in these 256 cells, and the search for the smallest one stops at 4._

eMudhra says a bug in the script it used to make the keys caused this. Mozilla has not verified that.

| Stamp (intermediate CA) | Signs | Secret key |
|---|---|---|
| EM DV TLS CA - G3B | Websites | 156 |
| EM DV TLS CA - G3C | Websites | 230 |
| EM EV TLS CA - G3B | Websites | 115 |
| EM EV TLS CA - G3C | Websites | 56 |
| EM OV TLS CA - G3B | Websites | 155 |
| EM OV TLS CA - G3C | Websites | 4 |
| EM OV CS CA - G3B | Software | 66 |
| EM OV CS CA - G3C | Software | 237 |

## Who is affected, and how badly?

Most people are not. The risk sits in software that has not received a fix.

| Who | Affected? | Why |
|---|---|---|
| People on an updated browser | No | Firefox, Chrome, Apple and Microsoft each pushed a block within three days. |
| Go programs built before the fix | Yes | Browser blocklists do not reach Go. Only Go 1.27.3 and 1.26.10 have the block built in. |
| Servers and containers with an old CA list | Yes | Many programs trust whatever is on the list, and the list changes only when you update it. |
| Old devices that never update | Yes | Their CA list is frozen. It trusts these stamps until July 2039. |
| Websites with an eMudhra certificate | Not hacked | Their own keys are fine. But one eMudhra root is being removed, so sites that rely on it must move. |

![An updated browser and a Go 1.27.3 or 1.26.10 build reject the same fake certificate, but an old Go build on an old CA list accepts it.](/blog/emudhra/two-lanes.svg)

_Browsers check a blocklist and old Go programs do not, so Go built the block into its new versions._

In the worst case, someone who sits between you and a server could pretend to be your bank or a partner's API. Think of a hostile Wi-Fi network or a hacked office network. With a fake certificate, they could read or change the data that passes through.

To do that, they need that spot on the network and a program that trusts these stamps without checking a blocklist. The secret key is no barrier any more, because anyone can work it out.

![A fake bank certificate needs an attacker on your network and an app that skips blocklists, so updated browsers reject it and old programs accept it.](/blog/emudhra/attack-path.svg)

_Anyone can now get the key, so the outcome depends on whether your app checks a blocklist._

Nobody has been seen doing this. No certificate made with these stamps shows up in the public logs where certificates are recorded. But the keys were weak from April 2025, so misuse in those 17 months cannot be ruled out.

The problem was reported on 17 October 2026. Firefox blocked the keys in under three hours, and Chrome the same day. Apple followed on 19 October, Microsoft on 20 October, and Go released its fix on 19 to 20 October.

## What Go teams must do

The fix lives in Go's standard library, so it reaches a program only when that program is rebuilt.

### 1. Find which Go built each binary

A Go program carries the Go version it was built with. Check what is deployed, not your laptop.

```bash
go version ./bin/*                 # the Go version inside each binary
go version -m ./bin/app            # plus modules and build settings
grep -E '^(go|toolchain) ' go.mod
grep -rnE 'golang:[0-9.]+' --include='Dockerfile*' .
```

| `go version` says | Status | What to do |
|---|---|---|
| go1.27.3 or later 1.27.x, go1.26.10 or later 1.26.x, go1.28 or later | Fixed | Nothing for Go. Still do step 3. |
| go1.27.0 to go1.27.2 | Vulnerable | Rebuild with 1.27.3. |
| go1.26.0 to go1.26.9 | Vulnerable | Rebuild with 1.26.10. |
| go1.25 or older | Unsupported, no fix | Move to 1.26.10 or 1.27.3. |
| An rc, beta or devel build | Check | Fixed only if it includes commit `7f86f95`. |

### 2. Rebuild and redeploy with Go 1.27.3 or 1.26.10

The fix is compiled into each program. Upgrading Go on your laptop changes nothing that is already running.

```bash
go get toolchain@go1.27.3          # or go1.26.10; pins it in go.mod
go build -o ./bin/ ./cmd/...
go version ./bin/app               # expect go1.27.3
```

If your CI sets `GOTOOLCHAIN=local`, it ignores the `toolchain` line, so upgrade the Go in CI or your image tag. Rebuild everything that makes HTTPS calls, including CLIs, sidecars and CI tools. For programs you did not build, install the vendor's fixed release, such as cloudflared 2026.10.2.

### 3. Update ca-certificates in your images

The Go fix covers only these eight keys. Your images still need a fresh CA list, because one eMudhra root is being removed. In `scratch` and distroless images, the list was copied in at build time, so rebuild the image.

```dockerfile
FROM golang:1.27.3 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./cmd/app

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/app /usr/local/bin/app
ENTRYPOINT ["/usr/local/bin/app"]
```

### 4. If you cannot rebuild yet, add a deny-list

Use this if you are stuck on Go 1.25 or on a fork with no fix. It runs after Go's normal checks and refuses any chain that passes through one of the eight keys.

Another CA, Sectigo, also signed these keys, so there are 16 certificates. Matching on the key itself catches all of them.

```go title=denylist.go
// Package denylist is a stopgap for Go programs you cannot rebuild yet with
// Go 1.27.3 or 1.26.10. It refuses TLS chains that pass through one of the
// eight eMudhra intermediate CA keys that Go blocks (CVE-2026-111943).
package denylist

import (
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"errors"
	"strings"
)

// distrustedKeys is the SHA-256 of each blocked public key
// (RawSubjectPublicKeyInfo), the same eight values as Go commit 7f86f95.
const distrustedKeys = `
ebed6475c2c2d80fcb199f3fe8dd6e6b3ce60b77eb15d4e42c3dec0c6f5b5105
49dd353dc2b919a3770645117d0e60c16115e7d1bc259eefe734b00ea434fe5f
e0254c7fcdc265e2f0f8a428dabb75ab4ae039b4872d62f5ee57f0877d5a8a41
5c0660a2b164910d8ff589c18e14552e9e0ec237dcefe2cb736d41a4811f81a0
43bffa19d6ef651451f6841e019931e96f6f2eaeff28ab4b6f1ce4576de2717b
63ecefee431d49523bc1136c4e72d0206a477086caf606cd5cf025686c109cf8
ec4ffa1ad0ac88081314b7aaffef6a91f97cd57291bb5ba686c5415f5eb4f6b6
92c063d67e8f14db71d288e11266ffdaf69cbf115f7bab14f3bc2f68d25e0e30
`

var distrusted = map[[sha256.Size]byte]bool{}

func init() {
	for _, h := range strings.Fields(distrustedKeys) {
		b, err := hex.DecodeString(h)
		if err != nil || len(b) != sha256.Size {
			panic("denylist: bad hash " + h)
		}
		distrusted[[sha256.Size]byte(b)] = true
	}
	if len(distrusted) != 8 {
		panic("denylist: want 8 unique hashes")
	}
}

var ErrDistrusted = errors.New("tls: chain uses a distrusted eMudhra key (CVE-2026-111943)")

func hasDistrustedKey(chain []*x509.Certificate) bool {
	for _, c := range chain {
		if distrusted[sha256.Sum256(c.RawSubjectPublicKeyInfo)] {
			return true
		}
	}
	return false
}

// VerifyConnection runs after Go's normal checks. Like the Go fix, it passes
// only if at least one verified chain avoids all eight keys. Set it as
// tls.Config.VerifyConnection on your HTTP clients and mTLS servers.
func VerifyConnection(cs tls.ConnectionState) error {
	if len(cs.VerifiedChains) == 0 { // nothing was verified: check what the peer sent
		if hasDistrustedKey(cs.PeerCertificates) {
			return ErrDistrusted
		}
		return nil
	}
	for _, chain := range cs.VerifiedChains {
		if !hasDistrustedKey(chain) {
			return nil
		}
	}
	return ErrDistrusted
}
```

It guards only the connections you wire it into. It is a bridge, not a fix.

### 5. Never switch off verification

> [!warning]
> Do not set `InsecureSkipVerify` to make new errors go away. It switches off every check, so fake certificates get through too. If a partner breaks, ask them to move to a current chain.

When the old eMudhra root leaves your CA list, partners still on it will fail with errors that start with `x509:`. Roll out to a few servers first and watch for those errors.

If partners call you with client certificates (mTLS, where both sides show a certificate), build `ClientCAs` from your partners' CAs only. A pool built from every public root would also trust these stamps on an old build.

### 6. Test

For a browser, open the [test page](https://emudhra.we-have-a-problem.com/). It tries each test site and shows which ones your browser refuses.

For servers, run the test program below from the same host, image and binary as production. Every host should fail. If one connects, that build would accept a fake certificate.

On macOS and Windows, Go asks the operating system to check certificates. I ran the program on a Mac with go1.27.0, which has no fix, and it printed `x509: “EM DV TLS CA - G3B” certificate is revoked`. That was macOS refusing it, not Go.

A Linux container with an old CA list is the case to worry about.

![Go teams find each binary's Go version, rebuild with 1.27.3 or 1.26.10, update ca-certificates, redeploy with a canary, and use the deny-list only if stuck.](/blog/emudhra/go-fix-flow.svg)

_Rebuild first, and use the deny-list only as a bridge._

### Test program

Build it with the same Go and base image as your service, and pass it hosts from the test page, such as `dv-g3b-emudhra.we-have-a-problem.com`.

```go title=testhosts.go
// Command testhosts dials the upstream eMudhra test hosts and reports what
// this binary's Go version and trust store do with each one. Every host
// should fail verification. A completed handshake means this build would
// accept a certificate that chains through a compromised intermediate.
//
// Usage: go run . [host ...]   (defaults to one host; pass the full list)
package main

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net"
	"os"
	"runtime"
	"time"
)

func main() {
	hosts := os.Args[1:]
	if len(hosts) == 0 {
		hosts = []string{"dv-g3b-emudhra.we-have-a-problem.com"}
	}
	fmt.Printf("built with %s for %s/%s\n\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)

	accepted := 0
	for _, host := range hosts {
		verdict, err := probe(host)
		fmt.Printf("%-9s %s\n", verdict, host)
		if err != nil {
			fmt.Printf("          %v\n", err) // print the exact error your build returns
		}
		if verdict == "ACCEPTED" {
			accepted++
		}
	}
	if accepted > 0 {
		fmt.Printf("\n%d host(s) accepted: rebuild with Go 1.27.3 or 1.26.10 and update the trust store\n", accepted)
		os.Exit(1)
	}
}

func probe(host string) (string, error) {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, "443"), &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	})
	if err == nil {
		conn.Close()
		return "ACCEPTED", nil
	}

	var (
		invalid x509.CertificateInvalidError
		unknown x509.UnknownAuthorityError
		verify  *tls.CertificateVerificationError
	)
	switch {
	case errors.As(err, &invalid) && invalid.Reason == x509.NoValidChains:
		return "BLOCKED", err // the shape Go's fix returns for these keys
	case errors.As(err, &unknown):
		return "UNTRUSTED", err // the trust store no longer has a root for this chain
	case errors.As(err, &invalid), errors.As(err, &verify):
		return "REJECTED", err // some other verification failure; read the error
	default:
		return "NO TEST", err // DNS, timeout or network: this says nothing about trust
	}
}
```

## What fintech and payments teams must do

> [!important]
> No payment impact has been reported. This is a list of places to check, not a finding.

Payment systems check certificates in more places than most teams track:

- Outbound calls to payment gateways, banks, KYC and eSign providers. An old Go service on an old CA list would accept a fake partner certificate.
- Partner mTLS. Trust only the CAs that issue your partners' client certificates, never every public CA.
- Webhooks you send. The sender is a client too and needs the same fix.
- Code signing and devices. Two of the stamps sign software, and Windows trusts eMudhra's code-signing root. Confirm your Windows machines have Microsoft's 20 October block, and ask device vendors when their CA list updates.
- Partner chains. Ask each partner which root their certificates chain to. Calls to partners on emSign ECC Root CA - G3 will fail once that root is removed.
- An inventory of the certificates you trust, the fastest way to answer "are we exposed?"

PCI DSS 4.2.1.1 asks for an inventory of the trusted keys and certificates that protect card numbers in transit. It has been mandatory since 31 March 2025 ([summary by Scott Helme](https://scotthelme.co.uk/pci-dss-4-0-certificate-transparency-monitoring-is-mandatory/)).

[CERT-In's directions of 28 April 2022](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf) require some incidents to be reported within six hours, under Direction (ii). Ask compliance whether this counts.

I found no RBI or NPCI rule about certificates, and no source links this incident to any payment system. Whether eMudhra's digital signature (DSC) and eSign certificates are affected is not established, so ask your provider.

## Reference

### How an attack would work

An attack needs all four of these at once:

1. The attacker is on the network path between your program and the server, such as a hostile Wi-Fi network.
2. The attacker has one of the eight secret keys. Anyone can now work them out.
3. The attacker signs a fake certificate for the site they want to copy.
4. Your program still trusts the eMudhra chain and checks no blocklist.

Browsers that require Certificate Transparency, public logs that every trusted certificate should appear in, would also reject a fake that was never logged. Logging one would make it public, and none has appeared.

### Why cancelling the certificates was not enough

eMudhra cancelled, or revoked, all eight on 18 October. But a cancellation only helps programs that check for one.

Browsers do not wait for that. They ship their own blocklists, which update with the browser (Firefox calls its list [OneCRL](https://blog.mozilla.org/security/2015/03/03/revoking-intermediate-certificates-introducing-onecrl/)). Most other programs, including curl and OpenSSL with default settings, do not check for cancellations at all.

As far as I can tell, Go does not check them either. The Go team gave a simpler reason for its fix: many Linux users do not get automatic updates to their CA list. So Go built the block into its standard library.

### How fast everyone reacted

![Firefox blocked the keys within three hours of the report, eMudhra revoked them after 13 hours, and Apple, Go and Microsoft followed within three days.](/blog/emudhra/incident-timeline.svg)

_The first four days after Mozilla received the report, in UTC._

| UTC | T+ | What happened |
|---|---|---|
| 17 Oct 20:06 | 0 | Mozilla receives the report |
| 17 Oct 21:28 | 1h22m | eMudhra replies and turns off one affected stamp |
| 17 Oct 21:48 | 1h42m | Mozilla works out the keys itself |
| 17 Oct 22:59 | 2h53m | Firefox's blocklist update goes out |
| 17 Oct | same day | Chrome blocks them (time not published) |
| 18 Oct 09:24 | 13h18m | eMudhra revokes all eight |
| 19 Oct | day 2 | Apple blocks them, and the Go team opens issue #82345 |
| 19 to 20 Oct | day 2 to 3 | Go 1.27.3 and 1.26.10 ship |
| 20 Oct | day 3 | Microsoft blocks them, and the news goes public |
| 20 Oct 21:00 | 72h54m | Debian removes the two roots these stamps chain up to |

### Which software has a fix

These rows come from [Dennis Jackson's tracker](https://emudhra.we-have-a-problem.com/) at Mozilla, through its [public repository](https://github.com/galadran/we-have-a-problem.com), and refresh on each sync.

<!-- tracker:stats:start -->

**20 of 24** packages patched · **4** pending (FreeBSD, Node.js, Bun, Composer) · synced 2026-10-21 05:50 UTC from [galadran/we-have-a-problem.com@bb7c2a8](https://github.com/galadran/we-have-a-problem.com/commit/bb7c2a8)

<!-- tracker:stats:end -->

<!-- tracker:patched:start -->

| Software | Patched version | Status |
| --- | --- | --- |
| FreeBSD ca\_root\_nss | [tracking](https://reviews.freebsd.org/D60905) | Pending |
| Node.js | [tracking](https://github.com/nodejs/node/pull/66871) | Pending |
| Bun | [tracking](https://github.com/oven-sh/bun/pull/46159) | Pending |
| Composer ca-bundle | [1.4.16](https://github.com/composer/ca-bundle/pull/154), [1.6.0](https://github.com/composer/ca-bundle/pull/154) | Pending |
| Ubuntu ca-certificates | [20260816ubuntu0.22.04.1](https://bugs.launchpad.net/ubuntu/+source/ca-certificates/+bug/2171507), [20260816ubuntu0.24.04.1](https://bugs.launchpad.net/ubuntu/+source/ca-certificates/+bug/2171507), [20260816ubuntu0.26.04.1](https://bugs.launchpad.net/ubuntu/+source/ca-certificates/+bug/2171507), [20260816ubuntu0.26.10.1](https://bugs.launchpad.net/ubuntu/+source/ca-certificates/+bug/2171507) | Patched |
| Debian ca-certificates | [20250419\~deb12u2](https://bugs.debian.org/1151413), [20250419+deb13u1](https://bugs.debian.org/1151413), [20260816+nmu1](https://bugs.debian.org/1151413) | Patched |
| Arch Linux ca-certificates-mozilla | [3.131.1-1](https://archlinux.org/packages/core/x86_64/ca-certificates-mozilla/) | Patched |
| Gentoo ca-certificates | [20260816.3.125](https://bugs.gentoo.org/984601) | Patched |
| Fedora ca-certificates | [2026.2.92\_v9.0.319](https://bugzilla.redhat.com/show_bug.cgi?id=2556376) | Patched |
| Chainguard ca-certificates | [20260909-r3](https://images.chainguard.dev/security/CVE-2026-111943) | Patched |
| Alpine Linux ca-certificates | [20261020-r0](https://pkgs.alpinelinux.org/packages?name=ca-certificates&arch=) | Patched |
| NSS | [3.131.1](https://groups.google.com/a/mozilla.org/g/dev-tech-crypto/c/vSxZxnOMMvs) | Patched |
| curl CA bundle | [2026-10-20](https://curl.se/docs/caextract.html) | Patched |
| Cloudflare CFSSL trust store | [2026.10.1](https://github.com/cloudflare/cfssl_trust/releases/tag/trust-store-2026.10.1) | Patched |
| Homebrew ca-certificates | [2026-09-25\_1](https://github.com/Homebrew/homebrew-core/blob/d02b8762f4a29859c47a635a0d2683223fea9812/Formula/c/ca-certificates.rb) | Patched |
| Go | [1.27.3](https://groups.google.com/g/golang-announce/c/66pojueaQek), [1.26.10](https://groups.google.com/g/golang-announce/c/66pojueaQek) | Patched |
| Python certifi | [2026.10.19](https://github.com/certifi/python-certifi/releases/tag/2026.10.19) | Patched |
| pip | [26.2.2](https://github.com/pypa/pip/releases/tag/26.2.2) | Patched |
| uv | [0.13.4](https://github.com/astral-sh/uv/releases/tag/0.13.4) | Patched |
| Rust rustls-webpki | [0.103.16](https://github.com/rustls/webpki/releases/tag/v%2F0.103.16) | Patched |
| Rust webpki-roots / webpki-root-certs | [1.0.10](https://github.com/rustls/webpki-roots/releases/tag/v%2F1.0.10) | Patched |
| Electron | [44.9.1](https://github.com/electron/electron/releases/tag/v44.9.1), [43.8.1](https://github.com/electron/electron/releases/tag/v44.9.1), [42.11.16](https://github.com/electron/electron/releases/tag/v44.9.1) | Patched |
| Elixir castore | [1.0.22](https://hex.pm/packages/castore/1.0.22) | Patched |
| Perl Mozilla::CA | [20261020](https://metacpan.org/release/LWP/Mozilla-CA-20261020) | Patched |

<!-- tracker:patched:end -->

Pending means no fix is listed yet, not that an attack happened. Java, Android and OpenSSL had made no statement, so a missing row does not mean safe.

### Has this happened before?

CAs have failed before, but those cases took weeks to years to settle. Browsers blocked this one within hours.

| Year | Case | What happened |
|---|---|---|
| 2008 | [Debian OpenSSL](https://lists.debian.org/debian-security-announce/2008/msg00152.html) | A bug left only 32,767 possible keys per architecture ([details](https://wiki.debian.org/SSLkeys)). Advisory on 13 May. |
| 2011 | [DigiNotar](https://blog.mozilla.org/security/2011/08/29/fraudulent-google-com-certificate/) | Hacked around 17 June. A fake google.com certificate appeared on 10 July and was used against about 300,000 IP addresses, mostly in Iran. Mozilla removed the root on 29 to 30 August. Bankrupt on 20 September. |
| 2014 | [India CCA and NIC](https://learn.microsoft.com/en-us/security-updates/securityadvisories/2014/2982792) | Google noticed the problem on 2 July. Microsoft removed three NIC CAs on 10 July. |
| 2015 | [CNNIC and MCS Holdings](https://blog.mozilla.org/security/2015/04/02/distrusting-new-cnnic-certificates/) | Google found the problem on 20 March. CNNIC revoked on 22 March. Mozilla stopped trusting new CNNIC certificates on 2 April. |
| 2016 | [WoSign and StartCom](https://blog.mozilla.org/security/2016/10/24/distrusting-new-wosign-and-startcom-certificates/) | Mozilla stopped trusting new certificates on 24 October, over backdating and an undisclosed purchase. |
| 2017 to 2018 | [Symantec](https://security.googleblog.com/2017/09/chromes-plan-to-distrust-symantec.html) | Google announced its plan on 11 September 2017. Chrome 66 (April 2018) and Chrome 70 (October 2018) carried it out. |
| 2022 | TrustCor | Mozilla and Microsoft stopped trusting it by 30 November. Chrome followed on 15 December. |
| 2024 | [Entrust](https://security.googleblog.com/2024/06/sustaining-digital-certificate-security.html) | Google announced on 27 June. Chrome blocked it from about 12 November (Chrome 131). |
| 2026 | eMudhra | Reported on 17 October at 20:06 UTC. Firefox blocked it at 22:59 UTC the same day. |

### Viral claims, checked

- Claim: SSL is now broken. Verdict: wrong. The encryption worked, one CA made eight weak keys, and Firefox blocked them in under three hours ([Mozilla](https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/)).
- Claim: avoid public Wi-Fi, or use a VPN, for weeks. Verdict: overstated. Updated browsers reject the fakes, and a VPN on your laptop does nothing for the servers and devices at risk ([Scott Helme](https://scotthelme.co.uk/eight-bits-of-trust-emudhras-ca-keys-cracked-in-milliseconds/)).
- Claim: anyone can now make a fake HTTPS certificate for any website. Verdict: true, but it gets blocked. Updated browsers, Apple and Microsoft systems and rebuilt Go programs reject such a fake ([Mozilla bug 2083449](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449)).
- Claim: 60 million certificates can no longer be trusted. Verdict: wrong. That is eMudhra's own lifetime count, while the problem covers 8 keys in 16 certificates ([Mozilla bug 2083449](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449)).
- Claim: eMudhra's private keys leaked. Verdict: wrong. Nothing leaked, because the keys were small enough to work out from the public certificates ([Scott Helme](https://scotthelme.co.uk/eight-bits-of-trust-emudhras-ca-keys-cracked-in-milliseconds/)).

## FAQ

### Is HTTPS broken?

No. The encryption worked as designed. One CA made eight weak keys, and updated browsers and rebuilt Go programs block them.

### Do I need to change my passwords?

Not because of this. No fake certificate has been seen, and updated browsers reject anything signed with these keys.

### Should I avoid public Wi-Fi?

Not if your browser is up to date. The programs at risk are old servers, containers and devices, not an updated browser.

### Was anyone attacked?

No attack has been seen. The keys were weak from April 2025, so misuse in that time cannot be ruled out.

### My website uses an eMudhra certificate. What should I do?

Your own key is fine. If your chain ends at emSign ECC Root CA - G3, plan to move, because Mozilla and Chrome are removing that root. eMudhra plans to move about 30,000 certificates to its G1 chain, so ask it when yours will move.

### Do I need to release a new version of my Go library?

No. The fix lives in the Go version that builds the final program. Tell your users to rebuild with Go 1.27.3 or 1.26.10, and do not raise your `go` line just for this.

## Updates

| Date (UTC) | Change |
|---|---|
| 21 Oct 2026 | Published. |

<!-- tracker:changelog:start -->

No tracker changes since publication.

<!-- tracker:changelog:end -->

## Sources

**Start here**

- [Go issue #82345](https://github.com/golang/go/issues/82345): the Go team's tracking issue for the block.
- [ThreatLandscape on Go's hard block](https://threatlandscape.io/blog/go-hard-blocks-emudhra-intermediate-ca-keys-cve-2026-111943): what the Go fix covers.
- [we-have-a-problem.com](https://emudhra.we-have-a-problem.com/): Dennis Jackson's tracker, browser test and test hosts.
- [Cloudflare's write-up](https://blog.cloudflare.com/emudhra-certificate-compromise/): how Cloudflare checked and protected its own products.

**Primary**

- [Mozilla bug 2083449](https://bugzilla.mozilla.org/show_bug.cgi?id=2083449): the incident bug, with the timeline and eMudhra's first report.
- [Mozilla bug 1970728](https://bugzilla.mozilla.org/show_bug.cgi?id=1970728): an earlier eMudhra signing problem from 2025.
- [Mozilla Security Blog](https://blog.mozilla.org/security/2026/10/20/protecting-firefox-users-following-the-compromise-of-emudhra-intermediate-certificates/): how Firefox users were protected.
- [dev-security-policy thread](https://groups.google.com/a/mozilla.org/g/dev-security-policy/c/0R3XLJL6FuE): Mozilla's public discussion.
- [golang-announce](https://groups.google.com/g/golang-announce/c/66pojueaQek): the Go 1.27.3 and 1.26.10 announcement.
- [Go commit 7f86f95](https://github.com/golang/go/commit/7f86f95): the change that blocks the eight keys.
- [Go release history](https://go.dev/doc/devel/release#go1.27.3): official release dates.
- [eMudhra's statement](https://emudhra.com/en/post/certificate-security-incident): the CA's own account.
- [Debian DSA-6572-1](https://lists.debian.org/debian-security-announce/2026/msg00487.html): Debian's root removal.
- [galadran/we-have-a-problem.com](https://github.com/galadran/we-have-a-problem.com): the tracker's source data.

**Analysis**

- [Scott Helme, Eight bits of trust](https://scotthelme.co.uk/eight-bits-of-trust-emudhras-ca-keys-cracked-in-milliseconds/): a clear walkthrough of the keys and who is exposed.
- [The Register](https://www.theregister.com/security/2026/10/20/indian-certification-authority-emudhras-private-keys-compromised-one-of-them-was-the-number-4/5304312): news report.
- [LWN](https://lwn.net/Articles/1101643/): what it means for Linux CA lists.
- [The Hacker News](https://thehackernews.com/2026/10/eight-emudhra-ca-keys-compromised.html): news report.

**Background and history**

- [Introducing OneCRL](https://blog.mozilla.org/security/2015/03/03/revoking-intermediate-certificates-introducing-onecrl/): how Firefox blocks intermediate CAs.
- [Let's Encrypt ends TLS client authentication](https://letsencrypt.org/2025/05/14/ending-tls-client-authentication): why public CAs rarely issue client certificates now.
- [DigiNotar](https://blog.mozilla.org/security/2011/08/29/fraudulent-google-com-certificate/): Mozilla's 2011 response.
- [Microsoft advisory 2982792](https://learn.microsoft.com/en-us/security-updates/securityadvisories/2014/2982792): the 2014 removal of three NIC CAs.
- [Distrusting new CNNIC certificates](https://blog.mozilla.org/security/2015/04/02/distrusting-new-cnnic-certificates/): Mozilla's 2015 decision.
- [Distrusting WoSign and StartCom](https://blog.mozilla.org/security/2016/10/24/distrusting-new-wosign-and-startcom-certificates/): Mozilla's 2016 decision.
- [Chrome's plan to distrust Symantec](https://security.googleblog.com/2017/09/chromes-plan-to-distrust-symantec.html): Google's 2017 schedule.
- [Sustaining digital certificate security](https://security.googleblog.com/2024/06/sustaining-digital-certificate-security.html): Google's 2024 Entrust decision.
- [Debian DSA-1571-1](https://lists.debian.org/debian-security-announce/2008/msg00152.html): the 2008 Debian OpenSSL advisory.
- [Debian SSLkeys wiki](https://wiki.debian.org/SSLkeys): how many keys the 2008 bug could make.

**Regulatory**

- [CERT-In directions, 28 April 2022](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf): India's six-hour reporting directions.
- [RBI Master Direction on IT Governance](https://rbi.org.in/Scripts/BS_CircularIndexDisplay.aspx?Id=12562): RBI/2023-24/107, with a clause on cryptographic controls.
- [RBI Master Direction on IT Outsourcing](https://rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=12486): RBI/2023-24/102, on IT service providers.
- [Scott Helme on PCI DSS 4.0](https://scotthelme.co.uk/pci-dss-4-0-certificate-transparency-monitoring-is-mandatory/): a summary of requirement 4.2.1.1.
