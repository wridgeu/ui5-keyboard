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
 * A queue rather than a single slot: two state changes in the same task (a shift
 * toggle and the layout swap it triggers) must each be announced, and assistive tech
 * elides a live region rewritten too quickly. The gap is kept between writes rather
 * than between drains, so a lone announcement still reaches the live region in the
 * task that raised it and only one treading on another's heels waits.
 */
export class AnnouncementQueue {
  /** Minimum gap between live-region writes so AT clients can pick each one up. */
  private static readonly _INTERVAL_MS = 120;

  /** Pending live-region announcements, drained one per interval. */
  private readonly _queue: string[] = [];
  private _flushPending = false;
  private _timerId: ReturnType<typeof setTimeout> | null = null;
  /** When the last entry reached the live region, so the next one can keep its distance. */
  private _lastWriteAt = -Infinity;

  constructor(private readonly _host: AnnouncementQueueHost) {}

  /** Queue text for the live region. Identical consecutive entries are coalesced. */
  announce(text: string): void {
    if (!text) return;
    if (this._queue.at(-1) === text) return;
    this._queue.push(text);
  }

  /** Writes what is due to the live region, scheduling the rest an interval apart. */
  flush(): void {
    if (this._flushPending) return;
    if (this._queue.length === 0) return;

    this._flushPending = true;
    const writeNext = (): void => {
      this._timerId = null;
      // A detached host drops what it was holding rather than banking it: a host can
      // lose its node while staying alive and still raising announcements, and a
      // backlog read out on reattach would land ahead of what the user just did.
      if (!this._host.isConnected()) {
        this._queue.length = 0;
        this._flushPending = false;
        return;
      }
      const next = this._queue.shift();
      if (next !== undefined) {
        this._host.setLiveRegionText(next);
        this._lastWriteAt = performance.now();
      }
      if (this._queue.length > 0) {
        this._timerId = setTimeout(writeNext, AnnouncementQueue._INTERVAL_MS);
      } else {
        this._flushPending = false;
      }
    };

    const sinceLastWrite = performance.now() - this._lastWriteAt;
    if (sinceLastWrite < AnnouncementQueue._INTERVAL_MS) {
      this._timerId = setTimeout(writeNext, AnnouncementQueue._INTERVAL_MS - sinceLastWrite);
    } else {
      writeNext();
    }
  }

  /** Cancel any in-flight flush timer and drop pending announcements. */
  teardown(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    this._queue.length = 0;
    this._flushPending = false;
    // A later session starts its own cadence rather than inheriting this one's.
    this._lastWriteAt = -Infinity;
  }
}
