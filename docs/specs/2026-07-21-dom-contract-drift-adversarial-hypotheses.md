# DOM-contract drift guard: adversarial hypotheses

- Date: 2026-07-21
- Guard under test: `tools/check-dom-contract-drift.mjs` (`npm run test:dom-contract`)
- Method (CLAUDE.md §7): a green guard can lie. Each hypothesis below is a way a green run could be a false positive. Clear each only after SEEING the guard exit non-zero for it, then revert the perturbation.

## Hypotheses

- **H1 (key parity is live).** If a semantic key is added to one twin and forgotten in the other, the guard must fail with an "unclassified key" message, not pass. Perturbation: add a stray `keyBogus` to kiosk `classes` only. Expected: red.
- **H2 (attributes compared by value, not just key).** If a `data-*` attribute value drifts between twins, the guard must fail. Perturbation: change kiosk `attributes.key` from `"data-key"` to `"data-KEY"`. Expected: red on the `differs` branch.
- **H3 (a missing contract fails loudly, not empty).** If a contract module cannot be imported (renamed/moved), the guard must error out with a non-zero exit, not silently pass having compared nothing. Perturbation: import a nonexistent path. Expected: throw, non-zero exit.

## Results

| Hypothesis | Perturbation                      | Observed                                                                        | Cleared |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------- | ------- |
| H1         | stray `keyBogus` in kiosk classes | red: `classes: kiosk key "keyBogus" is unclassified` (exit 1)                   | yes     |
| H2         | kiosk `data-key` -> `data-KEY`    | red: `attributes: "key" differs (kiosk "data-KEY" vs webc "data-key")` (exit 1) | yes     |
| H3         | import a bogus contract path      | threw `ERR_MODULE_NOT_FOUND`, exit 1 (not a silent empty pass)                  | yes     |

All three cleared on 2026-07-21; each perturbation reverted immediately after observing red.
