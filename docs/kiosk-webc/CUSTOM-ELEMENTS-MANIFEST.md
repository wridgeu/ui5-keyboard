# Custom Elements Manifest (CEM)

The `kiosk-keyboard-webc` package generates a [Custom Elements Manifest](https://github.com/webcomponents/custom-elements-manifest) that machine-describes the public API of the `<kiosk-keyboard>` and `<kiosk-keyboard-custom-layout>` components: properties, attributes, slots, events, methods, and type information.

## What CEM Enables

- **IDE integration**: VS Code autocomplete for attributes/events via `vscode.html-custom-data.json`
- **JetBrains IDEs**: WebStorm/IntelliJ attribute and event completion via `web-types.json`
- **Storybook**: Auto-generated controls, args tables, and docs from the manifest
- **Framework adapters**: React/Vue/Angular wrapper generation tools can read the CEM
- **Documentation generators**: Tools like `api-viewer-element` render interactive API docs from the CEM

## Generated Files

| File                                 | Purpose                                           |
| ------------------------------------ | ------------------------------------------------- |
| `dist/custom-elements.json`          | Public API manifest (only `@public` members)      |
| `dist/custom-elements-internal.json` | Full manifest including private/protected members |
| `dist/vscode.html-custom-data.json`  | VS Code HTML custom data (attributes, events)     |
| `dist/web-types.json`                | JetBrains IDE web-types (attributes, events)      |

## Package Configuration

Two fields in `package.json` signal CEM support to tooling:

```json
{
  "customElements": "dist/custom-elements.json",
  "ui5": {
    "webComponentsPackage": true
  }
}
```

- `customElements` follows the [custom-elements-manifest spec](https://github.com/webcomponents/custom-elements-manifest/blob/main/schema.d.ts) and is the standard field that IDEs, Storybook, and framework adapters look for.
- `ui5.webComponentsPackage` tells `@ui5/webcomponents-tools` that this package uses the UI5 Web Components build pipeline (theme/i18n generation, CEM analysis, etc.).

## Generation

```bash
# CEM is generated automatically as part of the build
npm run build

# Generate CEM only (without a full build)
npm run generateAPI

# Generate CEM only (skip validation)
npx ui5nps generateAPI.generateCEM

# Generate + validate in dev mode (strict, throws on doc errors)
UI5_CEM_MODE=dev npx ui5nps generateAPI
```

The `generateAPI` script runs two steps:

1. `generateCEM`: Runs the `@custom-elements-manifest/analyzer` with the UI5 custom plugin
2. `validateCEM`: Validates both public and internal manifests against the CEM schema

CEM generation runs as the final step of `npm run build`, so `dist/custom-elements.json` is always available after a build. The generated files live in `dist/` alongside the compiled output and are not checked into git.

## Output-Only State Attributes

The analyzer describes the component's input surface, the `@property`-decorated attributes a consumer sets (`layout`, `keyboard-type`, `open`, ...). Reflected **state** attributes that the component writes to itself imperatively are not `@property`-backed, so they do not appear in the manifest and are absent from the IDE/wrapper tooling that reads it.

`cq-tier` (`short` / `tiny`, absent when unconstrained) is the current example: the [responsive sizing controller](../../packages/kiosk-keyboard-webc/src/core/responsive-sizing-controller.ts) sets it via `setAttribute` to mark the height tier, and consumers only ever read it as a styling hook (`kiosk-keyboard[cq-tier="short"]`), never set it in markup. It is documented as a contract in the [README](../../packages/kiosk-keyboard-webc/README.md#responsive-sizing) and [CONSUMPTION.md](./CONSUMPTION.md#height-responsiveness), and exposed programmatically via `KioskKeyboard.DOM.attributes.cqTier` / `DOM.cqTierValues`.

## Object-Typed Properties Listed as Attributes

The inverse gap. `defaultVariants` on `<kiosk-keyboard>` and `rows`, `variants` and `middleware` on `<kiosk-keyboard-custom-layout>` are `@property({ type: Object })`, and the framework never gives an `Object`-typed property an attribute: `UI5ElementMetadata.hasAttribute` returns `false` on the type alone, so `default-variants` and its siblings are neither observed nor reflected. The generated files list them regardless — the analyzer plugin pushes every public member into the `attributes` array gated only on privacy — so `custom-elements.json`, `vscode.html-custom-data.json` and `web-types.json` all offer `default-variants` in IDE completion, where setting it in markup does nothing. Assign these properties from JS; each one's JSDoc says so, and that text is carried into the manifest entry's description. The custom layout's string-typed properties (`name`, `keycap-lang`, `locales`, `layout-role`, `suppress`) are real attributes and are settable in markup.

`noAttribute: true` does not suppress the entry. The plugin records it as `_ui5noAttribute` in `custom-elements-internal.json` only, and the public `attributes` array never consults it. SAP ships the same shape for its own object-typed properties: `accessibility-attributes` is listed as an attribute on `ui5-button`, `ui5-link` and `ui5-li` in `@ui5/webcomponents` 2.22.0.

`Array` is not covered by the framework rule that makes this harmless for `Object`. `hasAttribute` excludes `Object` only, and the default converter JSON-stringifies array values, so a public `@property({ type: Array })` does get a live, reflected, JSON-encoded attribute and needs an explicit `noAttribute: true` to avoid one. Neither element declares an array-typed property.

## Slots in the Manifest

A `@slot`-decorated member takes a different path than a `@property` one: the plugin splices it out of `members` and into the class's `slots` array before the attribute push can see it, so it is described as a slot and never as a phantom attribute. `customLayouts` on `<kiosk-keyboard>` is the one entry.

Two details of that conversion show up in the output. The member's `type` and `privacy` are moved to `_ui5type` and `_ui5privacy` (slots carry neither in the CEM schema), so a slot still needs `@public` in its JSDoc to survive `processPublicAPI`. And the declared type text is rewritten by `formatSlotTypes`, which turns `Slot<T>` and `DefaultSlot<T>` into `Array<T>` — `customLayouts` is therefore published as `Array<ICustomLayout>`.

Slot JSDoc takes no `@default`: the missing-default check runs on the property branch only.

## How It Works

The CEM is generated by `@custom-elements-manifest/analyzer` with a custom UI5 plugin (`custom-elements-manifest.config.mjs` from `@ui5/webcomponents-tools`). The flow:

1. **Glob resolution**: Source files matching `src/!(*generated)/*.ts` and `src/!(*bundle)*.ts` are discovered
2. **AST parsing**: Each file is parsed with `ts.createSourceFile()` into a TypeScript AST
3. **Base analyzer**: The standard CEM analyzer walks the AST to detect classes, fields, methods, exports
4. **UI5 custom plugin** (`my-plugin`): Enhances the base output with:
   - `@customElement` decorator processing (tag name, custom element flag)
   - `@event` / `@eventStrict` decorator processing (event names, params, bubbling)
   - JSDoc-driven privacy (`@public`, `@private`, `@protected`) and versioning (`@since`)
   - `@property` decorator processing (HTML attributes, types from TypeChecker)
   - Superclass resolution and inheritance linking
   - Public API filtering (removes non-public declarations and members)
5. **IDE plugins**: `cem-plugin-vs-code-custom-data-generator` and `custom-element-jet-brains-integration` produce the VS Code and JetBrains output files

## JSDoc Requirements for CEM

The UI5 CEM tooling has specific JSDoc requirements that differ from standard JSDoc conventions. These are enforced in dev mode (`UI5_CEM_MODE=dev`) and cause errors if violated.

### Class JSDoc

The class must have `@class` (or `@abstract`/`@constructor`) in its JSDoc for the CEM config to recognize it:

```ts
/**
 * `<kiosk-keyboard>` - Virtual keyboard web component.
 *
 * @class
 * @extends UI5Element
 * @public
 * @since 0.1.0
 */
```

**Allowed class tags**: `public`, `protected`, `private`, `since`, `deprecated`, `constructor`, `class`, `abstract`, `experimental`, `implements`, `extends`, `slot`, `csspart`

### Class Export Pattern

The class declaration must NOT use `export default class` on the same line. The UI5 CEM config uses a regex (`^\s*(abstract\s*)?class [\w\d_]+`) to locate the class definition in source text, and `export default` before `class` breaks the match.

```ts
// WRONG: CEM cannot extract JSDoc
export default class KioskKeyboard extends UI5Element { ... }

// CORRECT: separate export
class KioskKeyboard extends UI5Element { ... }
export default KioskKeyboard;
```

This is a known constraint of the UI5 CEM config's `extractClassNodeJSDoc` function, which uses regex-based JSDoc extraction rather than AST-based JSDoc association.

### Property/Field JSDoc

```ts
/**
 * Whether the keyboard renders in docked mode.
 * @default false
 * @public
 * @since 0.1.0
 */
@property({ type: Boolean })
docked = false;
```

**Allowed field tags**: `public`, `protected`, `private`, `since`, `deprecated`, `formEvents`, `formProperty`, `default`

> [!NOTE]
> `@default` is required for public fields. The value comes from the tag, not from the initializer.

### Method JSDoc

```ts
/**
 * Open the docked keyboard panel.
 * @param target Optional target element.
 * @returns Whether the keyboard was opened.
 * @public
 * @since 0.1.0
 */
```

**Allowed method tags**: `public`, `protected`, `private`, `since`, `deprecated`, `param`, `returns`, `override`

> [!IMPORTANT]
> Method `@param` must NOT include a type annotation. The type is inferred from TypeScript:

```ts
// WRONG: CEM validator rejects {type} on method params
@param {string} sName - Layout name.

// CORRECT: no type annotation
@param sName Layout name.
```

Similarly, `@returns` must not include a type:

```ts
// WRONG
@returns {boolean}

// CORRECT
@returns True if the layout is built-in.
```

### Event JSDoc

Each `@event` decorator needs a JSDoc comment immediately before it with `@public` to appear in the public CEM:

```ts
/**
 * Fired when a key is pressed on the virtual keyboard.
 * @param {string} key - The key value (character, `{shift}`, `{backspace}`, etc.)
 * @param {boolean} shiftKey - Whether Shift is active.
 * @param {string} [char] - The resolved character (after shift). `undefined` for action keys.
 * @public
 * @since 0.1.0
 */
@event("key-press", { bubbles: true, cancelable: true })
```

**Allowed event tags**: `public`, `protected`, `private`, `since`, `deprecated`, `param`, `native`, `allowPreventDefault`

> [!IMPORTANT]
> Event `@param` MUST include a `{type}` annotation (opposite of method params). Without `@public`, events default to private and are filtered out.

### Static Methods vs Static Fields

Static methods must be declared as actual method declarations, not as field assignments:

```ts
// WRONG: CEM treats as field, adds to HTML attributes list
static getRegisteredLayout = getRegisteredLayout;

// CORRECT: CEM treats as method
static getRegisteredLayout(name: string): LayoutDefinition | undefined {
  return getRegisteredLayout(name);
}
```

The UI5 CEM config pushes all public fields of a `customElement` class into the `attributes` array (as HTML attributes). Static field assignments are `PropertyDeclaration` nodes in the AST and get this treatment. Actual method declarations are `MethodDeclaration` nodes and are correctly categorized as methods.

## Privacy Filtering

The CEM config's `processPublicAPI` function recursively filters the manifest:

- Any declaration or member without `_ui5privacy` or `privacy` is **removed**
- Any declaration or member with privacy other than `"public"` is **removed**
- Empty arrays (after filtering) are deleted from the output

This means:

- Classes need `@public` in their JSDoc (sets `_ui5privacy: "public"`)
- Events need `@public` in their JSDoc (default is `"private"`)
- Members without JSDoc are removed (no privacy means removal)
- The internal CEM (`custom-elements-internal.json`) retains all members regardless of privacy

## Troubleshooting

### Empty declarations in CEM

If `custom-elements.json` shows modules with `"declarations": []`:

1. **Missing `@class` tag**: The `extractClassNodeJSDoc` function requires `@class`, `@abstract`, or `@constructor` in the class JSDoc
2. **`export default class` on one line**: Separate the export from the class declaration (see above)
3. **Missing `@public` tag**: Without `@public`, `processPublicAPI` removes the class from the public CEM

### Members missing from CEM

1. **No JSDoc**: Members without JSDoc comments are skipped by the UI5 plugin's enhancement loop
2. **Missing `@public`**: Non-public members are filtered out of the public CEM
3. **Missing `@default` on fields**: Dev mode warns about missing defaults for public fields

### Dev mode validation errors

Run with `UI5_CEM_MODE=dev` to see all validation errors. Common issues:

- `@param {type}` on methods (remove the type)
- `@returns {type}` on methods (remove the type)
- Missing `@param {type}` on events (add the type)
- `@example` on methods (not in the allowed tag list, remove it)
- Missing `@default` on public fields

## Official References

- [Custom Elements Manifest spec](https://github.com/webcomponents/custom-elements-manifest)
- [CEM Analyzer](https://custom-elements-manifest.open-wc.org/)
- [UI5 Web Components Tools](https://github.com/SAP/ui5-webcomponents/tree/main/packages/tools) (CEM config, VS Code custom data, and JetBrains web types)
