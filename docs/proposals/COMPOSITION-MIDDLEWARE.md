# Composition Middleware

> Design spec for [#53](https://github.com/wridgeu/ui5-lib-keyboard/issues/53)
> Builds on: [#45 layout tree-shaking](https://github.com/wridgeu/ui5-lib-keyboard/issues/45), `docs/proposals/LAYOUT-TREESHAKING.md`

## Problem

The keyboard is a pure data-emitter: it maps key presses to characters and inserts them. Scripts like Korean Hangul and Japanese Kana require composition logic between key press and text insertion -- combining individual characters into composed forms (e.g., jamo into syllables, base kana + dakuten into voiced kana). Today this is delegated to the consuming application, weakening the direct-input story.

## Terminology

- **Composition middleware** -- an optional processing step in the key-to-text pipeline that handles script-specific composition logic. Not an "engine registry" -- there is no catalog of interchangeable engines. One middleware per layout, activated automatically.
- **Preedit** -- uncommitted text being composed in the target input field. Displayed using standard `CompositionEvent`s. Replaced as composition progresses, committed when composition ends.

## Design Decisions

### Middleware, not engine registry

The processing logic is determined by the layout. Korean Hangul needs jamo composition; Japanese Kana needs dakuten lookup; QWERTY needs nothing. There is no scenario where a consumer browses a catalog of engines. "Middleware" describes the reality: an optional step in the key processing pipeline.

### One middleware per layout

No stacking, no ordering, no pipeline of multiple processors. If a layout's processing needs grow, the middleware itself grows. This avoids coordination complexity for a use case that doesn't exist.

### Automatic activation

Middleware activates when its associated layout is active and deactivates (committing any preedit) on layout switch. Importing the middleware module is the only opt-in step (WebC). No properties or API calls needed to enable it.

### Middleware wraps the full input operation

The middleware receives the raw key value (`"{backspace}"`, `"a"`, etc.) and the target element. It decides what to do: buffer for composition, commit composed text, decompose on backspace, or pass through. This gives it full control over preedit management, backspace behavior (decompose last jamo instead of deleting the whole syllable), and `CompositionEvent` dispatch.

### Layout stays pure data

Layouts do not declare or import their middleware. The middleware declares which layouts it serves. This keeps layouts tree-shakeable independently -- a consumer can import `ko-hangul` without the composition middleware if their application handles composition externally.

### Same modularity split as layouts

- **WebC:** Self-registering middleware modules via `_registerMiddleware`. Tree-shakeable. Consumer imports what they need.
- **UI5:** Middleware centrally imported by the library. Always available in `library-preload.js`. Activates automatically for associated layouts.
- **Full vs core:** Neither the full nor the core WebC entry includes middleware. Middleware is always a separate explicit import because it changes behavior, not just data availability.

## Script Complexity Spectrum

| Level | What's needed                     | Examples                                 | Middleware?  |
| ----- | --------------------------------- | ---------------------------------------- | ------------ |
| **0** | Nothing beyond layout             | Latin, Cyrillic, Arabic, Hebrew          | No           |
| **1** | Input validation                  | Thai (reject invalid sequences)          | Minimal      |
| **2** | Simple modifier/lookup            | Japanese kana (dakuten), Indic (virama)  | Light        |
| **3** | Stateful composition with preedit | Korean Hangul (jamo -> syllable)         | Yes          |
| **4** | Dictionary + candidate selection  | Chinese Pinyin, Japanese Romaji-to-Kanji | Out of scope |

Arabic contextual shaping and Indic conjunct formation are handled by the browser's text rendering engine, not the keyboard. The keyboard's job is to insert the correct Unicode characters.

Level 4 (dictionary-based IME) is out of scope for a kiosk keyboard due to dictionary data requirements (50KB-5MB+) and candidate selection UI complexity.

## Middleware Interface

```ts
interface CompositionMiddleware {
  /** Process a key event. Returns true if consumed (keyboard skips default handling). */
  handleKey(key: string, target: HTMLElement): boolean;

  /** Force-commit any in-progress composition. Returns committed text or null. */
  commit(): string | null;

  /** Clear all composition state without committing. */
  reset(): void;
}
```

### How the keyboard uses it

In `_onKeyClick`, after resolving the character and firing the `key-press` event:

```ts
const middleware = getMiddlewareForLayout(this._currentLayout);
if (middleware && middleware.handleKey(key, target)) return;
// ... existing default handling (insertText, handleBackspace, etc.)
```

If `handleKey` returns `true`, the keyboard skips its default logic. If `false`, the keyboard proceeds normally (pass-through for keys the middleware doesn't care about).

### What `handleKey` receives

- `key`: the raw key value string -- a character (`"a"`), a special key (`"{backspace}"`), or an action (`"{enter}"`, `"{shift}"`)
- `target`: the DOM element to write to

The middleware calls `insertText`, `handleBackspace`, and dispatches `CompositionEvent`s itself. It decides what to pass through -- for Hangul, letters and backspace are consumed; shift, layout switches, and enter are passed through.

### Lifecycle

- **Layout switch:** `commit()` the current middleware (flush preedit to target), discard the instance
- **Focus loss / target change:** `commit()` to avoid orphaned preedit text
- **Component destroy:** `reset()`

## Registration and Activation

### Middleware registry (`core/middleware-registry.ts`)

```ts
function _registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void;
function registerMiddleware(layouts: string[], factory: () => CompositionMiddleware): void;
function getMiddlewareForLayout(layout: string): CompositionMiddleware | null;
```

The registry stores a **factory function**, not an instance. A fresh instance is created when the layout activates, ensuring clean state. The instance is reused until the layout deactivates.

- `_registerMiddleware` -- internal, idempotent, for self-registering modules (WebC)
- `registerMiddleware` -- public API, allows consumer-provided middleware, can override built-ins
- `getMiddlewareForLayout` -- called by the keyboard. Lazily creates instance from factory on first call for the active layout. On layout switch, calls `commit()` on the outgoing instance and discards it.

### Self-registering module (WebC)

```ts
// middleware/hangul-compose.ts
import { _registerMiddleware } from "../core/middleware-registry.js";

function createHangulMiddleware(): CompositionMiddleware {
  // ... state machine, preedit tracking
  return { handleKey, commit, reset };
}

_registerMiddleware(["ko-hangul"], createHangulMiddleware);
```

### Consumer usage

**WebC:**

```js
// Full entry + middleware
import "kiosk-keyboard-webc";
import "kiosk-keyboard-webc/middleware/hangul-compose";

// Core + selective
import "kiosk-keyboard-webc/core";
import "kiosk-keyboard-webc/layouts/ko-hangul";
import "kiosk-keyboard-webc/middleware/hangul-compose";
```

**UI5:** Middleware modules are centrally imported by the library. Always available. Activates automatically when the associated layout is used.

## Preedit Text Handling

Middleware manages preedit text in the target input field using the browser's standard `CompositionEvent` API.

### Composition flow (example: typing Korean 한)

1. User presses `ㅎ` -- middleware dispatches `compositionstart`, inserts `ㅎ` as preedit
2. User presses `ㅏ` -- middleware dispatches `compositionupdate`, replaces preedit with `하`
3. User presses `ㄴ` -- middleware dispatches `compositionupdate`, replaces preedit with `한`
4. User presses a non-jamo key or switches layout -- middleware dispatches `compositionend`, preedit becomes committed text

### Preedit replacement

The middleware tracks the preedit range (start offset + length) in the target input. On each `compositionupdate`, it selects the preedit range and replaces it with updated text via `insertText`.

### Helper utilities (`core/composition-utils.ts`)

```ts
function startComposition(target: HTMLElement): void;
function updateComposition(target: HTMLElement, text: string): void;
function endComposition(target: HTMLElement): void;
```

These wrap `CompositionEvent` dispatch and cursor/selection management. Middleware implementations use these instead of managing events directly.

### Edge cases

- **Target changes during composition:** `commit()` to the old target
- **User clicks elsewhere in the input:** `commit()` (composition position is lost)
- **Backspace during composition:** middleware decomposes (e.g., `한` -> `하`), updates preedit. Does NOT delete the whole syllable.

## Integration Points in the Keyboard Component

Three changes to `KioskKeyboardCore.ts`:

### 1. Key press routing (`_onKeyClick`)

After the `key-press` event fires and before default `insertText`/`handleBackspace` calls, check for active middleware (~3 lines):

```ts
const middleware = getMiddlewareForLayout(this._currentLayout);
if (middleware && middleware.handleKey(key, target)) return;
```

### 2. Layout switch handling

When the layout changes, commit any active composition:

```ts
const middleware = getMiddlewareForLayout(this._currentLayout);
if (middleware) middleware.commit();
```

### 3. Focus/target change

When the target input changes or keyboard loses focus, commit composition.

## What Does NOT Change

- Layout file format (`LayoutDefinition` type)
- The `key-press` event API
- `insertText`/`handleBackspace` functions (middleware calls them internally)
- The `registerLayout` API
- UI5 package structure

## Industry Reference

| System                          | Architecture                                                             | Relevance                                                     |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **IBus** (ChromeOS, Linux)      | Layout + engine separation, engine processes key events, manages preedit | Direct inspiration for middleware interface                   |
| **Windows TSF**                 | IME manages composition string, app receives committed text              | Validates the preedit/commit pattern                          |
| **Android InputMethodService**  | Service wraps input logic, separate from key layout                      | Confirms layout-behavior separation                           |
| **GreyWyvern virtual-keyboard** | Hardcoded Hangul composition in JS                                       | Proves the Hangul use case is implementable in ~200-400 lines |
| **simple-keyboard**             | No composition support at all                                            | Confirms this is a gap in the ecosystem                       |

No existing JS virtual keyboard library has a proper middleware/composition architecture. This would be a first.

## First Implementation: Kana Dakuten (#53)

The kana dakuten middleware is the simplest real-world implementation -- a table lookup, no preedit buffer needed:

```ts
// middleware/kana-dakuten.ts
// ~50 mappings: base kana -> voiced/semi-voiced kana
// handleKey: if last inserted char + current key produces a composed char, replace it
```

This validates the middleware architecture with a simple case before tackling Hangul (stateful, preedit-dependent).

## Future Implementations

| Middleware         | Layout(s)                       | Complexity                     | Preedit? |
| ------------------ | ------------------------------- | ------------------------------ | -------- |
| **kana-dakuten**   | `ja-kana`                       | Table lookup (~50 mappings)    | No       |
| **hangul-compose** | `ko-hangul`                     | State machine (~200-400 lines) | Yes      |
| **thai-validate**  | future `thai` layout            | Transition table (~50 lines)   | No       |
| **indic-virama**   | future Devanagari/Tamil layouts | Sequence validation            | No       |

## Scope

**In scope:**

- Middleware registry (`core/middleware-registry.ts`) with `_registerMiddleware`/`registerMiddleware`/`getMiddlewareForLayout`
- Composition utilities (`core/composition-utils.ts`) for preedit handling
- Integration points in `KioskKeyboardCore.ts` (~3 locations)
- Kana dakuten middleware as first implementation (`middleware/kana-dakuten.ts`)
- WebC: self-registering modules, package.json exports for `./middleware/*`
- UI5: centrally imported, always available
- Tests for registry, composition utils, kana dakuten, and integration

**Out of scope:**

- Hangul composition middleware (follow-up, uses the architecture established here)
- Thai validation, Indic virama (future)
- Dictionary-based IME (Chinese Pinyin, Japanese Romaji-to-Kanji)
- Candidate selection UI
