# 2026-11-22 (1): template ADR-1024, an explicit `deny.toml`

Template ADR-1024 (GitHub `300d4e4`): the template ships a `deny.toml` that writes out every setting
the Rust supply-chain gate depends on, including `unmaintained = "all"`. cargo-deny 0.22 changed that
default to direct dependencies only, which hid a transitive unmaintained crate in a real repo. The
pin moves to cargo-deny-action v2.1.3 at the same time.

This repo is TypeScript only: it has no `Cargo.toml` and no `rust supply chain` job in `ci.yml`. So
it copies the ADR, byte-identical, plus its index row, and **doesn't add `deny.toml`**. Copy the
template's `deny.toml` along with the Rust job if Rust is ever added.
