# Changelog

## 0.1.0 (2026-09-13)


### Features

* **tools:** flag comments that restate the statement below them ([35c9c84](https://github.com/wridgeu/ui5-keyboard/commit/35c9c842c79f1f5289ee33e2c63c91c6b81b1b9a))


### Bug Fixes

* **demo:** size the custom elements from the theme field tokens ([90a7062](https://github.com/wridgeu/ui5-keyboard/commit/90a7062b3c0e6d89b4da913be5a15a4aada493ce))
* finish the [#265](https://github.com/wridgeu/ui5-keyboard/issues/265) sweep - real coverage for three unguarded paths ([854a2e1](https://github.com/wridgeu/ui5-keyboard/commit/854a2e16d44847c44f5b35a28b111e92b6fbd45a))
* finish the [#265](https://github.com/wridgeu/ui5-keyboard/issues/265) sweep - real coverage for three unguarded paths ([a1faee0](https://github.com/wridgeu/ui5-keyboard/commit/a1faee02134869e7ca0f3f6421069b1ea7265df2))
* **hotkeys:** keep macOS Option+digit matching its digit hotkey ([c1f4510](https://github.com/wridgeu/ui5-keyboard/commit/c1f4510649fb6446508bf2e0dd135f1107d66170))
* **hotkeys:** keep the instanceof assertion type-checkable ([5743833](https://github.com/wridgeu/ui5-keyboard/commit/5743833540d00a9580d2e7f0705a580bca60e1a9))
* **hotkeys:** reset to the global scope on the router's bypassed event ([76194fc](https://github.com/wridgeu/ui5-keyboard/commit/76194fcbdf8d3bfe0fd4d558ef4d5db39887fc37)), closes [#306](https://github.com/wridgeu/ui5-keyboard/issues/306)
* **hotkeys:** stop matching keys the user did not type ([d2c6258](https://github.com/wridgeu/ui5-keyboard/commit/d2c62587aed9ed1ec2e4fcc052270aaecdc77161))
* **hotkeys:** stop matching keys the user did not type ([2518dd7](https://github.com/wridgeu/ui5-keyboard/commit/2518dd761971aa390d56ad27b08759fc5dfbff52))
* library bugs from the QA sweeps ([#296](https://github.com/wridgeu/ui5-keyboard/issues/296), [#302](https://github.com/wridgeu/ui5-keyboard/issues/302), [#306](https://github.com/wridgeu/ui5-keyboard/issues/306), [#297](https://github.com/wridgeu/ui5-keyboard/issues/297)) ([e61e109](https://github.com/wridgeu/ui5-keyboard/commit/e61e1097a247b182ff414b87f69fc76d8f2c1b5f))
* put the kiosk live region back in the a11y tree, drop the plural slot ([#247](https://github.com/wridgeu/ui5-keyboard/issues/247), [#254](https://github.com/wridgeu/ui5-keyboard/issues/254)) ([df1a47c](https://github.com/wridgeu/ui5-keyboard/commit/df1a47c348b96d25ae1da08077000881199e31f0))
* **repo:** make the Arabic probe platform-honest and close the audit findings ([227b1d3](https://github.com/wridgeu/ui5-keyboard/commit/227b1d374babd8edb5ec602c7b294c8f7b5dacd5)), closes [#221](https://github.com/wridgeu/ui5-keyboard/issues/221)
* **webc:** announce through the framework's light-DOM live region ([4e11d6f](https://github.com/wridgeu/ui5-keyboard/commit/4e11d6f9bb743ed47ee712f0c7cef2ecb4341a95))


### Code Refactoring

* deslop the live-region diff ([10acbae](https://github.com/wridgeu/ui5-keyboard/commit/10acbae339b4096c78cde8a98168f8c50444e4f5))
* drop dead code, vacuous guards, and stale lint suppressions ([c957a8c](https://github.com/wridgeu/ui5-keyboard/commit/c957a8ca7c4ed5790979c4253a26802c0625ed7a))
* **hotkeys:** count registration ids inline instead of through a factory ([006fed5](https://github.com/wridgeu/ui5-keyboard/commit/006fed582950d4296648695ea51ed315a91b4438))
* **hotkeys:** record off-path skips as a plain void pass ([63adb07](https://github.com/wridgeu/ui5-keyboard/commit/63adb0773bfa8247f7f20abc6cd78110997219ee))
* **kiosk:** detach listeners through AbortSignal, drop unused exports ([#174](https://github.com/wridgeu/ui5-keyboard/issues/174)) ([0241141](https://github.com/wridgeu/ui5-keyboard/commit/024114122bc91bd7a3805fb71fabe84923e4de00))
* read the platform from Device, walk src once with readdirSync ([2f1bb7f](https://github.com/wridgeu/ui5-keyboard/commit/2f1bb7f3155a8b480eccaf120d74bc6cdcde769b))
* split the thirteen functions the complexity rule flags ([c6e407b](https://github.com/wridgeu/ui5-keyboard/commit/c6e407be320d5e9e18ddfe65973118e89a1a94a4))
* **tools:** type the lint plugins against oxlint instead of ESLint ([ef85098](https://github.com/wridgeu/ui5-keyboard/commit/ef850983fb6cc78beefb25f7ba8ae0e5d1e6cfcd))


### Performance Improvements

* **ci:** cut CI minutes with native Playwright and Actions settings ([54097f3](https://github.com/wridgeu/ui5-keyboard/commit/54097f390649309827b04df9cb6629a0bc8ab6fc))
