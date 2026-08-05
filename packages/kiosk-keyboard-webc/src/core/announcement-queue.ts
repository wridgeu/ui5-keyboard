/** The slice of the host the announcement queue reads and writes back into. */
interface AnnouncementQueueHost {
  /** Whether the host is still attached; a pending flush bails out when false. */
  isConnected(): boolean;
  /** Writes the next announcement to the reactive live-region property. */
  setLiveRegionText(text: string): void;
}

/**
 * Owns the ARIA live-region announcement queue for the web component.
 *
 * A queue (rather than a single slot) is necessary because two state changes in
 * the same render cycle (e.g. open + shift toggle) must each be announced;
 * assistive tech can elide an announcement if a single live region is rewritten
 * too quickly, so the queue is drained one entry per fixed interval. The host
 * forwards `announce` (queue text) and `flush` (drain on each render), and clears
 * the in-flight timer through `teardown` on disconnect.
 */
export class AnnouncementQueue {
  /** Minimum gap between live-region writes so AT clients can pick each one up. */
  private static readonly _INTERVAL_MS = 120;

  /** Pending live-region announcements (see class doc for why a queue). */
  private readonly _queue: string[] = [];
  private _flushPending = false;
  private _timerId: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly _host: AnnouncementQueueHost) {}

  /** Queue text for the live region. Identical consecutive entries are coalesced. */
  announce(text: string): void {
    if (!text) return;
    if (this._queue.at(-1) === text) return;
    this._queue.push(text);
  }

  /**
   * Drains the announcement queue with a fixed inter-message delay so AT
   * clients don't elide rapid consecutive writes to the same live region.
   */
  flush(): void {
    if (this._flushPending) return;
    if (this._queue.length === 0) return;

    this._flushPending = true;
    const writeNext = (): void => {
      this._timerId = null;
      // Bail out if the host was disconnected while the timer was pending.
      // teardown() clears the queue and flag, so just stop the chain here.
      if (!this._host.isConnected()) {
        this._flushPending = false;
        return;
      }
      const next = this._queue.shift();
      if (next !== undefined) this._host.setLiveRegionText(next);
      if (this._queue.length > 0) {
        this._timerId = setTimeout(writeNext, AnnouncementQueue._INTERVAL_MS);
      } else {
        this._flushPending = false;
      }
    };
    writeNext();
  }

  /** Cancel any in-flight flush timer and drop pending announcements. */
  teardown(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    this._queue.length = 0;
    this._flushPending = false;
  }
}
