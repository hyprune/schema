// Type declarations for lib/validate.mjs.

/** Schema kinds `validate` accepts; `scene` checks a scene.gltf against its world format. */
export type ContractKind = 'world' | 'extension' | 'screen-type' | 'ipc' | 'scene' | 'object' | 'library' | 'library-releases' | 'import' | 'project' | 'material' | 'primitive';

export interface ValidationResult {
  valid: boolean;
  /** JSON-pointer-prefixed messages; empty when valid. */
  errors: string[];
  /** Kinds object, library and library-releases: advisory messages (never make a document invalid). */
  warnings?: string[];
  /** Kind object with a glTF: triangles drawn by the scene. */
  triangles?: number;
}

export interface ValidateOptions {
  /** For kind `scene`: the package's parsed world.json (lightmap checks). */
  world?: unknown;
  /**
   * For kind `scene` from world 0.8: validate `value` as the glTF of this
   * `world.objectAssets[].id` (extension rules, animation and collision node
   * names, nesting; from 0.9 also an inline character's skin and clips) instead
   * of the world's scene.gltf.
   */
  asset?: string;
  /**
   * For kind `world` from 0.9: the parsed object.json of `dir` and `library` object
   * assets, keyed by `objectAssets[].id`. Their traits make the character-only
   * fields, seat anchor references, `locked` and the character limit checkable as
   * for inline assets; without them those checks skip the asset.
   */
  assets?: Record<string, { id?: string; formatVersion?: string; traits?: Record<string, unknown> }>;
  /** Kind object: the parsed scene glTF (or a GLB's JSON chunk) for node, material, variant, clip, budget and bounds checks. */
  gltf?: unknown;
  /** Kind object: the directory name, which must equal the object id. */
  directory?: string;
  /** Kind object: every file of the object directory (attribution coverage and limits); kind library: every file of the library. */
  files?: ReadonlyArray<{ path: string; size: number }>;
  /** Kind object: the thumbnail PNG's size. */
  thumbnail?: { width: number; height: number; bytes: number };
  /** Kind object: values that need decoded geometry or images. */
  measured?: { bounds?: { min: number[]; max: number[] }; maxTextureSize?: number; gpuBytes?: number };
  /** Kind library: each listed object's parsed object.json, keyed by directory name. */
  objects?: Record<string, { id?: string; formatVersion?: string }>;
  /** Kind object: the directory's parsed import.json (RFC-0014), validated as kind `import`. */
  importRecord?: unknown;
}

/**
 * Validate one parsed JSON document against a published contract version.
 * @param kind     contract kind
 * @param value    parsed document (world.json, extension.json, an IPC frame, scene.gltf)
 * @param method   IPC only: the outstanding request's method, to validate a response's result
 * @param version  world format or IPC version, e.g. '0.7' or '0.19' (default '0.1'); for objects and
 *                 libraries the object format (default: the document's formatVersion)
 * @throws on an unknown kind, version or method (usage errors, not validation failures)
 */
export function validate(kind: ContractKind, value: unknown, method?: string, version?: string, options?: ValidateOptions): ValidationResult;

/** True when dotted version `version` is at least `minimum` (numeric comparison). */
export function atLeast(version: string, minimum: string): boolean;

/** World formats with a published schema, oldest first. */
export const worldFormats: readonly string[];
/** IPC protocol versions with a published schema, oldest first. */
export const ipcProtocols: readonly string[];
/** Every contract version directory, oldest first. */
export const contractVersions: readonly string[];
/** Object manifest formats with a published schema (RFC-0011; world format numbering from 0.9). */
export const objectFormats: readonly string[];
/** RFC-0011 directory, asset and library limits the object and library checks apply. */
export const objectLimits: Readonly<Record<string, number>>;
/** A workspace screen anchor's aspect (object format 0.11): '16:9' within 0.5 %, '21:9' from 2.33 to 2.39, else null. */
export function screenAspect(size: readonly [number, number] | readonly number[]): '16:9' | '21:9' | null;
/** Workspace screen limits: the anchor's smallest height at scale 1 and how far it may reach past the bounds. */
export const screenLimits: Readonly<{ minHeight: number; boundsMargin: number }>;
/** Object format 0.11: hard caps for ordinary objects; objectLimits become recommendations (warnings) below them. */
export const objectHardCaps: Readonly<{ triangles: number; textureSize: number; gpuBytes: number; collisionTriangles: number; files: number; directoryBytes: number; fileBytes: number }>;
/** World 0.9 limits the world checks apply: character instances, characters per path, path points in total, minimum arc chord (m). */
export const worldLimits: Readonly<{ characters: number; charactersPerPath: number; pathPoints: number; arcChord: number }>;
/** glTF extensions a scene may list in extensionsRequired for a world format. */
export function sceneExtensions(version: string): string[];

/** Registry document kinds (RFC-0015). `registry-entry` is one index entry (a registry entry file may add `$schema`). */
export type RegistryKind = 'registry-index' | 'registry-entry' | 'release-record' | 'sources' | 'content-lock';
/**
 * Validate a registry document against `registry/v<version>/` (default: the newest) plus the
 * semantic rules: unique ids, versions unique and newest first (SemVer), tags naming their
 * version (`v<version>` or `<name>-v<version>`), SPDX expressions, per-type archive limits.
 * @throws on an unknown kind or version
 */
export function validateRegistry(kind: RegistryKind, value: unknown, version?: string): ValidationResult;
/** Registry format versions with published schemas (registry/v0.N), oldest first. */
export const registryVersions: readonly string[];
/** RFC-0015 archive limits per package type and index limits. */
export const registryLimits: Readonly<{
  world: Readonly<{ bytes: number; expandedBytes: number; files: number; fileBytes: number }>;
  library: Readonly<{ bytes: number; expandedBytes: number; files: number; fileBytes: number }>;
  index: Readonly<{ bytes: number; entries: number; versions: number; thumbnails: number; custom: number }>;
}>;
/** A parsed SemVer 2.0 version, or undefined when invalid. */
export function parseSemver(text: unknown): { major: number; minor: number; patch: number; prerelease: string[]; build: string | null } | undefined;
/** SemVer precedence (-1, 0, 1; build metadata ignored). Throws on invalid input. */
export function compareSemver(a: string, b: string): -1 | 0 | 1;
/** The version a tag names (`v<version>` or `<name>-v<version>`), or undefined. */
export function tagVersion(tag: unknown): { name: string | null; version: string } | undefined;
