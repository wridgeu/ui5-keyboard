import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import InvisibleMessage from "sap/ui/core/InvisibleMessage";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

const DOM = KioskKeyboard.DOM;

/** Root font-size in px: the rem factor the responsive thresholds resolve against. */
export function rootRemPx(): number {
  return Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
}

/** Place a control into qunit-fixture and wait for initial render. */
export async function placeAndWait(control: KioskKeyboard): Promise<void> {
  control.placeAt("qunit-fixture");
  await nextUIUpdate();
  armRecorder();
}

/**
 * Destroy every keyboard still alive. A test that throws before its own `destroy()`
 * leaves an `AnnouncementQueue` drain timer running, and since the live region is now
 * page-global that timer writes into the node the NEXT test is asserting on - turning
 * one real failure into a run of misleading ones. `destroy` ignores repeated calls
 * (`ManagedObject.js:2967`), so this is safe alongside the inline teardown tests do.
 */
export function destroyKeyboards(): void {
  for (const kb of KioskKeyboard["_instances"]) kb.destroy();
}

/** Wait for a re-render cycle after a state change. */
export async function waitForRender(): Promise<void> {
  await nextUIUpdate();
}

/**
 * Wait for the live-region announcement queue to write the entry it is holding. The
 * queue keeps a fixed gap between writes, so an announcement raised right after
 * another one lands a beat later rather than in the same task.
 */
export async function waitForAnnouncement(): Promise<void> {
  armRecorder();
  await new Promise((resolve) => setTimeout(resolve, 150));
}

const announcements: string[] = [];
let recorder: MutationObserver | null = null;

/**
 * Start recording what is written to the live region. Reaching for the singleton
 * brings the node into the page, so a test can arm before it builds a keyboard -
 * which is what an assertion about first-paint silence needs.
 */
function armRecorder(): void {
  if (recorder) return;
  InvisibleMessage.getInstance();
  const node = liveRegionNode();
  if (!node) return;
  recorder = new MutationObserver(() => {
    const text = node.textContent ?? "";
    if (text) announcements.push(text);
  });
  recorder.observe(node, { childList: true, characterData: true, subtree: true });
}

/**
 * The most recent announcement, or `""` when none was raised since the last reset.
 *
 * The standing node wins over the recording: it is written synchronously, while the
 * recorder runs a microtask later and would lag a read taken in the announcement's own
 * task. The recording covers the case the node cannot - `InvisibleMessage` empties its
 * node three seconds after a write, and that node is shared by the whole page, so a
 * timer armed by an earlier test can wipe an identical text this one just wrote.
 */
export function announcedText(): string {
  armRecorder();
  const standing = liveRegionNode()?.textContent ?? "";
  return standing || (announcements.at(-1) ?? "");
}

/**
 * Forget what was announced and empty the region. Call it BEFORE the step whose
 * silence is asserted, never between that step and the assertion - clearing and then
 * reading back is a tautology, not a test.
 */
export function resetAnnouncements(): void {
  armRecorder();
  announcements.length = 0;
  const node = liveRegionNode();
  if (node) node.textContent = "";
}

/**
 * The polite live-region node itself, for assertions about its exposure rather than
 * its text. `InvisibleMessage.announce` finds it the same way, by class rather than
 * by id: the id is derived from a private singleton name, the class is what the
 * framework itself queries.
 */
export function liveRegionNode(): Element | null {
  return document.querySelector(".sapUiInvisibleMessagePolite");
}

/** Find a rendered key by its data-key value and tap it via touch simulation. */
export function tapKey(keyboard: KioskKeyboard, keyValue: string): void {
  simulateTap(keyboard, getRequiredKeyElement(keyboard, keyValue));
}

/** Simulate a touchstart→touchend sequence on a control, targeting a specific element. */
export function simulateTap(kb: KioskKeyboard, el: HTMLElement): void {
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: el, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: el, writable: false });
  kb.ontouchend(end);
}

/**
 * Freeze `performance.now()` so the ShiftState double-click window
 * (`DOUBLE_CLICK_MS`) cannot drift past its threshold across the `waitForRender`
 * awaits a test inserts between two `{shift}` taps. Without it, the
 * double-tap → caps-lock transition flakes whenever a loaded CI runner stalls a
 * render beyond 400ms. Returns the stub; restore it in a `finally`.
 */
export function freezeDoubleClickWindow(): sinon.SinonStub {
  return sinon.stub(performance, "now").returns(0);
}

/** Get the rendered keyboard root element. */
export function getKeyboardDom(keyboard: KioskKeyboard): HTMLElement {
  const dom = keyboard.getDomRef();
  if (!(dom instanceof HTMLElement)) throw new Error("Keyboard not rendered");
  return dom;
}

/** Get all rendered key elements from a keyboard. */
export function getKeyElements(keyboard: KioskKeyboard): NodeListOf<HTMLElement> {
  return getKeyboardDom(keyboard).querySelectorAll<HTMLElement>(DOM.selectors.key);
}

/** Get the first rendered key element. */
export function getFirstKeyElement(keyboard: KioskKeyboard): HTMLElement {
  const firstKey = getKeyElements(keyboard)[0];
  if (!firstKey) throw new Error("Keyboard has no rendered keys");
  return firstKey;
}

/** Find a rendered key by its data-key value. */
export function getKeyElement(keyboard: KioskKeyboard, keyValue: string): HTMLElement | null {
  return getKeyboardDom(keyboard).querySelector<HTMLElement>(DOM.selectors.keyByValue(keyValue));
}

/** Find a rendered key by its data-key value or throw. */
export function getRequiredKeyElement(keyboard: KioskKeyboard, keyValue: string): HTMLElement {
  const keyEl = getKeyElement(keyboard, keyValue);
  if (!keyEl) throw new Error(`Key "${keyValue}" not found`);
  return keyEl;
}

/** Get rendered keyboard rows. */
export function getRowElements(keyboard: KioskKeyboard): HTMLElement[] {
  return Array.from(getKeyboardDom(keyboard).querySelectorAll<HTMLElement>(DOM.selectors.row));
}

/** Get a rendered keyboard row by index. */
export function getRowElement(keyboard: KioskKeyboard, rowIndex: number): HTMLElement {
  const row = getRowElements(keyboard)[rowIndex];
  if (!row) throw new Error(`Row ${rowIndex} not found`);
  return row;
}

/** Get key elements from a rendered row. */
export function getRowKeys(keyboard: KioskKeyboard, rowIndex: number): HTMLElement[] {
  return Array.from(getRowElement(keyboard, rowIndex).querySelectorAll<HTMLElement>(DOM.selectors.key));
}

/** Get the currently focusable key elements. */
export function getFocusableKeys(keyboard: KioskKeyboard): HTMLElement[] {
  return Array.from(getKeyboardDom(keyboard).querySelectorAll<HTMLElement>(DOM.selectors.focusableKey));
}

/** Check whether the keyboard root currently has a CSS class. */
export function hasKeyboardClass(keyboard: KioskKeyboard, className: string): boolean {
  return getKeyboardDom(keyboard).classList.contains(className);
}

/** Check whether a rendered key currently has a CSS class. */
export function hasKeyClass(keyboard: KioskKeyboard, keyValue: string, className: string): boolean {
  return getRequiredKeyElement(keyboard, keyValue).classList.contains(className);
}

export function getKeyAttr(keyboard: KioskKeyboard, keyValue: string, attr: string): string | null {
  return getRequiredKeyElement(keyboard, keyValue).getAttribute(attr);
}

/** Create a fake key-like element for unrendered/internal event tests. */
export function createFakeKeyElement(keyValue: string, id = "fake-key"): HTMLElement {
  const fakeKeyEl = document.createElement("div");
  fakeKeyEl.classList.add(DOM.classes.key);
  fakeKeyEl.dataset.key = keyValue;
  fakeKeyEl.id = id;
  return fakeKeyEl;
}

/**
 * Check whether shift is active by reading `aria-pressed` from the
 * rendered shift key.  Requires the keyboard to be rendered.
 */
export function isShiftActive(keyboard: KioskKeyboard): boolean {
  const shiftKey = getKeyElement(keyboard, "{shift}");
  return shiftKey !== null && shiftKey.getAttribute("aria-pressed") === "true";
}

/**
 * Check whether caps lock is active by looking for the capsLock CSS
 * class on the rendered shift key.  Requires the keyboard to be rendered.
 */
export function isCapsLock(keyboard: KioskKeyboard): boolean {
  const shiftKey = getKeyElement(keyboard, "{shift}");
  return shiftKey !== null && shiftKey.classList.contains(DOM.classes.keyCapsLock);
}

/** Get the rendered display label text of a key. */
export function getRenderedKeyLabel(keyboard: KioskKeyboard, keyValue: string): string {
  const keyEl = getRequiredKeyElement(keyboard, keyValue);
  const labelSpan = keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
  return labelSpan?.textContent ?? "";
}

/** Get key data-key values from a rendered row. */
export function getRowKeyValues(keyboard: KioskKeyboard, rowIndex: number): string[] {
  return getRowKeys(keyboard, rowIndex).map((k) => k.dataset.key!);
}

/** Get all rendered key data-key values as a 2D array (rows of strings). */
export function getRenderedLayoutKeys(keyboard: KioskKeyboard): string[][] {
  return getRowElements(keyboard).map((row) =>
    Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)).map((k) => k.dataset.key!),
  );
}

/** Trigger a responsive-class recompute with the supplied measured height.
 *  Stubs DOM measurement APIs, drives the public `refreshResponsiveState()`
 *  through its rAF coalescer, then restores the stubs.
 *  Width breakpoints are handled purely by CSS @container queries.
 *  @param height - the granted outer (border-box) height the container gives the root.
 *  @param naturalHeight - the keyboard's unconstrained content height (scrollHeight).
 *         When larger than `height`, the keyboard is considered externally constrained. */
export async function setMeasuredHeight(
  keyboard: KioskKeyboard,
  dom: Element,
  height: number,
  naturalHeight?: number,
): Promise<void> {
  const htmlDom = dom as HTMLElement;

  const origScrollHeight =
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(htmlDom), "scrollHeight") ??
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  if (naturalHeight !== undefined) {
    Object.defineProperty(htmlDom, "scrollHeight", { value: naturalHeight, configurable: true });
  }

  // `height` is the granted outer (border-box) height the container gives the
  // root. The controller tiers on clientHeight + border, so stub clientHeight
  // below it by the live border; with no border the two coincide.
  const cs = getComputedStyle(htmlDom);
  const rootBorderY = (Number.parseFloat(cs.borderTopWidth) || 0) + (Number.parseFloat(cs.borderBottomWidth) || 0);
  Object.defineProperty(htmlDom, "clientHeight", { value: height - rootBorderY, configurable: true });

  try {
    keyboard.refreshResponsiveState();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  } finally {
    if (naturalHeight !== undefined && origScrollHeight) {
      Object.defineProperty(htmlDom, "scrollHeight", origScrollHeight);
    }
    Reflect.deleteProperty(htmlDom, "clientHeight");
  }
}
