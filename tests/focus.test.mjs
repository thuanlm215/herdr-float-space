import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as model from "../mods/float-space/model.js";
import { FloatController } from "../mods/float-space/controller.js";

// Exercise the real view with Herdr's focus snapshot and native handle stubbed.
// No GPU or running app is needed, and each test gets its own mod runtime.
const source = readFileSync(new URL("../mods/float-space/main.js", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replace("export default class FloatSpace", "class FloatSpace")
  + "\nglobalThis.FloatSpace = FloatSpace;";

function fixture() {
  const state = model.readState({ version: 2, page: "terminal", active: "t10",
    tabs: [{ address: "t10", title: "Terminal 1" }, { address: "t11", title: "Terminal 2" }] });
  const data = { state, active: true, header: false,
    focus: { tab: "tab1", pane: "p1", terminal: "t1" }, shared: {}, writes: [],
    closed: [], opened: [], notices: [] };
  function element() {
    const el = {};
    for (const method of ["size_full", "border_b", "border_l", "border_r", "rounded_b"])
      el[method] = () => el;
    el.bg = color => { el.color = color; return el; };
    el.border_color = el.bg;
    return el;
  }
  const runtime = vm.createContext({ ...model, FloatController, View: class {},
    shared: key => key === model.STATE_KEY ? data.state : data.shared[key] ?? null,
    setShared: (key, value) => { data.shared[key] = value; data.writes.push([key, value]); },
    focused: () => data.focus, app: () => ({ active: data.active }),
    appHome: () => "/app", panes: () => [{ pane: "p1", tab: "tab1" }], terminals: () => [],
    openOverlay: spec => { data.opened.push(spec); return "command-copy"; },
    closeOverlay: id => data.closed.push(id), run() {}, notify: info => data.notices.push(info),
    props: () => ({ role: "bar", generation: 1 }),
    theme: () => ({ accent: "accent", input: "input", background: "background" }),
    div: element,
  });
  vm.runInContext(source, runtime, { filename: "float-space/main.js" });
  const view = new runtime.FloatSpace();
  view.role = "bar";
  view.handle = { is_focused: () => data.header };
  const memory = runtime.windowShared();
  memory.controller.overlay = "float-window";
  view.renderBar = () => memory.keyboard;
  return { view, data, memory, runtime };
}

test("returning to the pane where a terminal click began clears Float focus", () => {
  const { view, data } = fixture();
  // Old versions kept this click key, even after focus left the window.
  view.pressedIn = "p1|t1";
  data.focus = { pane: null, terminal: "t10" };
  assert.equal(view.keyboard(), true);
  data.focus = { pane: "p1", terminal: "t1" };
  assert.equal(view.keyboard(), false);
  assert.equal(view.canNavigate(), false);
});

test("a live focus change updates the border before drawing without a timer", () => {
  const { view, data, memory } = fixture();
  assert.equal(view.render(), false);
  data.focus = { pane: null, terminal: "t10" };
  assert.equal(view.render(), true);
  assert.equal(memory.keyboard, true);
  data.focus = { pane: "p1", terminal: "t1" };
  assert.equal(view.render(), false);
});

test("the header and Notes count only while they hold the keyboard", () => {
  const { view, data, memory } = fixture();
  data.header = true;
  assert.equal(view.render(), true);
  data.header = false;
  memory.notesFocused = true;
  data.state.page = "notes";
  assert.equal(view.render(), true);
  memory.notesFocused = false;
  assert.equal(view.render(), false);
});

test("an owned terminal in another pane or another tab is not this window's focus", () => {
  const { view, data } = fixture();
  data.focus = { pane: "p2", terminal: "t10" };
  assert.equal(view.keyboard(), false);
  data.focus = { pane: null, terminal: "t11" };
  assert.equal(view.keyboard(), false);
  data.focus = { pane: null, terminal: "t10" };
  data.state.page = "notes";
  assert.equal(view.keyboard(), false);
});

test("leaving the app dims the border even if its internal focus is remembered", () => {
  const { view, data, memory } = fixture();
  data.header = true;
  assert.equal(view.render(), true);
  data.active = false;
  assert.equal(view.render(), false);
  assert.equal(view.canNavigate(), false);
  memory.notesFocused = true;
  assert.equal(view.keyboard(), false);
  data.active = true;
  assert.equal(view.render(), true);
});

test("focus clears after a native click even when Herdr does not redraw the header", () => {
  const { view, data, memory } = fixture();
  const ticks = new Map();
  view.init({}, {
    focus_handle: () => view.handle,
    spawn() {},
    timer: { after() {}, every: (ms, callback) => ticks.set(ms, callback) },
  });
  data.header = true;
  view.render();
  assert.equal(memory.keyboard, true);
  // A native focus handle can blur with no new Herdr data or JS render.
  data.header = false;
  ticks.get(150)();
  assert.equal(memory.keyboard, false);
  const writes = data.writes.length;
  ticks.get(150)();
  ticks.get(150)();
  assert.equal(data.writes.length, writes, "unchanged focus must not refresh the views");
});

test("a Notes focus event left over from a replaced view cannot focus a terminal page", () => {
  const { view, data, memory } = fixture();
  memory.notesFocused = true;
  assert.equal(data.state.page, "terminal");
  assert.equal(view.keyboard(), false);
});

test("a focus promise left by a stopped copy cannot block the next focus update", () => {
  const { runtime, data, memory } = fixture();
  memory.keyboard = false;
  memory.focusChanged = { resolve() { throw new Error("copy was stopped"); } };
  assert.doesNotThrow(() => runtime.showFocus(true));
  assert.equal(data.shared["float-space.focus.v1"], true);
});

test("all border edges draw published focus, including after reopening", () => {
  const { runtime, data, memory } = fixture();
  for (const focused of [false, true, false, true]) {
    data.shared["float-space.focus.v1"] = focused;
    // A recreated edge must not depend on a previous copy's global flag or task.
    memory.keyboard = !focused;
    for (const side of ["left", "right", "bottom"]) {
      const edge = new runtime.FloatSpace();
      edge.role = "edge";
      edge.copyProps = { side };
      assert.equal(edge.render().color, focused ? "accent" : "input");
    }
  }
});

test("hot reload publishes missing focus state once and unchanged ticks do not refresh", () => {
  const { runtime, data, memory } = fixture();
  memory.keyboard = true;
  runtime.showFocus(true);
  runtime.showFocus(true);
  assert.deepEqual(data.writes, [["float-space.focus.v1", true]]);
  runtime.showFocus(false);
  runtime.showFocus(false);
  assert.deepEqual(data.writes, [["float-space.focus.v1", true], ["float-space.focus.v1", false]]);
});

test("an invisible command copy has pixel dimensions rather than viewport fractions", () => {
  const { runtime, data } = fixture();
  runtime.act("new");
  const spec = data.opened[0];
  // Herdr interprets every value <= 1 as a viewport fraction.
  assert.ok(spec.width > 1 && spec.width <= 4);
  assert.ok(spec.height > 1 && spec.height <= 4);
});

test("hiding a visible Float bypasses a pending command without releasing its lease", async () => {
  const { runtime, data, memory } = fixture();
  memory.lease = { owner: "pending-new", at: Date.now() };
  await runtime.executeCommand("toggle", "toggle-copy", {
    sleep: async () => { throw new Error("Hide must not wait for the pending operation"); },
  });
  assert.ok(data.closed.includes("float-window"));
  assert.ok(data.closed.includes("toggle-copy"));
  assert.equal(memory.controller.overlay, null);
  assert.equal(memory.lease.owner, "pending-new");
  assert.deepEqual(data.notices, []);
});
