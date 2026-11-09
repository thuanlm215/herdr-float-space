import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../mods/float-space-new/main.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default class NewTerminalShortcut", "class NewTerminalShortcut")
  + "\nglobalThis.Shortcut = NewTerminalShortcut;";

function fixture() {
  const data = { overlay: "shortcut", focus: { pane: null, terminal: "t10" },
    state: { page: "terminal", active: "t10" },
    terminal: { address: "t10", state: "live", labels: { "herdr.mod": "float-space", "herdr.float-space": "/app" } },
    calls: [], finished: Promise.resolve("finished"), coreOwned: [{ address: "t10", state: "live" }] };
  const jobs = [];
  const runtime = vm.createContext({ View: class {}, div() {}, appHome: () => "/app",
    props: () => ({ overlay: data.overlay }), focused: () => data.focus,
    terminals: () => data.terminal ? [data.terminal] : [],
    hc: async () => ({ code: 0, stdout: JSON.stringify({ terminals: data.coreOwned }) }),
    nextCommand: () => data.finished,
    openOverlay: spec => { if (data.fail) throw new Error("open failed"); data.calls.push(["open", spec]); },
    run: command => data.calls.push(["run", command]),
    closeOverlay: id => data.calls.push(["close", id]),
  });
  vm.runInContext(source, runtime);
  return { data, press: async () => {
    const cx = { spawn: work => jobs.push(work(cx)), timer: { after() {} } };
    new runtime.Shortcut().init({}, cx);
    await Promise.all(jobs);
  } };
}

test("Ctrl+Shift+T in a Float terminal creates through Float's own command copy", async () => {
  const { data, press } = fixture();
  await press();
  assert.equal(data.calls[0][0], "open");
  assert.equal(data.calls[0][1].mod, "float-space");
  assert.equal(data.calls[0][1].props.role, "run");
  assert.equal(data.calls[0][1].props.command, "new");
  assert.deepEqual(data.calls[1], ["close", "shortcut"]);
  assert.equal(data.calls.some(([kind]) => kind === "run"), false);
});

test("a workspace pane creates a normal tab while Float is open or hidden", async () => {
  for (const state of [{ page: "terminal", active: "t10" }, null]) {
    const { data, press } = fixture();
    data.state = state;
    data.focus = { pane: "p1", terminal: "t1" };
    await press();
    assert.deepEqual(data.calls, [["run", "tab.new"], ["close", "shortcut"]]);
  }
});

test("a saved Float address does not route a foreign or ended terminal into Float", async () => {
  for (const patch of [{ state: "finished" }, { labels: {} },
    { labels: { "herdr.mod": "float-space", "herdr.float-space": "/other-app" } }]) {
    const { data, press } = fixture();
    Object.assign(data.terminal, patch);
    await press();
    assert.deepEqual(data.calls, [["run", "tab.new"], ["close", "shortcut"]]);
  }
});

test("a terminal shown as a real pane keeps the workspace shortcut", async () => {
  const { data, press } = fixture();
  data.focus.pane = "p1";
  await press();
  assert.equal(data.calls[0][1], "tab.new");
});

test("the shortcut copy closes even if Float cannot open", async () => {
  const { data, press } = fixture();
  data.fail = true;
  await assert.rejects(press, /open failed/);
  assert.deepEqual(data.calls, [["close", "shortcut"]]);
});

test("checking the shortcut without an overlay runs no command", async () => {
  const { data, press } = fixture();
  data.overlay = null;
  await press();
  assert.deepEqual(data.calls, []);
});

test("the router stays alive until Float acknowledges creation, not just shell spawn", async () => {
  const { data, press } = fixture();
  let finish;
  data.finished = new Promise(resolve => { finish = resolve; });
  const pending = press();
  await Promise.resolve();
  assert.equal(data.calls.length, 1);
  assert.equal(data.calls[0][0], "open");
  assert.equal(data.calls[0][1].props.shortcut, true);
  finish("finished");
  await pending;
  assert.deepEqual(data.calls[1], ["close", "shortcut"]);
});

test("a terminal focused during a tab remount routes by ownership, not selected-tab timing", async () => {
  const { data, press } = fixture();
  data.state = { page: "terminal", active: "t11" };
  await press();
  assert.equal(data.calls[0][0], "open");
});

test("a newly focused terminal missing from the live cache is confirmed through core", async () => {
  const { data, press } = fixture();
  data.terminal = null;
  await press();
  assert.equal(data.calls[0][0], "open");
});
