import {
  BUILTIN_LAYOUT_META,
  getLayoutMeta,
  type InstanceLayoutMeta,
  type LayoutMeta,
} from "ui5/kiosk/internal/layout-meta";

// The module exposes the resolved metadata; these name the two reads under test.
const isSecondaryLayout = (name: string, meta?: InstanceLayoutMeta) => getLayoutMeta(name, meta)?.secondary === true;
const getLayoutLang = (name: string, meta?: InstanceLayoutMeta) => getLayoutMeta(name, meta)?.lang;

// Unit coverage for the per-layout attribute table: which built-in layouts are
// auxiliary surfaces, which ones carry keycaps in a language of their own, and
// the per-attribute fallback that lets an instance layout declare one attribute
// without discarding the rest of the built-in of the same name.

QUnit.module("layout-meta - BUILTIN_LAYOUT_META");

QUnit.test("the auxiliary surfaces are the only secondary entries", (assert) => {
  for (const name of ["numeric", "special", "fkeys", "nav"]) {
    assert.strictEqual(BUILTIN_LAYOUT_META.get(name)?.secondary, true, `${name} is secondary`);
  }
  for (const name of ["ja-romaji", "ja-kana", "ja-kana-compact", "arabic", "ko-hangul"]) {
    assert.strictEqual(BUILTIN_LAYOUT_META.get(name)?.secondary, undefined, `${name} declares no secondary flag`);
  }
});

QUnit.test("the non-Latin scripts declare their keycap language", (assert) => {
  assert.strictEqual(BUILTIN_LAYOUT_META.get("ja-kana")?.lang, "ja", "ja-kana -> ja");
  assert.strictEqual(BUILTIN_LAYOUT_META.get("arabic")?.lang, "ar", "arabic -> ar");
  assert.strictEqual(BUILTIN_LAYOUT_META.get("ko-hangul")?.lang, "ko", "ko-hangul -> ko");
});

QUnit.test("ja-romaji opts out of the variant tier without declaring a language", (assert) => {
  const meta = BUILTIN_LAYOUT_META.get("ja-romaji");
  assert.strictEqual(meta?.variants, null, "no Latin diacritics on the JIS keycaps");
  assert.strictEqual(meta?.lang, undefined, "its keycaps are Latin letters, so they stay in the UI language");
});

QUnit.test("the Latin layouts declare nothing at all", (assert) => {
  assert.strictEqual(BUILTIN_LAYOUT_META.get("qwerty"), undefined, "qwerty takes every default");
  assert.strictEqual(BUILTIN_LAYOUT_META.get("qwertz-de"), undefined, "qwertz-de takes every default");
});

QUnit.module("layout-meta - isSecondaryLayout");

QUnit.test("only the auxiliary surfaces are secondary", (assert) => {
  for (const name of ["numeric", "special", "fkeys", "nav"]) {
    assert.strictEqual(isSecondaryLayout(name), true, `${name} is secondary`);
  }
  for (const name of ["qwerty", "qwertz-de", "arabic"]) {
    assert.strictEqual(isSecondaryLayout(name), false, `${name} is a base alphabetic layout`);
  }
});

QUnit.test("an unregistered name is not secondary", (assert) => {
  assert.strictEqual(isSecondaryLayout("nope"), false, "an absent entry takes the base default");
});

QUnit.module("layout-meta - getLayoutLang");

QUnit.test("returns the declared keycap language", (assert) => {
  assert.strictEqual(getLayoutLang("ja-kana"), "ja", "ja-kana -> ja");
  assert.strictEqual(getLayoutLang("arabic"), "ar", "arabic -> ar");
  assert.strictEqual(getLayoutLang("ko-hangul"), "ko", "ko-hangul -> ko");
});

QUnit.test("a layout with keycaps in the UI language has none", (assert) => {
  assert.strictEqual(getLayoutLang("ja-romaji"), undefined, "opting out of variants does not imply a language");
  assert.strictEqual(getLayoutLang("qwerty"), undefined, "Latin base layout");
  assert.strictEqual(getLayoutLang("qwertz-de"), undefined, "Latin base layout");
  assert.strictEqual(getLayoutLang("numeric"), undefined, "auxiliary surface");
  assert.strictEqual(getLayoutLang("nope"), undefined, "an unregistered name");
});

QUnit.module("layout-meta - instance metadata");

QUnit.test("a declared attribute wins over the built-in", (assert) => {
  const meta = new Map<string, LayoutMeta>([["arabic", { lang: "fa" }]]);
  assert.strictEqual(getLayoutLang("arabic", meta), "fa", "the instance language replaces ar");
  assert.strictEqual(getLayoutLang("arabic"), "ar", "without the instance map the built-in still answers");
});

QUnit.test("an undeclared attribute falls back to the built-in of the same name", (assert) => {
  const meta = new Map<string, LayoutMeta>([["arabic", { secondary: true }]]);
  assert.strictEqual(isSecondaryLayout("arabic", meta), true, "the declared flag takes effect");
  assert.strictEqual(getLayoutLang("arabic", meta), "ar", "the undeclared language still resolves from the built-in");
});

QUnit.test("a bare-rows entry declares nothing and resolves as the built-in", (assert) => {
  const meta = new Map<string, LayoutMeta>([["numeric", {}]]);
  assert.strictEqual(isSecondaryLayout("numeric", meta), true, "numeric stays an auxiliary surface");
  assert.strictEqual(
    getLayoutLang("ja-kana", new Map<string, LayoutMeta>([["ja-kana", {}]])),
    "ja",
    "ja-kana stays ja",
  );
});

QUnit.test("an instance-only name resolves from the instance entry alone", (assert) => {
  const meta = new Map<string, LayoutMeta>([["greek", { lang: "el", secondary: true }]]);
  assert.strictEqual(getLayoutLang("greek", meta), "el", "a name with no built-in still carries its language");
  assert.strictEqual(isSecondaryLayout("greek", meta), true, "and its secondary flag");
});

QUnit.test("an instance entry for one name does not leak onto another", (assert) => {
  const meta = new Map<string, LayoutMeta>([["greek", { lang: "el" }]]);
  assert.strictEqual(getLayoutLang("qwerty", meta), undefined, "an unrelated layout is unaffected");
});

QUnit.module("layout-meta - name matching");

QUnit.test("names are matched verbatim", (assert) => {
  assert.strictEqual(isSecondaryLayout("Numeric"), false, "uppercase name does not resolve the numeric entry");
  assert.strictEqual(isSecondaryLayout(" numeric "), false, "padded name does not resolve either");
  assert.strictEqual(getLayoutLang("ARABIC"), undefined, "uppercase name does not resolve the arabic language");
  assert.strictEqual(getLayoutLang(" arabic "), undefined, "padded name does not resolve it either");
});
