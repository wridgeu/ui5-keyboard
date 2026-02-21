import HotkeyRecorder from "ui5/hotkeys/HotkeyRecorder";
import { fireKey } from "./test-helpers";

const recorders: HotkeyRecorder[] = [];

function createRecorder(options: ConstructorParameters<typeof HotkeyRecorder>[0]): HotkeyRecorder {
  const recorder = new HotkeyRecorder(options);
  recorders.push(recorder);
  return recorder;
}

QUnit.module("HotkeyRecorder", {
  afterEach() {
    for (const r of recorders) {
      if (!r.isDestroyed) r.destroy();
    }
    recorders.length = 0;
  },
});

QUnit.test("Start enables recording", (assert) => {
  const recorder = createRecorder({ onRecord: () => {} });
  assert.notOk(recorder.isRecording, "Not recording initially");

  recorder.start();
  assert.ok(recorder.isRecording, "Recording after start()");

  recorder.stop();
  assert.notOk(recorder.isRecording, "Not recording after stop()");
});

QUnit.test("Records simple key", (assert) => {
  const done = assert.async();

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      assert.strictEqual(hotkey, "F5", "Recorded F5");
      assert.notOk(recorder.isRecording, "Auto-stopped after recording");
      done();
    },
  });

  recorder.start();
  fireKey("F5");
});

QUnit.test("Records modifier combo", (assert) => {
  const done = assert.async();

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      assert.ok(hotkey.includes("Control"), "Hotkey includes Control modifier");
      assert.ok(hotkey.includes("S"), "Hotkey includes S key");
      done();
    },
  });

  recorder.start();
  fireKey("s", { ctrlKey: true });
});

QUnit.test("Escape cancels recording", (assert) => {
  const done = assert.async();
  let recordCalled = false;

  const recorder = createRecorder({
    onRecord: () => {
      recordCalled = true;
    },
    onCancel: () => {
      assert.notOk(recordCalled, "onRecord was not called");
      assert.notOk(recorder.isRecording, "Recording stopped");
      done();
    },
  });

  recorder.start();
  fireKey("Escape");
});

QUnit.test("Backspace clears (records empty string)", (assert) => {
  const done = assert.async();

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      assert.strictEqual(hotkey, "", "Backspace records empty string (clear)");
      done();
    },
  });

  recorder.start();
  fireKey("Backspace");
});

QUnit.test("Delete clears (records empty string)", (assert) => {
  const done = assert.async();

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      assert.strictEqual(hotkey, "", "Delete records empty string (clear)");
      done();
    },
  });

  recorder.start();
  fireKey("Delete");
});

QUnit.test("Modifier-only waits for action key", (assert) => {
  let recorded: string | null = null;

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      recorded = hotkey;
    },
  });

  recorder.start();

  // Press just Control — should not record
  fireKey("Control", { ctrlKey: true });
  assert.strictEqual(recorded, null, "Control alone was not recorded");
  assert.ok(recorder.isRecording, "Still recording after modifier-only press");

  // Now press S with Ctrl — should record
  fireKey("s", { ctrlKey: true });
  assert.ok(recorded !== null, "Recorded after action key");
});

QUnit.test("Auto-stops after recording", (assert) => {
  let recordCount = 0;

  const recorder = createRecorder({
    onRecord: () => {
      recordCount++;
    },
  });

  recorder.start();
  fireKey("F5");

  // Second key should not be captured
  fireKey("F6");
  assert.strictEqual(recordCount, 1, "Only one key recorded (auto-stopped)");
});

QUnit.test("Modifier+Backspace records as hotkey (not clear)", (assert) => {
  const done = assert.async();

  const recorder = createRecorder({
    onRecord: (hotkey) => {
      assert.ok(hotkey.includes("Control"), "Hotkey includes Control modifier");
      assert.ok(hotkey.includes("Backspace"), "Hotkey includes Backspace");
      done();
    },
  });

  recorder.start();
  fireKey("Backspace", { ctrlKey: true });
});

QUnit.test("stop() is silent (no callbacks)", (assert) => {
  let recordCalled = false;
  let cancelCalled = false;

  const recorder = createRecorder({
    onRecord: () => {
      recordCalled = true;
    },
    onCancel: () => {
      cancelCalled = true;
    },
  });

  recorder.start();
  recorder.stop();

  assert.notOk(recordCalled, "onRecord not called on stop");
  assert.notOk(cancelCalled, "onCancel not called on stop");
  assert.notOk(recorder.isRecording, "Not recording after stop");
});

// ──────────────────────────────────────────────
// destroy() and edge cases (C10)
// ──────────────────────────────────────────────

QUnit.test("destroy() stops recording and prevents restart", (assert) => {
  const recorder = createRecorder({ onRecord: () => {} });

  recorder.start();
  assert.ok(recorder.isRecording, "Recording before destroy");

  recorder.destroy();
  assert.notOk(recorder.isRecording, "Not recording after destroy");
  assert.ok(recorder.isDestroyed, "Recorder is destroyed");

  recorder.start();
  assert.notOk(recorder.isRecording, "Cannot restart after destroy");
});

QUnit.test("start() while already recording is a no-op", (assert) => {
  let recordCount = 0;

  const recorder = createRecorder({
    onRecord: () => {
      recordCount++;
    },
  });

  recorder.start();
  recorder.start(); // Should be no-op
  assert.ok(recorder.isRecording, "Still recording");

  fireKey("F5");
  assert.strictEqual(recordCount, 1, "Only one recording captured despite double start");
});

QUnit.test("stop() while not recording is a no-op", (assert) => {
  const recorder = createRecorder({ onRecord: () => {} });

  // Not recording yet — stop should not throw
  recorder.stop();
  assert.notOk(recorder.isRecording, "Still not recording");
});

QUnit.test("cancel() without onCancel callback does not throw", (assert) => {
  const recorder = createRecorder({
    onRecord: () => {},
    // No onCancel provided
  });

  recorder.start();
  recorder.cancel(); // Should not throw
  assert.notOk(recorder.isRecording, "Not recording after cancel");
});
