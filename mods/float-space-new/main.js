// Terminal blocks in a floating window still have Herdr's Terminal key context.
// This short-lived entry routes Ctrl+Shift+T even when Float itself is hidden
// or absent from the shown layout. It never takes the keyboard.
import { View, div } from "gpui-kit";
import { appHome, closeOverlay, focused, hc, nextCommand, openOverlay, props, run, terminals } from "herdr";

async function ownsFocus(focus, terminal) {
  if (focus?.pane !== null || !focus.terminal) return false;
  if (terminal) return terminal.state === "live"
    && terminal.labels?.["herdr.mod"] === "float-space"
    && terminal.labels?.["herdr.float-space"] === appHome();
  // A newly created terminal can take focus before it reaches the live cache.
  const result = await hc(["ls", "--json", "--label", "herdr.mod=float-space",
    "--label", `herdr.float-space=${appHome()}`]);
  if (result.code !== 0) throw new Error(result.stderr.trim() || "Could not check Float terminal ownership");
  return JSON.parse(result.stdout).terminals.some(item => item.address === focus.terminal && item.state === "live");
}

export default class NewTerminalShortcut extends View {
  init(_props, cx) {
    const overlay = props()?.overlay;
    if (!overlay) return; // `herdr-app check` must have no side effects.
    const focus = focused();
    const terminal = focus?.terminal && terminals().find(item => item.address === focus.terminal);
    cx.spawn(async cx => {
      try {
        if (await ownsFocus(focus, terminal)) {
          // Closing the router immediately can cancel the new copy's first hc
          // reply. Stay alive until Float has finished creating and mounting it.
          const finished = nextCommand();
          cx.timer.after(45000, () => closeOverlay(overlay));
          openOverlay({ mod: "float-space", kind: "window", frame: "none", width: 1, height: 1,
            props: { role: "run", command: "new", shortcut: true } });
          let command = await finished;
          while (command !== "finished") command = await nextCommand();
        } else {
          run("tab.new");
        }
      } finally {
        closeOverlay(overlay);
      }
    });
  }

  render() { return div(); }
}
