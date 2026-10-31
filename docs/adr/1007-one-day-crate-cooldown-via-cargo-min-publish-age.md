# ADR-1007: New crate versions wait one day, via Cargo's native `min-publish-age`
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
On 2026-08-20, `arrayref`, `internment` and `append-only-vec` were republished from a compromised
account. The new versions added a dependency whose build script downloaded and ran a payload.
They were live for 86–107 minutes (https://blog.rust-lang.org/2026/08/20/supply-chain-attack-on-arrayref/).
The TS side already holds new releases for a day at the package-manager level. Cargo had no
equivalent until RFC 3923. Its `min-publish-age` was stabilised by rust-lang/cargo#17335, merged
2026-08-28, for **Rust 1.100 (2026-11-12)**.

## Decision
The template ships `.cargo/config.toml` with `[registry] global-min-publish-age = "1 day"`. This
gates **resolution**: `cargo add` and `cargo update` skip versions younger than a day. Versions
already in `Cargo.lock` are kept, and `--locked` builds are unaffected (ADR-1006). One day
matches the TS gate.

## Alternatives considered
- **A hand-written CI check against publish times.** Rejected now that a native feature exists.
- **`cargo-vet` attestations.** Rejected as a much heavier ongoing review burden for this risk.

## Consequences
- **Inert until Rust 1.100.** Cargo 1.99 prints `ignoring registry.global-min-publish-age
  without -Zmin-publish-age` and builds normally (checked 2026-10-20). CI follows `stable`, so it
  activates by itself on 2026-11-12.
- A deliberate bypass is `CARGO_RESOLVER_INCOMPATIBLE_PUBLISH_AGE=allow`, for an urgent security
  release. Record why when it's used.
- Promotion condition: once 1.100 is out, confirm the warning is gone and the gate works.
