# Free-port guard for the QUnit suites: adversarial hypotheses

- Date: 2026-08-03
- Guard under test: `tools/check-port-free.mjs`, prefixed onto `test:qunit` in
  `packages/kiosk-keyboard/package.json` (8082) and `packages/hotkeys/package.json` (8081)
- Test under test: `tools/check-port-free.test.mjs` (`npm run test:lint-plugins`)
- Method (CLAUDE.md §7): a green guard can lie. Each hypothesis below is a way a green
  run could be a false positive. Cleared only after SEEING the suite go red for it, then
  reverting the perturbation.

## The defect being guarded

`test:qunit` is `start-server-and-test "ui5 serve --port 8082" <url> "<ui5-test-runner …>"`.
With a pre-existing listener on 8082, `start-server-and-test` still spawns its own
`ui5 serve`, polls the URL, gets 200 from the FOREIGN server, declares ready and runs the
whole suite against it. Its own child dies with `EADDRINUSE` and that is never treated as
fatal: observed as "starting server" -> tests already running -> `EADDRINUSE: Port 8082 is
already in use` -> all suites pass -> exit 0. A server left running from another branch or
another clone yields a fully green run against the wrong code.

The guard therefore has to fail BEFORE `start-server-and-test` runs, which is why it is
joined with `&&` rather than folded into the runner.

## Why a connect probe, not a bind probe

Asking "can I bind this port?" answers a different question. A `bind` probe reports the
port busy for a socket in `TIME_WAIT`, and reports it free against a listener that set
`SO_REUSEADDR`/`SO_REUSEPORT`; both are the wrong answer for "will an HTTP poll reach a
foreign server here?". A `connect` probe answers exactly that question.

## Loopback host list

`@ui5/server` binds `127.0.0.1` only, but the hijack is decided by what
`start-server-and-test` reaches when it polls `http://localhost:<port>/…`, and Node
resolves `localhost` in verbatim DNS order, so `::1` can win. A foreign listener bound to
`::1` alone is therefore hijackable while `127.0.0.1` is genuinely free, and a listener
bound dual-stack (`::`) is reachable on `127.0.0.1`. Both hosts are probed, and H2 below
requires each to be independently load-bearing.

## Hypotheses

- **H1 (the occupied branch is live).** A guard that never fails is indistinguishable from
  a green run. Perturbation: neuter the occupied branch in `check-port-free.mjs`
  (`if (false)`). Expected: the occupied tests go red.
- **H2 (every probed host is load-bearing).** A host in the list that no test covers is
  decorative. Perturbation: delete `127.0.0.1`, then `::1`, from `LOOPBACK_HOSTS` in turn.
  Expected: the corresponding test goes red each time. A deletion that leaves the suite
  green means the host is removed from the guard instead.
- **H3 (the free-port case is real).** A guard that exits 1 unconditionally would also make
  H1/H2 red. Perturbation: none needed if a free-port test asserts exit 0 alongside; it is
  cleared by that test passing while the occupied tests fail under H1.
- **H4 (the wiring assertions are live).** The wiring test is the only automated coverage
  of the reported defect: it must fail when the guard's port stops matching the served
  port. Perturbation: change the guard argument in `packages/kiosk-keyboard/package.json`
  to a port that does not match `--port` / the URL. Expected: red.
- **H4b (the ordering assertion is live).** A guard appended after the runner would satisfy
  every port comparison while guarding nothing. Perturbation: move the guard to the tail of
  the kiosk `test:qunit` script. Expected: red.
- **H5 (the test file is actually executed).** `test:lint-plugins` runs
  `node --test tools/*.test.mjs`; a runner that never picks the new file up would report
  success while running zero of its tests. Perturbation: inject a failing assertion into
  the new file and run `npm run test:lint-plugins`. Expected: red, naming this file.
- **H6 (end to end, the real defect).** The unit tests exercise the guard, not the pipeline.
  Perturbation: start `ui5 serve --port 8082` by hand, then run `npm run test:qunit`.
  Expected: fails fast with the guard's message and never starts the suite; passes again
  once that server is killed.

## Results

Each perturbation was reverted immediately after observing red, and the suite re-run green
afterwards.

| Hypothesis | Perturbation                                               | Observed                                                                                                            | Cleared |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- |
| H1         | occupied branch -> `if (false)`                            | red: both occupied tests failed (`exit code 1` expected, got `0`)                                                   | yes     |
| H2a        | drop `"127.0.0.1"` from `LOOPBACK_HOSTS`                   | red: only the 127.0.0.1 test failed; `::1` test still green                                                         | yes     |
| H2b        | drop `"::1"` from `LOOPBACK_HOSTS`                         | red: only the `::1` test failed; 127.0.0.1 test still green                                                         | yes     |
| H4         | kiosk guard argument `8082` -> `9082`                      | red: `guard port 9082 does not match the --port 8082` in the wiring test                                            | yes     |
| H4b        | guard moved to the tail of the kiosk script                | red: `kiosk-keyboard: the guard must run before start-server-and-test`                                              | yes     |
| H5         | failing assertion added to `check-port-free.test.mjs`      | red: `node --test tools/*.test.mjs` reported the failure under `tools/check-port-free.test.mjs`, so the file is run | yes     |
| H6         | `ui5 serve --port 8082` running, then `npm run test:qunit` | red: guard message, exit 1, no suite run. Killed the server, re-ran: full QUnit suite green                         | yes     |

## Accepted residuals

- The guard probes loopback only. A foreign server bound to a routable interface but not to
  loopback cannot be reached by `start-server-and-test`'s `localhost` poll either, so it is
  not part of the defect.
- The probe is a point-in-time check. A server that starts in the window between the guard
  and `start-server-and-test` still hijacks the run; closing that would require owning the
  server lifecycle instead of `start-server-and-test`, which is not worth the swap.
- The wiring test parses the script strings textually. It proves the three ports agree, not
  that `ui5 serve` and `ui5-test-runner` are invoked correctly; that is what H6 covers once.
