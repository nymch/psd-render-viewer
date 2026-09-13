import {ja} from "@/lib/i18n/ja";
import type {Dictionary} from "@/lib/i18n";

/**
 * The dictionary the UI reads its text from.
 *
 * With one locale this returns a constant. **It exists so that the seam is in one place**:
 * swapping in locale-aware state later changes this hook and nothing else.
 */
export function useDictionary(): Dictionary {
  return ja;
}
