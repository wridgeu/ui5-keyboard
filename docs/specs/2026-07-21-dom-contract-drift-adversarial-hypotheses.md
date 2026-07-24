# DOM-contract drift guard: adversarial hypotheses

- Date: 2026-07-21
- Guard under test: `tools/check-dom-contract-drift.mjs` (`npm run test:dom-contract`)
- Method (CLAUDE.md §7): a green guard can lie. Each hypothesis below is a way a green run could be a false positive. Clear each only after SEEING the guard exit non-zero for it, then revert the perturbation.

## Hypotheses

- **H1 (key parity is live).** If a semantic key is added to one twin and forgotten in the other, the guard must fail with an "unclassified key" message, not pass. Perturbation: add a stray `keyBogus` to kiosk `classes` only. Expected: red.
- **H2 (attributes compared by value, not just key).** If a `data-*` attribute value drifts between twins, the guard must fail. Perturbation: change kiosk `attributes.key` from `"data-key"` to `"data-KEY"`. Expected: red on the `differs` branch.
- **H3 (a missing contract fails loudly, not empty).** If a contract module cannot be imported (renamed/moved), the guard must error out with a non-zero exit, not silently pass having compared nothing. Perturbation: import a nonexistent path. Expected: throw, non-zero exit.
- **H4 (platform-only class allowlist is live).** A key one twin is allowed to carry alone must not be silently accepted on the other. If a webc-only class appears on kiosk, the guard must fail. Perturbation: add the webc-only `variantPopupHost` class to kiosk `classes`. Expected: red on the "kiosk ... unclassified" branch.
- **H5 (platform-only attribute allowlist is live).** The 2026-07-23 rebase onto main added `cqTier` to `ATTR_PARITY.webcOnly`. If a webc-only attribute appears on kiosk, the guard must fail. Perturbation: add `cqTier: "cq-tier"` to kiosk `attributes`. Expected: red on the "attributes: kiosk ... unclassified" branch.

## Results

Re-verified 2026-07-22 after the symmetry revert (category is a class on both twins); H5 verified 2026-07-24 after the `cqTier` webcOnly entry was added on the 2026-07-23 rebase. Each perturbation reverted immediately after observing red.

| Hypothesis | Perturbation                          | Observed                                                                             | Cleared |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------------------ | ------- |
| H1         | stray `keyBogus` in kiosk classes     | red: `classes: kiosk key "keyBogus" is unclassified` (exit 1)                        | yes     |
| H2         | kiosk `data-key` -> `data-KEY`        | red: `attributes: CORE "key" differs (kiosk "data-KEY" vs webc "data-key")` (exit 1) | yes     |
| H3         | import a bogus contract path          | threw `ERR_MODULE_NOT_FOUND`, exit 1 (not a silent empty pass)                       | yes     |
| H4         | webc-only `variantPopupHost` on kiosk | red: `classes: kiosk key "variantPopupHost" is unclassified` (exit 1)                | yes     |
| H5         | kiosk `cqTier: "cq-tier"` in attrs    | red: `attributes: kiosk "cqTier" is unclassified` (exit 1)                           | yes     |
