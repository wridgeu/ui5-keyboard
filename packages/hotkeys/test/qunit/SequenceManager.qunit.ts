import SequenceManager from "ui5/hotkeys/SequenceManager";
import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;

QUnit.module("SequenceManager", {
  beforeEach() {
    try {
      SequenceManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Not initialized yet
    }
  },
  afterEach() {
    try {
      SequenceManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("getInstance returns singleton", (assert) => {
  const a = SequenceManager.getInstance();
  const b = SequenceManager.getInstance();
  assert.strictEqual(a, b, "Same instance returned");
});

QUnit.test("2-key sequence fires callback", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  seq.registerSequence(["G", "E"], () => {
    assert.ok(true, "G E sequence fired");
    done();
  });

  fireKey("g");
  setTimeout(() => {
    fireKey("e");
  }, 50);
});

QUnit.test("Timeout resets sequence", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { timeout: 100 },
  );

  fireKey("g");

  // Wait longer than timeout, then fire second key
  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      assert.notOk(called, "Sequence did not fire after timeout");
      done();
    }, 50);
  }, 200);
});

QUnit.test("Modifier sequences work", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  seq.registerSequence(["Ctrl+K", "Ctrl+S"], () => {
    assert.ok(true, "Ctrl+K Ctrl+S sequence fired");
    done();
  });

  fireKey("k", { ctrlKey: true });
  setTimeout(() => {
    fireKey("s", { ctrlKey: true });
  }, 50);
});

QUnit.test("Mismatch resets sequence", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");
  setTimeout(() => {
    // Wrong second key
    fireKey("x");

    setTimeout(() => {
      assert.notOk(called, "Sequence did not fire after mismatch");
      done();
    }, 50);
  }, 50);
});

QUnit.test("Overlapping sequences: G E vs G G", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let geCalled = false;
  let ggCalled = false;

  seq.registerSequence(["G", "E"], () => {
    geCalled = true;
  });
  seq.registerSequence(["G", "G"], () => {
    ggCalled = true;
  });

  // Fire G, G — should trigger G G but not G E
  fireKey("g");
  setTimeout(() => {
    fireKey("g");

    setTimeout(() => {
      assert.ok(ggCalled, "G G sequence fired");
      assert.notOk(geCalled, "G E sequence did not fire");
      done();
    }, 50);
  }, 50);
});

QUnit.test("Scope filtering with HotkeyManager", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  const hk = HotkeyManager.getInstance();
  let called = false;

  seq.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { scope: "editor" },
  );

  // Editor scope not active — should not fire
  fireKey("g");
  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      assert.notOk(called, "Sequence did not fire in wrong scope");

      // Push editor scope and try again
      hk.pushScope("editor");
      fireKey("g");

      setTimeout(() => {
        fireKey("e");

        setTimeout(() => {
          assert.ok(called, "Sequence fires in correct scope");
          done();
        }, 50);
      }, 50);
    }, 50);
  }, 50);
});

QUnit.test("Disabled sequence does not fire", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { enabled: false },
  );

  fireKey("g");
  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      assert.notOk(called, "Disabled sequence did not fire");
      done();
    }, 50);
  }, 50);
});

QUnit.test("Unregister clears pending matches", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  const handle = seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");

  // Unregister mid-sequence
  handle.unregister();
  assert.notOk(handle.isActive, "Handle is no longer active");

  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      assert.notOk(called, "Sequence did not fire after unregister");
      done();
    }, 50);
  }, 50);
});

QUnit.test("getRegistrations returns active registrations", (assert) => {
  const seq = SequenceManager.getInstance();

  assert.strictEqual(seq.getRegistrations().length, 0, "Empty initially");

  const h1 = seq.registerSequence(["G", "E"], () => {});
  const h2 = seq.registerSequence(["G", "G"], () => {});

  assert.strictEqual(seq.getRegistrations().length, 2, "Two registrations after adding");

  h1.unregister();
  assert.strictEqual(seq.getRegistrations().length, 1, "One registration after unregister");

  h2.unregister();
  assert.strictEqual(seq.getRegistrations().length, 0, "Empty after all unregistered");
});

QUnit.test("setPendingCallback fires on mid-sequence progress", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  const pendingCalls: { completedSteps: number; totalSteps: number; nextKey: string }[] = [];

  seq.registerSequence(["G", "E", "X"], () => {
    // Full sequence callback — not relevant for this test
  });

  seq.setPendingCallback((info) => {
    pendingCalls.push({
      completedSteps: info.completedSteps,
      totalSteps: info.totalSteps,
      nextKey: info.nextKey,
    });
  });

  fireKey("g");

  setTimeout(() => {
    assert.strictEqual(pendingCalls.length, 1, "Pending callback fired after first key");
    assert.strictEqual(pendingCalls[0].completedSteps, 1, "1 step completed");
    assert.strictEqual(pendingCalls[0].totalSteps, 3, "3 total steps");
    assert.strictEqual(pendingCalls[0].nextKey, "E", "Next key is E");

    // Clean up
    seq.setPendingCallback(null);
    done();
  }, 50);
});

QUnit.test("Destroy cleans up everything", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  seq.destroy();

  fireKey("g");

  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      assert.notOk(called, "Sequence did not fire after destroy");

      // New instance should be fresh
      const newSeq = SequenceManager.getInstance();
      assert.strictEqual(newSeq.getRegistrations().length, 0, "New instance has no registrations");
      done();
    }, 50);
  }, 50);
});

QUnit.test("Sequences are suppressed in input elements by default", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "g");
  setTimeout(() => {
    fireKeyOn(input, "e");

    setTimeout(() => {
      assert.notOk(called, "Sequence suppressed when input is focused");
      done();
    }, 50);
  }, 50);
});

QUnit.test("ignoreInputs: false allows sequences in input elements", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  seq.registerSequence(
    ["Ctrl+K", "Ctrl+S"],
    () => {
      assert.ok(true, "Ctrl+K Ctrl+S fired inside input");
      done();
    },
    { ignoreInputs: false },
  );

  fireKeyOn(input, "k", { ctrlKey: true });
  setTimeout(() => {
    fireKeyOn(input, "s", { ctrlKey: true });
  }, 50);
});

QUnit.test("Mid-sequence input focus drops matches with ignoreInputs", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  // Start sequence on document, then second key on input
  fireKey("g");
  setTimeout(() => {
    fireKeyOn(input, "e");

    setTimeout(() => {
      assert.notOk(called, "Sequence dropped when focus moves to input mid-sequence");
      done();
    }, 50);
  }, 50);
});

// ──────────────────────────────────────────────
// Validation (C9)
// ──────────────────────────────────────────────

QUnit.test("1-step sequence throws", (assert) => {
  const seq = SequenceManager.getInstance();
  assert.throws(() => seq.registerSequence(["G"], () => {}), /at least 2 steps/, "Throws for 1-step sequence");
});

QUnit.test("Empty sequence throws", (assert) => {
  const seq = SequenceManager.getInstance();
  assert.throws(() => seq.registerSequence([], () => {}), /at least 2 steps/, "Throws for empty sequence");
});

QUnit.test("3-key sequence completes", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(["G", "E", "X"], () => {
    called = true;
  });

  fireKey("g");
  setTimeout(() => {
    fireKey("e");
    setTimeout(() => {
      fireKey("x");
      setTimeout(() => {
        assert.ok(called, "3-key sequence completed");
        done();
      }, 50);
    }, 50);
  }, 50);
});

QUnit.test("Callback error does not crash", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  seq.registerSequence(["G", "E"], () => {
    throw new Error("Intentional test error");
  });

  // Should not throw — the error is caught and logged
  fireKey("g");
  setTimeout(() => {
    fireKey("e");

    setTimeout(() => {
      // Verify the manager is still operational
      let secondCalled = false;
      seq.registerSequence(["H", "I"], () => {
        secondCalled = true;
      });

      fireKey("h");
      setTimeout(() => {
        fireKey("i");
        setTimeout(() => {
          assert.ok(secondCalled, "Manager still operational after callback error");
          done();
        }, 50);
      }, 50);
    }, 50);
  }, 50);
});

// ──────────────────────────────────────────────
// preventDefault / stopPropagation (C11 / B1)
// ──────────────────────────────────────────────

QUnit.test("preventDefault: false does not prevent default on final key", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  seq.registerSequence(["G", "E"], () => {}, { preventDefault: false });

  fireKey("g");
  setTimeout(() => {
    const event = fireKey("e");
    setTimeout(() => {
      assert.notOk(event.defaultPrevented, "Default not prevented on final key");
      done();
    }, 50);
  }, 50);
});

QUnit.test("stopPropagation: false allows propagation on final key", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  seq.registerSequence(["G", "E"], () => {}, { stopPropagation: false });

  fireKey("g");
  setTimeout(() => {
    fireKey("e");
    setTimeout(() => {
      assert.ok(propagated, "Event propagated on final key");
      document.removeEventListener("keydown", listener);
      done();
    }, 50);
  }, 50);
});

// ──────────────────────────────────────────────
// setOptions (C11 / B2)
// ──────────────────────────────────────────────

QUnit.test("setOptions: toggle enabled off", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  const handle = seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  handle.setOptions({ enabled: false });

  fireKey("g");
  setTimeout(() => {
    fireKey("e");
    setTimeout(() => {
      assert.notOk(called, "Sequence does not fire when disabled via setOptions");
      done();
    }, 50);
  }, 50);
});

QUnit.test("setOptions: toggle enabled back on", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  const handle = seq.registerSequence(["G", "E"], () => {
    called = true;
  });

  handle.setOptions({ enabled: false });
  handle.setOptions({ enabled: true });

  fireKey("g");
  setTimeout(() => {
    fireKey("e");
    setTimeout(() => {
      assert.ok(called, "Sequence fires again after re-enabling via setOptions");
      done();
    }, 50);
  }, 50);
});

QUnit.test("setOptions: throws on unregistered handle", (assert) => {
  const seq = SequenceManager.getInstance();
  const handle = seq.registerSequence(["G", "E"], () => {});
  handle.unregister();

  assert.throws(() => handle.setOptions({ enabled: false }), /unregistered/, "Throws on setOptions after unregister");
});

QUnit.test("setOptions: throws on scope change", (assert) => {
  const seq = SequenceManager.getInstance();
  const handle = seq.registerSequence(["G", "E"], () => {});

  assert.throws(
    () => handle.setOptions({ scope: "other" } as any),
    /Cannot change scope/,
    "Throws when trying to change scope",
  );
});

// ──────────────────────────────────────────────
// ignoreInputs: "auto" (C11 / B3)
// ──────────────────────────────────────────────

QUnit.test("ignoreInputs: auto suppresses single-key sequence in input", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();
  let called = false;

  seq.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { ignoreInputs: "auto" },
  );

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "g");
  setTimeout(() => {
    fireKeyOn(input, "e");
    setTimeout(() => {
      assert.notOk(called, "Single-key sequence suppressed in input with auto");
      done();
    }, 50);
  }, 50);
});

QUnit.test("ignoreInputs: auto allows Ctrl sequence in input", (assert) => {
  const done = assert.async();
  const seq = SequenceManager.getInstance();

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  seq.registerSequence(
    ["Ctrl+K", "Ctrl+S"],
    () => {
      assert.ok(true, "Ctrl sequence allowed in input with auto");
      done();
    },
    { ignoreInputs: "auto" },
  );

  fireKeyOn(input, "k", { ctrlKey: true });
  setTimeout(() => {
    fireKeyOn(input, "s", { ctrlKey: true });
  }, 50);
});
