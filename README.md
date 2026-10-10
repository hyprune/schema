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

IPC **0.12** adds recording/replay control and `record.toggle`; 0.11 remains the
climbing contract. Both inherit the 0.10 Performance API. Record/replay mutations
require `input.control`; ordinary observers cannot start capture or replay.

IPC **0.13** adds dev-only `camera.author` grants (`camera.photo`/`camera.release`),
actual camera roll/FOV/lens shift, and Performance controls for ink and visibility.
World **0.5** adds optional `atmosphere.outline` and directed visibility regions.
Older schemas remain frozen. Photo grants are not part of a normal shell grant.

IPC **0.14** adds nullable `graphics.outline_quality` (`fast` or `smooth`).
Fast keeps a one-logical-pixel stroke; smooth honours the world's 1–4 px width.
Low/Medium inherit fast, High/Ultra smooth. This is a graphics-only revision;
world format remains 0.5 and previous IPC schemas remain frozen.

0.14 also adds nullable `outline_width_px` (1–4) and `outline_colour` (three
0–1 display RGB values). These are persistent user graphics overrides; null means
use the current world's authored style. The revision-response envelope uses
`anyOf` so shared `{revision:...}` responses are unambiguous; per-method validation
still supplies the result type.

World format **0.6** adds optional `playable` eye-position volumes (boxes or convex
hulls), per-area regions and maximum fly height, plus explicit `backdrop.farCards`
node declarations. IPC remains 0.15; authoring geometry is not added to IPC area
records. See RFC-0004 for composition, limits and motion semantics.

World format **0.7** keeps the 0.6 world.json shape and allows compressed and
optimised scene assets: `KHR_texture_basisu` (KTX2, material textures only),
`EXT_meshopt_compression` and `KHR_mesh_quantization`. Lightmaps stay PNG.
`validate('scene', gltf, undefined, worldFormat, {world})` (CLI:
`npm run validate -- scene scene.gltf - 0.7 world.json`) checks
`extensionsRequired` and lightmap textures against the world format. Version
gates use `atLeast()`; see RFC-0004 "world 0.7".

IPC **0.16** adds the `upscaler` graphics key (`"fsr1"`, `"bilinear"` or `null` to
inherit the preset) to `graphicsConfig`/`graphicsPatch`. Every 0.15 definition is
otherwise unchanged; earlier schemas stay frozen. See RFC-0003/0008 amendments.

IPC **0.17** adds debug capture notes: the `capture.taken` notification (capture ID,
time and input mode, sent to shells) and `capture.annotate {captureId, note}`
(shell.control; 0-1000 code points, no control characters). Every 0.16 definition
is unchanged. See the RFC-0008 amendment "IPC 0.17 capture notes".
