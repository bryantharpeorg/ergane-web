/**
 * The widths and the themes the Desk suite sweeps — one list, read by both files.
 *
 * 017 FR-008 asks for the four layout laws "at every width and in both themes
 * the Desk suite already sweeps", and until this file there was no single answer
 * to what those were: `desk-world.spec.ts` declared `WIDTHS = [1280, 1600, 2560]`
 * for the fluid-frame claim and `desk.spec.ts` wrote the same three numbers out
 * again for the laws. Two spellings of one list is the shape D-018 and 011's
 * plan D2 both ruled against for the laws themselves — *"a second implementation
 * of the same question, and the two will disagree"* — and it fails the same way
 * here, quietly: a width added to the frame sweep and not to the law sweep
 * leaves a viewport the Desk is claimed to fit and is never measured in.
 *
 * So the requirement's phrase is made literal. There is one list; the laws are
 * swept over it; adding a width to the suite adds it to the laws by
 * construction, and there is no transcription left to drift.
 *
 * **Why these three.** 1280 is the cap the first world shipped and the width
 * FR-001 retired; 1600 is the ordinary operator's frame; 2560 is what the fluid
 * frame was built for (006 FR-001), and it is the width at which a wrapping row
 * stops wrapping — which is where a new collision appears.
 */

/** The three viewports every Desk sweep runs at. */
export const DESK_WIDTHS = [1280, 1600, 2560] as const;

/**
 * Both themes, in the spelling `page.emulateMedia({ colorScheme })` takes.
 *
 * State is never carried by colour alone (constitution VIII), but a law is
 * measured over what is painted, and the two themes paint different boxes over
 * the same glyphs — D-018's defect was a degraded note unreadable in *both*,
 * found because both were swept.
 */
export const THEMES = ["light", "dark"] as const;
