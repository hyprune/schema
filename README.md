# Hyprune schemas · v0

> **Hyprune** is an explorable, world-driven desktop environment for Hyprland: your workspaces become places you can walk through, with live windows on the walls. This repository holds the versioned **schemas** for world packages, IPC and manifests, and their validator. Install Hyprune through the [hyprune](https://github.com/hyprune/hyprune) repository (starter kits, Nix, Arch); learn more at [hyprune.com](https://hyprune.com). Licence: MIT.

Versioned contracts for Hyprune, a world-driven Hyprland desktop: world packages (formats 0.1–0.8), the IPC protocol (0.1–0.21), object and library manifests (0.9, draft 0.10), extension and screen-type manifests and the input keymap. JSON Schema dialect: **2020-12**. Every version is frozen once published; core, the shell and the SDK pin these exact files. Readable reference: [hyprune.com/reference/schema](https://hyprune.com/reference/schema/).

## Install

```sh
npm i -D @hyprune/schema
npx hyprune-validate world world.json - 0.8             # a world package manifest
npx hyprune-validate scene scene.gltf - 0.8 world.json   # its glTF against the world format
```

```js
import { validate, worldFormats } from '@hyprune/schema';
import schema from '@hyprune/schema/v0.8/world.schema.json' with { type: 'json' };

const result = validate('world', manifest, undefined, worldFormats.at(-1));
if (!result.valid) console.error(result.errors.join('\n'));
```

Every schema file is importable at `@hyprune/schema/v0.N/<name>.schema.json` (`v0/` holds the 0.1 contracts). For a full world authoring workflow (validate, pack, scaffold) use [`@hyprune/sdk`](https://github.com/hyprune/sdk).

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

World format **0.8** adds placed world objects: `objectAssets` (package glTF
assets with optional `spin`/`orbit`/`bob` node animation, a static collision
proxy and `probe`/`unlit` lighting) and `objects` (instances with pose, scale,
speed, phase and an optional ambient override). Objects are render-only apart
from the proxy. Check an asset's glTF with
`validate('scene', gltf, undefined, '0.8', {world, asset: 'armillary'})` (CLI:
`npm run validate -- scene objects/armillary.gltf - 0.8 world.json armillary`).
See RFC-0004 "world 0.8 placed world objects".

IPC **0.16** adds the `upscaler` graphics key (`"fsr1"`, `"bilinear"` or `null` to
inherit the preset) to `graphicsConfig`/`graphicsPatch`. Every 0.15 definition is
otherwise unchanged; earlier schemas stay frozen. See RFC-0003/0008 amendments.

IPC **0.17** adds debug capture notes: the `capture.taken` notification (capture ID,
time and input mode, sent to shells) and `capture.annotate {captureId, note}`
(shell.control; 0-1000 code points, no control characters). Every 0.16 definition
is unchanged. See the RFC-0008 amendment "IPC 0.17 capture notes".

IPC **0.18** scales the offload power cap to the device: `offload_power_cap_w`
accepts 20-1000 W or `null` (automatic, the new default), and the new
`offload_device` key is `"auto"` or a lowercase PCI address. `performance` reports
where its cap comes from (`capSource`) and the chosen GPU (`device`, or `null`).
Every 0.17 definition is otherwise unchanged. See the RFC-0009 amendment
"IPC 0.18 device-scaled offload power and device selection".

IPC **0.19** adds player settings (`player.get`/`player.set`: walk/run speed, view
bob, reticle style/size/colour and reach limits), widens graphics `fov` to 30-120,
adds `reticleColor`/`validColor`/`invalidColor` to the overlay style and the
required `interaction.reticle {state, action}`. Every other 0.18 definition is
unchanged. See the RFC-0006 amendment "IPC 0.19 player settings and reticle".

IPC **0.20** adds `surface.pocket`/`surface.unpocket` (surface.control): put a
world window into the pocket (the Placement queue) and take it out again, placed
in front of the player or selected for the Placement tool (`placed`). Pocket state
stays `editor.unplaced.windows`. `spatial.map` gains optional `levels` (1-6
per-level blueprint SVGs). `extensions/blueprint.schema.json` defines the world
extension `com.hyprune.blueprint` 0.1 that supplies them. Every other 0.19
definition is unchanged. See the RFC-0004 and RFC-0005 amendments for IPC 0.20.

IPC **0.21** adds markers, personal quests and focus sessions (RFC-0012 P1). Three
new required state keys: `markers` (the marker reveal, the persistent-marker mode
and up to 64 resolved markers), `quests` (tracked and up to 16 active quests,
counts) and `focus` (the focus session phase, monotonic phase times, credited
time, cycles and target). New methods `markers.reveal` (shell.control),
`guidance.get`/`guidance.set` (marker, quest and focus settings, the `player.get`
pattern), `quests.list/get/track/accept/abandon/resume/create/update/delete/mark`
and `focus.start/pause/resume/skip/stop/history`; mutations need the new
`quest.control` grant. Events `quest.progress` and `focus.phase`. The world keymap
gains `markers.reveal`, the overlay style a required `questColor`, and
`spatial.projection` markers an optional `markerId`. File schemas in `v0.21/`:
`quests-personal.schema.json` (`quests/personal.json`), `guidance.schema.json`
(`guidance.json`) and `focus-history.schema.json` (one `focus/history.jsonl`
line). Every other 0.20 definition is unchanged. See RFC-0012.

## Objects and libraries (RFC-0011)

Object manifests (`object.json`) and library manifests (`library.json`) use the
world format numbering and start at **0.9** (`v0.9/object.schema.json`,
`v0.9/library.schema.json`); `v0.9/library-releases.schema.json` describes the
meta repository's `libraries/releases.json`. `v0.10/` holds a **draft** that adds
the `mover` trait, RFC-0013's `machine` trait and the extra slot kinds; it may
change until world format 0.10 is defined.

```js
import { validate, objectFormats } from '@hyprune/schema';
const result = validate('object', manifest, undefined, undefined, { gltf, directory: 'street-lantern' });
// result.errors, result.warnings, result.triangles
```

```sh
npm run validate -- object examples/object.json
npm run validate -- object objects/bench/object.json - 0.9 objects/bench/object.glb
npm run validate -- library examples/library.json
npm run validate -- library-releases examples/library-releases.json
```

The validator is pure: it never reads files. Pass `gltf` (the parsed glTF or a
GLB's JSON chunk) for the scene cross-checks, and `files`, `thumbnail` and
`measured` (exact rest bounds, largest texture, GPU bytes) when you have them;
`@hyprune/sdk`'s `hyprune object check <dir>` gathers all of them for a directory.
