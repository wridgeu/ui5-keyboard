# Cross-Cutting Proposals

These documents cover repository-wide proposals that are not part of the current contract unless explicitly implemented.

- [CJK Glyph Centering](./CJK-GLYPH-CENTERING.md) (partially implemented, remaining work blocked)
- [Custom Font Face](./CUSTOM-FONT-FACE.md)

The following proposals were fully implemented and their documentation removed (the code is the source of truth):

- **Japanese and Arabic Layouts** (ja-romaji, ja-kana, arabic) -- implemented in both packages
- **Icon + Text Keys** (dual icon/label on modifier and action keys) -- implemented via `--kiosk-keyboard-dual-*` CSS variables
- **Composition Middleware** (script-specific input processing) -- implemented as middleware registry with kana dakuten and hangul compose
- **Layout Tree-Shaking** (split entry points for WebC) -- implemented via `./core`, `./layouts/*`, `./middleware/*` exports

When a proposal is implemented, deferred, or rejected, update its status line and move it to a more appropriate long-term location if needed.
