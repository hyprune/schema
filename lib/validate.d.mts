// Type declarations for lib/validate.mjs.

/** Schema kinds `validate` accepts; `scene` checks a scene.gltf against its world format. */
export type ContractKind = 'world' | 'extension' | 'screen-type' | 'ipc' | 'scene';

export interface ValidationResult {
  valid: boolean;
  /** JSON-pointer-prefixed messages; empty when valid. */
  errors: string[];
}

export interface ValidateOptions {
  /** For kind `scene`: the package's parsed world.json (lightmap checks). */
  world?: unknown;
}

/**
 * Validate one parsed JSON document against a published contract version.
 * @param kind     contract kind
 * @param value    parsed document (world.json, extension.json, an IPC frame, scene.gltf)
 * @param method   IPC only: the outstanding request's method, to validate a response's result
 * @param version  world format or IPC version, e.g. '0.7' or '0.19' (default '0.1')
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
/** glTF extensions a scene may list in extensionsRequired for a world format. */
export function sceneExtensions(version: string): string[];
