/**
 * Runtime loader for the genetics_trait_overrides table.
 *
 * Fetches once per session (cached promise), merges rows into the
 * calculator catalog via applyTraitOverrides, and resolves with the
 * applied ids so calling components can re-render. Failure is a silent
 * no-op: the static catalog is always a correct fallback, and the
 * public calculator must never break because a data fetch did.
 */
import { applyTraitOverrides } from './calculatorCatalog';

let loadPromise = null;

export function loadTraitOverrides() {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const { GeneticsTraitOverride } = await import('@/entities/all');
        const rows = await GeneticsTraitOverride.list();
        return applyTraitOverrides(rows || []);
      } catch {
        return [];
      }
    })();
  }
  return loadPromise;
}

/** Test hook. */
export function resetTraitOverrideLoader() {
  loadPromise = null;
}
