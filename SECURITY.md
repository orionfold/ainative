# Security Policy

## Reporting a vulnerability

Please report vulnerabilities **privately** via GitHub's security advisory
form: [Report a vulnerability](https://github.com/orionfold/relay/security/advisories/new).
Do not open public issues for security reports.

What to expect:

- **Acknowledgment within 72 hours.**
- Confirmed issues are fixed and shipped as ordinary versioned npm releases,
  with disclosure in `CHANGELOG.md` and the GitHub Release notes.
- Credit to the reporter in the release notes, unless you prefer otherwise.

## Supported versions

Relay is a locally-installed application that never self-updates. Fixes ship
in the latest release; upgrade with `npm install -g orionfold-relay@latest`
(or bump your pinned version). There is no LTS branch at this stage.

## Security documentation

The trust documentation set for evaluators lives in
[`docs/trust/`](docs/trust/):

- [Security packet](docs/trust/security-packet.md) — 2-page overview:
  architecture, "we host no customer data", subprocessors, posture
- [Data flow](docs/trust/data-flow.md) — complete outbound-network
  inventory, code-verified
- [Supply chain](docs/trust/supply-chain.md) — npm provenance, SBOM,
  checksums, version pinning
- [License terms](docs/trust/license-terms.md) · [Continuity](docs/trust/continuity.md)
