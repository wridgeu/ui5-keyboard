# Adversarial validation of the twin-drift check (`tools/check-twin-drift.mjs`)

Goal: prove the new twin-drift check FAILS on real drift between the kiosk twin
packages (`packages/kiosk-keyboard/src` vs `packages/kiosk-keyboard-webc/src`)
instead of only watching it pass. For each hypothesis we inject a fault, confirm
the check goes red, then revert.

Written before the script, per CLAUDE.md section 7.

## Hypotheses (how a green run could be lying)

| #   | Hypothesis (false-negative path)                                                                                                                  | Adversarial check                                                                                                                         | Expected                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| H1  | A manifest path typo makes a pair compare nothing (missing file treated as empty or skipped) and the check passes.                                | Point one manifest entry at a bogus path, run the check.                                                                                  | loud failure naming the missing file |
| H2  | The normalization (comment strip / whitespace collapse / log-token mapping) strips the very line that drifted, masking real drift.                | Corrupt one layout key value in one twin only (real code, not a comment), run.                                                            | red, diff names the corrupted line   |
| H3  | Non-layout logic drift (e.g. a timing constant) is masked because only layouts are effectively compared.                                          | Change `initialDelayMs` in one twin's `auto-repeat.ts` only, run.                                                                         | red on the auto-repeat pair          |
| H4  | The comment stripper treats `//` inside a string literal as a comment and eats the rest of the line, hiding drift after it.                       | Append a statement containing `"// not a comment"` followed by drifting code on the same line to both twins (drift in one), run.          | red on the drifted statement         |
| H4b | Inverse control for H4: identical lines containing `//` inside strings must NOT produce a spurious red (stripper also must not desync the parse). | Same injection but byte-identical in both twins.                                                                                          | green for that pair                  |
| H5  | The pair manifest silently shrinks (e.g. layouts list hardcoded and a glob/typo drops entries), so the check passes while comparing fewer pairs.  | The script asserts the expected pair count (16 layouts + 4 core modules = 20) and prints it; a manifest edit that drops one must be loud. | count printed; mismatch fails        |
| H6  | Exit code does not propagate (check reports drift in text but exits 0, so CI stays green).                                                        | During H2/H3 reds, capture the process exit code, not just the output.                                                                    | exit code 1                          |

## Results

(Filled in after implementation; each hypothesis cleared only after the check
was SEEN red for it, then the corruption reverted.)

- **H1 CONFIRMED.** Renamed the `qwerty` manifest entry to `qwerty-DOES-NOT-EXIST`; the check exited 1 with `Missing twin file:` naming the bogus absolute path. Missing files are a hard error, never an empty comparison. Reverted.
- **H2 CONFIRMED.** Changed `value: "q"` to `value: "CORRUPTED"` in the kiosk `layouts/qwerty.ts` only; the check exited 1 with a unified diff for the `qwerty.ts` pair showing `-`/`+` lines containing the corrupted key. Normalization does not mask code drift. Reverted.
- **H3 CONFIRMED.** Changed `initialDelayMs: 450` to `451` in `kiosk-keyboard-webc/src/core/auto-repeat.ts` only; the check exited 1 with a diff on the `auto-repeat.ts` pair naming the constant line. Core-module pairs are genuinely compared, not just layouts. Reverted.
- **H4 CONFIRMED.** Appended `export const twinDriftProbe = "see // not a comment" + "1";` to the kiosk `qwerty.ts` and the same line with `+ "2"` to the webc twin; the check exited 1 and the diff showed both full lines including the code after the `//`. The stripper is string-aware and does not eat code after `//` inside a literal. Reverted.
- **H4b CONFIRMED (control).** With the probe line byte-identical in both twins (`+ "1"` on both sides), the `qwerty.ts` pair stayed green (zero `qwerty.ts` hunks in the output; only the pre-existing drifts reported). No spurious red and no parser desync from `//` inside strings. Reverted; `git status` clean for both files.
- **H5 CONFIRMED.** The script asserts `PAIRS.length === 21` before comparing and prints `Comparing 21 twin pairs`. Temporarily deleting the `numpad` entry made the check exit 1 with `Pair manifest has 20 entries, expected 21` before any comparison. Reverted.
  - **Re-validated 2026-06-13.** The manifest later dropped from 21 to 20 pairs: `action-registry` left `CORE_MODULES` when the action subsystem was removed (see `2026-06-11-extensible-keys-enriched-keypress.md`), so `EXPECTED_PAIR_COUNT` is now 20 (16 layouts + 4 core modules). Re-ran the same fault against the shipped 20-pair manifest: deleting `numpad` made the check exit 1 with `Pair manifest has 19 entries, expected 20` before any comparison. Reverted. The count-guard mechanism is unchanged.
- **H6 CONFIRMED.** During the H1, H2, H3, H4, and H5 reds the captured exit
  code was `1` each time (`echo $?` after the run). Drift is reported via a
  non-zero exit code, not just text.

## Known-transient state at validation time (2026-06-11)

Three real drifts were known while this check was built (space-label lines in
kiosk `arabic.ts` / `ja-romaji.ts` vs webc, and webc `symbol-common.ts` vs
kiosk); other agents were fixing them concurrently. The first baseline run of
the finished check reported those three plus a FOURTH, previously unknown
drift: `layouts/special.ts`, where the kiosk twin carries redundant
`label` properties (`{ value: "€", label: "€" }` for the euro,
pound, yen, and bullet keys) that the webc twin omits. All adversarial reds
above were verified to add NEW failures beyond those known pairs, and the
reverts were verified to return the output to exactly the pre-existing set.

## Re-validation after the diff algorithm changed (2026-06-11, follow-up)

The unified-diff core (`lcs`/`ops` build) was reworked to satisfy the repo's
strict `checkJs` (`noUncheckedIndexedAccess`): the LCS now uses plain arrays
with `?? 0` reads, and a one-line `frame` guard narrows the comment-stripper
stack. Because this touched the comparison logic, H2/H3/H6 were re-confirmed
empirically against the updated script:

- **H2 re-confirmed.** `value: "q"` -> `value: "ZZCORRUPT"` in kiosk
  `layouts/qwerty.ts` only -> exit 1, diff names the corrupted line; clean
  (exit 0) after revert.
- **H3 re-confirmed.** `initialDelayMs: 450` -> `457` in webc
  `core/auto-repeat.ts` only -> exit 1, diff names the constant on the
  `auto-repeat.ts` pair; clean after revert.
- **H6 re-confirmed.** Both reds exited 1; the synced tree exits 0.

The four originally-known drifts (three space-label twins + `special.ts`) are
now all reconciled, so the baseline run is green ("All twin pairs are in sync").

## Re-validation after the comment-stripper simplified (2026-06-16, follow-up)

`key-token` was added to `CORE_MODULES`, so the manifest is back to 21 pairs
(16 layouts + 5 core modules). Separately, the comment-stripper lexer was
simplified: the template-literal `${}` mode-stack (`braceDepth` / `fromTemplate`)
was dropped because no checked module nests code in a template literal, so
backtick is now just a third verbatim string delimiter alongside `'` and `"`.
Normalized output is byte-identical for all 21 pairs, so the guard's behavior on
real inputs is unchanged. Because this touched the comment-stripper (the part
H2/H4/H4b exercise), those hypotheses plus H6 were re-confirmed empirically:

- **H2 re-confirmed.** `return "layout"` -> `return "LAYOUT2"` in kiosk
  `internal/key-token.ts` only -> exit 1, diff names the changed line; clean
  (exit 0) after revert.
- **H4 re-confirmed.** Appended `... = "see // not a comment" + "1"` to kiosk
  `internal/key-token.ts` and the same line with `+ "2"` to the webc twin ->
  exit 1, diff shows both full lines including the code after the `//`. The
  stripper is still string-aware after dropping the mode-stack.
- **H4b re-confirmed (control).** The same probe line byte-identical in both
  twins -> green for the `key-token.ts` pair, no spurious red, no parser desync.
- **H6 re-confirmed.** Each red exited 1; the synced tree exits 0.

All reverts left `git status` clean.
