import type { NavSection } from "../modules/modules";

/** Buttons of the phone bar next to "Today" and "+" */
export const PINNED_COUNT = 2;
export const PINNED_STORE_KEY = "mobile.pinned";

/**
 * The sections of the phone bar and of "More": the ones the person pinned
 * first (when the business still has them), then the first others in menu
 * order to fill the bar.
 */
export const splitPinned = (
  sections: NavSection[],
  chosen: readonly string[] | null | undefined,
): { pinned: NavSection[]; more: NavSection[] } => {
  const picked = (chosen ?? [])
    .map((key) => sections.find((section) => section.key === key))
    .filter((section): section is NavSection => section != null)
    .slice(0, PINNED_COUNT);
  const rest = sections.filter((section) => !picked.includes(section));
  const pinned = [...picked, ...rest].slice(0, PINNED_COUNT);
  return {
    pinned,
    more: sections.filter((section) => !pinned.includes(section)),
  };
};

/** Pins a section, or unpins it; a third pin replaces the oldest one. */
export const togglePinned = (
  chosen: readonly string[],
  key: string,
): string[] =>
  chosen.includes(key)
    ? chosen.filter((item) => item !== key)
    : [...chosen, key].slice(-PINNED_COUNT);
