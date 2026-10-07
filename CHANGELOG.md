# Changelog

## v0 / 0.1.0 — 2026-10-07 (proposed)

Initial JSON Schema 2020-12 family: world format `0.1`, IPC `0.1`, extension manifest/API `0.1`, screen descriptor `0.1`. Includes every core method's request and result plus notifications, offline examples and a Node validator. Identifiers are reserved for these contracts; incompatible changes require a new wire/format identifier and migration notes. No runtime compatibility is claimed yet.

## 0.2.0 — 2026-10-07

Adds frozen `v0.2/` schemas for IPC 0.2 and world format 0.2; `v0/` stays unchanged. The validator accepts an optional fourth `version` argument (default `0.1`); CLI accepts `[response-method|-] [contract-version]`.

IPC adds camera get/set, waypoint/route, travel, autodrive, ui.open/close, data.publish/remove and presentation notifications. `location` and `integrations` are revisioned state keys. Publishing requires its own capability; scalar values, TTL, sequence and ownership are specified by RFC-0003. World 0.2 has the same manifest shape, with RFC-0004's sampler/transform/PBR material semantics. No mock-only protocol is accepted.
