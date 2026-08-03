type PatchableConsoleMethod = "warn" | "error";

/**
 * Replaces a console method for the duration of `fn`, collecting each call as
 * a single joined string. Restores the original method afterwards, even when
 * `fn` throws or rejects. Use it both to assert on emitted messages and to
 * silence expected noise (ignore the returned array).
 */
export async function captureConsole(
  method: PatchableConsoleMethod,
  fn: () => void | Promise<void>,
): Promise<string[]> {
  const messages: string[] = [];
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };
  try {
    await fn();
  } finally {
    console[method] = original;
  }
  return messages;
}

/**
 * The callback form of {@link captureConsole} for `console.warn`: the body receives the
 * messages as they arrive, so a test can assert on them alongside the element it mounted
 * without hoisting that element out of the block.
 */
export async function withCapturedWarnings(body: (messages: string[]) => Promise<void>): Promise<void> {
  const method: PatchableConsoleMethod = "warn";
  const messages: string[] = [];
  const original = console[method];
  console[method] = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };
  try {
    await body(messages);
  } finally {
    console[method] = original;
  }
}
