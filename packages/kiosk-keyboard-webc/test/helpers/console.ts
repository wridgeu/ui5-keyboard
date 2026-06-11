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
