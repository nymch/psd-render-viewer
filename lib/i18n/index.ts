import type {ja} from "@/lib/i18n/ja";

/**
 * The contract a locale satisfies, derived from `ja` rather than maintained separately.
 *
 * A second locale declared as `Dictionary` makes a missing key and a mismatched argument both
 * compile errors. This works only because `ja` is not `as const` — see the note there.
 */
export type Dictionary = typeof ja;
