---
layout: ../../layouts/BlogLayout.astro
title: Why I built Aster
description: Machines need to authenticate to other machines, often on behalf of a user. Nothing I shipped in the last twenty years was designed for that.
pubDate: 2026-04-12
author: Emrul Islam
hero: /blog/why-i-built-aster.svg
heroAlt: Two endpoints connected by a mutual cryptographic handshake. No third party between them.
---

You've probably hit this problem without realizing it was the same problem.

Your services needed to talk to each other. For the internal API, you used an API key. For the partner integration, mTLS certificates from a central authority. For OAuth between apps, an auth server and a token exchange. For the service mesh inside the cluster, a sidecar next to everything, and you called it Zero Trust. When your AI agent needed to call a tool on a remote machine, you gave it a key and hoped it wouldn't leak.

Five different mechanisms. Five different seams. None of them were designed from the ground up for machines authenticating to machines.

## Five tools, none designed for this

API keys are credentials designed for humans — secrets a person could type into a config file and rotate when they changed jobs. mTLS certificates were designed to authenticate websites to browsers, back when certificates were issued by human processes and the rotation cycle was measured in years. OAuth is a delegation protocol that grew out of "let this app post to Twitter on my behalf" — its entire shape is about human consent, retrofitted wherever machines need to act for humans. Service mesh is traffic management that grew identity features when someone realized sidecars had the right vantage point.

Each of these is an improvised answer to a problem no single tool owns. The machine-to-machine authentication problem has been hiding inside five different tools for fifteen years, and none of them own it. So every team invents its own combination and lives with the seams. Nothing I shipped in the last twenty years was designed for this — and I shipped a lot.

## What a machine-first answer looks like

Treat the machine as the principal. Every machine has a long-lived cryptographic identity — an ed25519 keypair — and that identity is stable regardless of where the machine runs, what IP it has, or what network it's on. When that machine talks to another machine, both sides prove who they are during the QUIC handshake, before your handler runs.

No third party is issuing certificates you have to rotate. No shared secret is stored somewhere that could leak. The address of the remote endpoint is its public key. You dial by identity, not by hostname, not by port.

Authorization is declarative and scoped. You mint a capability credential signed by your root key: *this machine, holding this capability, is authorized to call these specific methods on this service, until this date.* The server enforces the credential in four gates — connection admission, credential verification, service-level authorization, and method-level capability — and the root key that signs the whole trust topology stays offline.

When you build this way, it stops mattering where the machines are. Same datacenter, different continents, behind aggressive NATs, on networks you don't own. The dial is by public key. The transport handles the rest. Identity is in the connection, not bolted on.

<figure class="diagram">
  <object data="/blog/four-gate-model.svg" type="image/svg+xml" aria-label="Four-gate authorization model: a call passes through Connection, Credential, Service, and Method gates before the handler runs."></object>
</figure>

## How I ended up building it

I've been shipping software for twenty-plus years. At IBM I was a BPM Solution Architect — years of watching Fortune 500 teams wire federated identity into service buses with more duct tape than I can remember. At Oracle and BEA before that, machine identity was whatever the enterprise ticket system said it was. At Twingate, for four years as Head of Platform Innovation, I built Zero Trust networking for users — authenticating people to services — and kept wondering what the equivalent was for machines.

Everywhere I went, some shape of the authentication problem was there. Every time, it was solved with a different combination of the same five tools. Every time, the seams mattered.

Last month I finally had a vacation. Ten uninterrupted days with my laptop and my wife's patient blessing. On the flight home, the last day of the trip, I SSH'd into my homelab from my laptop and started a dozen-line hello-world service I'd just written. I closed the SSH session. Same laptop, same seat. I ran the aster CLI and called my service from a shell — thousands of miles from the machine it was running on. No IP address, no hostname, no port forwarded through my home firewall.

I came back from vacation with a working RPC framework. The toy had stopped feeling like a toy.

I've been contributing to open source for fourteen years — Deno, Debezium, graphql-java, OrientDB, Square's KotlinPoet, dozens more projects across backend, frontend, ML tooling, and infra. I've also worked on a lot of software I wasn't always able to talk about publicly. This is the first thing that's just mine, and it's finally out where anyone can read it and use it.

## What ships today

Aster 0.1.2 is live on PyPI as `aster-rpc` and on npm as `@aster-rpc/aster`. Python and TypeScript are first-class bindings. Java, .NET, Kotlin, and Go are in progress.

Here is an MCP-shaped tool — something an LLM agent on your laptop could call against your homelab — in 25 lines of Python:

```python
import subprocess
from dataclasses import dataclass
from aster import service, rpc, wire_type, AsterServer

@wire_type("homelab/ReadLog")
@dataclass
class ReadLogRequest:
    unit: str = ""
    lines: int = 100

@wire_type("homelab/ReadLog/Result")
@dataclass
class LogLines:
    lines: list[str] = None

@service(name="HomelabTools", version=1)
class HomelabTools:
    @rpc
    async def read_log(self, req: ReadLogRequest) -> LogLines:
        out = subprocess.check_output(
            ["journalctl", "-u", req.unit, "-n", str(req.lines), "--no-pager"]
        )
        return LogLines(lines=out.decode().splitlines())

async def main():
    async with AsterServer(services=[HomelabTools()]) as srv:
        print(srv.address)  # share this aster1... with your agent
        await srv.serve()
```

Calling it from another machine — no DNS, no port forwarding, no shared schema file, no API key sitting in an env var:

```python
from aster import AsterClient

async def main():
    async with AsterClient(address="aster1...") as c:
        tools = c.proxy("HomelabTools")
        result = await tools.read_log({"unit": "nginx", "lines": 20})
        for line in result.lines:
            print(line)
```

The server runs in your homelab. The client runs wherever your agent runs — your laptop, a hosted Claude or Cursor session, a CI runner. The address is a public key. The capability credential the agent holds says exactly which tools, on which service, until when. Both sides authenticate at the QUIC handshake before either side sees the request payload.

The Python server and a TypeScript client speak the same wire format natively. No codegen step, no IDL file. The contract identity is a [BLAKE3](https://github.com/BLAKE3-team/BLAKE3) hash of the canonical form — the same interface defined in any supported language produces the same hash, and wire compatibility is verified by that hash rather than by human negotiation.

Under the hood: QUIC transport via [iroh](https://iroh.computer) (with NAT traversal and relay fallback), [Apache Fory](https://fory.apache.org) cross-language serialization, BLAKE3 content-addressed contracts, and four-gate capability authorization rooted in an offline ed25519 key. Built for machines, from the ground up.

## Agents, fleets, and the obvious 2026 example

The clearest 2026-shaped example is AI agents calling tools on remote machines — the exact shape MCP describes. An agent on machine A wants to call a function on machine B. You don't want a hosted proxy in between. You don't want to rotate API keys. You want the call scoped to specific methods. With Aster, the agent holds a capability credential minted from your root key, dials the tool's endpoint by public key, both sides authenticate at the QUIC handshake, and the four-gate model enforces access before your handler runs. No intermediary. No shared secret. The trust topology is yours.

The same engineering covers IoT fleets where devices roam between networks, multi-tenant edge compute where tenants shouldn't see each other's traffic, signed-binary delivery where the pulling machine has to prove who it is, and cross-organization microservice calls where both sides live in different trust domains.

## What this becomes

Next on the roadmap: identity-aware load balancing and self-healing, built from the same primitives. Once endpoints share an identity, you can route between them. Once the trust topology is one thing, healing from partitions becomes another property of the same substrate. The "no infrastructure" pitch starts as *no DNS, no LB, no certs* and grows, over time, into *no DNS, no LB, no certs, no service mesh, no sidecars, no control plane.* Same identity model, expanding outward.

## Try it

```
pip install aster-rpc
# or
bun add @aster-rpc/aster
```

The [Mission Control walkthrough](https://docs.aster.site/docs/quickstart/mission-control) is the full 30-minute deep dive — six chapters, four streaming patterns, auth, cross-language interop, and a working MCP agent demo at the end.

Source at [github.com/aster-rpc/aster-rpc](https://github.com/aster-rpc/aster-rpc). Issues and questions welcome.

~ Emrul

*Emrul Islam — Chief Innovation Officer at [Kasm Technologies](https://kasm.com). Previously Head of Platform Innovation at Twingate. Aster is a nights-and-weekends passion project — one of several long-running ideas I've been carrying in the back of my head for far too long. [GitHub](https://github.com/emrul) · [LinkedIn](https://www.linkedin.com/in/emrul/)*
