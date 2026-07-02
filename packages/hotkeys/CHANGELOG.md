# Changelog

## 1.0.0 (2026-07-02)


### Features

* add data-row-kind row classification for CSS targeting ([5f77671](https://github.com/wridgeu/ui5-keyboard/commit/5f77671e72f744a04592372e8bd39c89022470f7))
* **hotkeys:** flip suppressInPopups default to true ([#81](https://github.com/wridgeu/ui5-keyboard/issues/81)) ([b093643](https://github.com/wridgeu/ui5-keyboard/commit/b0936436ca401dbb6cfc0bcc6e2d1831866719d1))
* **hotkeys:** support suppressInPopups for sequences ([#88](https://github.com/wridgeu/ui5-keyboard/issues/88)) ([#90](https://github.com/wridgeu/ui5-keyboard/issues/90)) ([1d7c15f](https://github.com/wridgeu/ui5-keyboard/commit/1d7c15fdc37956746690903588a8027ea55adee4))


### Bug Fixes

* address code review findings (webc consumption, composition, tooling, docs) ([#107](https://github.com/wridgeu/ui5-keyboard/issues/107)) ([73d2637](https://github.com/wridgeu/ui5-keyboard/commit/73d2637ea21cc8cc51d3aa3514ced93ee609a4e1))
* address PR [#102](https://github.com/wridgeu/ui5-keyboard/issues/102) review findings + full docs audit ([6f6d8f7](https://github.com/wridgeu/ui5-keyboard/commit/6f6d8f7897c150fbafefa6ad1ba70c009dff0344))
* address verified review findings + standardize Node 24 ([#135](https://github.com/wridgeu/ui5-keyboard/issues/135)) ([4c43784](https://github.com/wridgeu/ui5-keyboard/commit/4c4378467e34f38b6bc5caf58c79d12aaf385baf))
* **ci:** harden release workflow and clean up docs and patches ([6975b63](https://github.com/wridgeu/ui5-keyboard/commit/6975b6358e5ed65d38a9c24e37d95ce80528bf72))
* **ci:** parallelize hotkeys QUnit tests and remove redundant lint rule ([c87ef6e](https://github.com/wridgeu/ui5-keyboard/commit/c87ef6ede0d68ba74626c3d8c30e1ff980bd0265))
* **ci:** prevent Chrome renderer crash on GitHub Actions ([574007d](https://github.com/wridgeu/ui5-keyboard/commit/574007d667662708962216b8386eb59a45bdd964))
* **ci:** review findings -- cache, actions, Node 24, docs, tests ([2fa55eb](https://github.com/wridgeu/ui5-keyboard/commit/2fa55eb0d5e8d2525ad3a6cdce9d42cf7a670472))
* **deps:** bump tilde ranges to latest minors for all UI5 tooling ([409a4d2](https://github.com/wridgeu/ui5-keyboard/commit/409a4d2025e9eb497e79a948d68d769c7f561ae9))
* full project audit -- links, deps, baselines, and server errors ([58ac3b3](https://github.com/wridgeu/ui5-keyboard/commit/58ac3b3df06f4da85bff1fb58fbc286468eee03b))
* **hotkeys:** exclude readonly inputs from input suppression ([ab476f5](https://github.com/wridgeu/ui5-keyboard/commit/ab476f5d9b865583fa3227bf95d82b14e1267b59))
* **kiosk-keyboard-webc:** don't announce "shift off" when releasing Caps Lock ([d5a5eef](https://github.com/wridgeu/ui5-keyboard/commit/d5a5eefec956656fa60aa2a91bd6368948612c20))
* pass Error objects to Log.error/Log.warning vDetails parameter ([c0d25e4](https://github.com/wridgeu/ui5-keyboard/commit/c0d25e4b9d629e45a4010ddadc90e31bd6dd7bc2))
* remove dead wrapper and clean up highlight listener leak ([d563acf](https://github.com/wridgeu/ui5-keyboard/commit/d563acf700b6ccce4e5dc6b07dc0babe7a79dfd3))
* repo-wide audit fixes, layout restore, and documentation overhaul ([f8c6de1](https://github.com/wridgeu/ui5-keyboard/commit/f8c6de1eef663c7268f7198ad61f83ad4c2b2715))
* **tests:** use enum members instead of string literals ([#71](https://github.com/wridgeu/ui5-keyboard/issues/71)) ([eb224b9](https://github.com/wridgeu/ui5-keyboard/commit/eb224b92c58c9e33849d26a7d0b206d56739f0d1))


### Code Refactoring

* apply thermonuclear + ponytail review cleanups and refresh docs ([b58111b](https://github.com/wridgeu/ui5-keyboard/commit/b58111b1ce1e185a120a08cceca169615cd6c07e))
* apply verified e2e-review findings across packages ([ca7c7e4](https://github.com/wridgeu/ui5-keyboard/commit/ca7c7e42eb20a77bc9759547305742360f2d832c))
* apply verified e2e-review findings across packages ([74d6d01](https://github.com/wridgeu/ui5-keyboard/commit/74d6d01d873416d5219763125c6c9d260efcbf80))
* code review fixes across all packages ([ef2bdfe](https://github.com/wridgeu/ui5-keyboard/commit/ef2bdfe9c27af637debdfaee0d5d82f37517a9de))
* code review fixes across all packages ([4aeb9c6](https://github.com/wridgeu/ui5-keyboard/commit/4aeb9c657b94df96f667fda2c7c57f7d1ac32fa9))
* decompose the three god-classes into focused controllers/modules ([#114](https://github.com/wridgeu/ui5-keyboard/issues/114)) ([efdb70f](https://github.com/wridgeu/ui5-keyboard/commit/efdb70f26e5e636814d4b88841be36a3a16727b4))
* dedup enabled() resolution, hoist target-switch predicate, reuse webc locale fallback ([#125](https://github.com/wridgeu/ui5-keyboard/issues/125)) ([985f339](https://github.com/wridgeu/ui5-keyboard/commit/985f33999acb61d3eb4e6beccb5e85a659e79e89))
* drop hotkeys module-closure caches and the runtimeHooks test seam ([#129](https://github.com/wridgeu/ui5-keyboard/issues/129)) ([f0a1f64](https://github.com/wridgeu/ui5-keyboard/commit/f0a1f64f042f6d4f588e2f7ea415fd8409542f67))
* eliminate sentinel values and improve internal state types ([c1c5f1a](https://github.com/wridgeu/ui5-keyboard/commit/c1c5f1a736b22eb6fa456128bd3f115f2cd45a43))
* **hotkeys:** collapse listener teardown and dedupe hotkey formatting ([ac56b10](https://github.com/wridgeu/ui5-keyboard/commit/ac56b104d44ae333c5b03b9fc654b5d1e4982909))
* **hotkeys:** fix validation no-op, collapse unhandled-context pipeline, trim dead code ([20f2cd2](https://github.com/wridgeu/ui5-keyboard/commit/20f2cd2fcec14e2f7535407a146d3e2b2b9953d0))
* **hotkeys:** instance-based lifecycle, review fixes, nav row wrapping ([#67](https://github.com/wridgeu/ui5-keyboard/issues/67)) ([7af0514](https://github.com/wridgeu/ui5-keyboard/commit/7af05143d329060265b998582978fb8dd9545e94))
* **hotkeys:** remove debug mode, skip visual e2e in CI ([9028318](https://github.com/wridgeu/ui5-keyboard/commit/902831800b73181355e7c6ca4001852c1e7ea789))
* **hotkeys:** within-module simplifications ([6bbeef0](https://github.com/wridgeu/ui5-keyboard/commit/6bbeef0b8a8fa7d1ddf52b52a77da964d4c0ce2e))
* model hotkey target as a discriminated union ([#126](https://github.com/wridgeu/ui5-keyboard/issues/126)) ([828b74a](https://github.com/wridgeu/ui5-keyboard/commit/828b74a07f6f2cd89326515dacb20e3e0b22adee))
* single source of truth for the hotkey/sequence option set ([#119](https://github.com/wridgeu/ui5-keyboard/issues/119)) ([#128](https://github.com/wridgeu/ui5-keyboard/issues/128)) ([8c782f5](https://github.com/wridgeu/ui5-keyboard/commit/8c782f553eddac26bb301d8c33abe93bfa93480b))
* update moduleResolution to Bundler, revert RegistrationGroup change ([8cc1e4f](https://github.com/wridgeu/ui5-keyboard/commit/8cc1e4fb756be0963b0643f19a88281edc68cc87))
* use TypeScript enums for UI5 runtime types ([#71](https://github.com/wridgeu/ui5-keyboard/issues/71)) ([f85a641](https://github.com/wridgeu/ui5-keyboard/commit/f85a641757b9212d36fc656d8eebccd1a9481b14))


### Performance Improvements

* direct ID lookup in RegistrationGroup introspection ([3d8953b](https://github.com/wridgeu/ui5-keyboard/commit/3d8953bca7f8e4e93f7d464c7cd66cd0c4ea881d))
* use direct ID lookup in RegistrationGroup introspection ([009197f](https://github.com/wridgeu/ui5-keyboard/commit/009197f1e260ff4834dc4095b4d87c1a5678d7d1)), closes [#40](https://github.com/wridgeu/ui5-keyboard/issues/40)
