/** The slice of the host the announcement queue reads and writes back into. */
interface AnnouncementQueueHost {
  /** Whether the host is still attached; a pending flush bails out when false. */
  isConnected(): boolean;
  /** Writes the next announcement to the host's live-region text. */
  setLiveRegionText(text: string): void;
}

/**
 * Owns the ARIA live-region announcement queue.
 *
 * A queue rather than a single slot: one gesture can raise two announcements that
 * both carry information, and a live region rewritten too quickly loses the first.
 * Dismissing the accent popup by tapping `{shift}` is the everyday case - the press
 * closes the popup ("Variants closed") and the release latches shift ("Shift on"),
 * milliseconds apart and in separate event handlers, so no caller can combine them
 * into one string.
 *
 * The gap is kept between writes rather than between drains, so a lone announcement
 * still reaches the live region in the task that raised it and only one treading on
 * another's heels waits. A pending timer IS the record of a gap not yet spent: while
 * one is armed the next entry waits for it, and it is left armed for one interval
 * past the final write so an announcement raised just after still keeps its distance.
 */
export class AnnouncementQueue {
  /**
   * Minimum gap between live-region writes so AT clients can pick each one up.
   *
   * An untested guess, not a measured threshold - no screen reader was timed for it.
   * The ceiling is user-visible latency: a burst of N announcements takes N intervals
   * to drain, so raising this delays the last one proportionally.
   */
  private static readonly _INTERVAL_MS = 120;

  /** Pending live-region announcements, drained one per interval. */
  private readonly _queue: string[] = [];
  /** Armed while the gap since the last write is unspent; also the drain schedule. */
  private _timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly _host: AnnouncementQueueHost) {}

  /** Queue text for the live region. Identical consecutive entries are coalesced. */
  announce(text: string): void {
    if (!text) return;
    if (this._queue.at(-1) === text) return;
    this._queue.push(text);
  }

  /** Writes what is due to the live region, leaving the rest to the pending timer. */
  flush(): void {
    if (this._timerId !== null) return;
    this._writeNext();
  }

  /** Cancel any in-flight flush timer and drop pending announcements. */
  teardown(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    this._queue.length = 0;
  }

  /** Write one entry and re-arm the gap; a later session starts its own cadence. */
  private _writeNext = (): void => {
    this._timerId = null;
    // A detached host drops what it was holding rather than banking it: a host can
    // lose its node while staying alive and still raising announcements, and a
    // backlog read out on reattach would land ahead of what the user just did.
    if (!this._host.isConnected()) {
      this._queue.length = 0;
      return;
    }
    const next = this._queue.shift();
    if (next === undefined) return;
    this._host.setLiveRegionText(next);
    this._timerId = setTimeout(this._writeNext, AnnouncementQueue._INTERVAL_MS);
  };
}
