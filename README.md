# Hyprune schemas · v0

Proposed implementation contracts for a world-driven Hyprland desktop. JSON Schema dialect: **2020-12**. Initial format/protocol identifier: **`0.1`**. This is design/tooling work, not a claim of implemented runtime compatibility.

| Schema | Contract |
| --- | --- |
| `v0/world.schema.json` | Data-only manifest, glTF entry, spawns, anchors, zones, navigation, collision, audio, lightmaps and provenance. |
| `v0/ipc.schema.json` | JSON-RPC request/response/error envelope, all 12 core methods with typed params/results, 3 notifications and state. |
| `v0/extension.schema.json` | Process entrypoint, contributions, requested grants and mandatory sandbox profile. |
| `v0/screen-type.schema.json` | Source kind, planar geometry, resolution, color/alpha, refresh ceiling and input support. |
| `v0/common.schema.json` | Shared IDs, versions, paths, poses, revisions and capabilities. |

[RFC source](https://github.com/hyprune/docs/tree/main/src/content/docs/rfcs) is normative for semantics. [RFC-0003](https://hyprune.com/rfcs/0003-ipc/) defines IPC; [RFC-0004](https://hyprune.com/rfcs/0004-world-format/) defines worlds. The `$id` URLs are mirrored by docs for authoring; this validator registers all schemas locally and never fetches them.

## Validate

Use Node >=22.12 (CI pins 24.14.0), npm, and the committed lockfile:

```sh
npm ci
npm test
npm run validate -- world examples/world.json
npm run validate -- extension examples/extension.json
npm run validate -- screen-type examples/screen-type.json
npm run validate -- ipc examples/ipc/state.delta.notification.json
npm run validate -- ipc examples/ipc/session.ping.response.json session.ping
cat examples/world.json | npm run validate -- world -
```

Exit 0 = valid, 1 = contract violation, 2 = usage/read/parse failure. The CLI accepts one JSON document up to 1 MiB. Optional method context validates a response against the outstanding request's method, since JSON-RPC responses do not repeat method names. Error responses should be validated as envelopes without a success-method context. Clients must also correlate the response ID themselves.

**Why Node:** the docs toolchain already needs it, Ajv supports draft 2020-12 with strict compilation, and JavaScript matches the reference shell/SDK direction. The CLI adds no global install and uses pinned Ajv and SPDX parser dependencies. Python would add a second tool environment here.

## Scope and limits

Schemas reject unknown fields outside explicit extension maps. The validator adds manifest-local semantic checks: duplicate IDs/material bindings, default spawn references, normalized quaternions, AABB ordering, SPDX expressions, required extension presence, contribution namespaces, advancing deltas and overlay/lease invariants.

This is not a runtime transport parser or package installer. It does not check duplicate JSON keys (JSON.parse retains the last), transport framing/depth/session ordering, live grants, asset existence/rights, attribution coverage, glTF indices/UV1, symlinks, archives, codecs, collision or spawn clearance. RFC-0002/0003/0004 require those checks in core and the future SDK. Do not use a passing manifest as proof a package is safe to execute or load.

`examples/world.json` is an original synthetic manifest exercising metadata; referenced scene/audio files are intentionally not supplied. It is not a playable package. IPC fixtures cover every request, success result, notification and an error; they are independent shape examples, not a chronological authenticated session. Tokens are omitted, so hello demonstrates negotiation shape, not privileged authentication.

## Evolving contracts

Update RFC + schema + positive/negative tests + [CHANGELOG.md](CHANGELOG.md) together. Consumers pin a schema commit/release. New structural or semantic contracts get a new protocol/format identifier; never quietly redefine a released one. docs mirrors these exact files with a recorded source commit and checksums. M0/WIP commits are deliberately available before implementation.

MIT; see [LICENSE](LICENSE).

M1 contracts are frozen separately under `v0.2/`. Select them explicitly:

```js
validate('ipc', frame, responseMethod, '0.2');
validate('world', manifest, undefined, '0.2');
```

CLI: `npm run validate -- world world.json - 0.2`. Existing default calls continue validating 0.1. Wire protocol and package format versions are independent.

First-session IPC `0.3` lives in `v0.3/{common,ipc}.schema.json` and is selected with
`validate('ipc', frame, method, '0.3')`. It adds verified shell-child binding,
workspace locations and bounded map/projection/output descriptors. World format
selection remains 0.1/0.2; optional Map metadata is documented in RFC-0004/0008.

## M3A contract

`v0.5/ipc.schema.json` adds hands-on interaction and workspace app state, plus
custom pose placements. Select version `0.5` explicitly; earlier contracts and
world format 0.3 remain frozen. App icons are theme names, not arbitrary URLs.
