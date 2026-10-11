// Type declarations for lib/validate.mjs.

/** Schema kinds `validate` accepts; `scene` checks a scene.gltf against its world format. */
export type ContractKind = 'world' | 'extension' | 'screen-type' | 'ipc' | 'scene' | 'object' | 'library' | 'library-releases';

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
   * names, nesting) instead of the world's scene.gltf.
   */
  asset?: string;
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
/** glTF extensions a scene may list in extensionsRequired for a world format. */
export function sceneExtensions(version: string): string[];
