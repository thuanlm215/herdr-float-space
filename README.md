# Herdr Float Space

A floating scratch window for the [Herdr](https://herdr.dev) desktop app:
terminal tabs of its own and autosaved Notes shared across all your spaces.
Press **Ctrl+Shift+Space**, run a side task or jot something down, press it
again and you're back where you were. Your layout stays as it is.

![Float Space](preview.png)

## Use

- **Ctrl+Shift+Space** shows/hides it, in any layout.
- With the **header or Notes focused**, **Ctrl+Tab** / **Ctrl+Shift+Tab**
  cycle through Notes and terminal tabs, and **Ctrl+Shift+N** opens Notes.
  Notes takes the keyboard when opened. Click the header to use these
  shortcuts from a terminal; floating terminals have Herdr's terminal context.
- **Ctrl+Shift+T** adds a terminal to Float while its terminal, header or Notes
  has the keyboard. In a normal workspace terminal, it creates a regular tab,
  also while Float is hidden or when the layout has no Float button.
- Click a terminal to type. **+** adds another shell, starting in the folder
  the open space's terminal is in now (up to 12), the same place a new Herdr
  tab starts. A space on another machine starts in your home directory.
  Shells are numbered like Herdr's tabs: the lowest number no open tab uses.
- Switch tabs inside the window without touching the space behind it. Agents
  show their own name and icon, with Herdr's working spinner and
  blocked/done dots. As in Herdr, the done dot goes away once you've seen
  that tab, even if the agent keeps reporting done.
- An agent in Float Space that finishes or needs you gets Herdr's own agent
  toast ("Codex finished", "Codex needs you") and sound, unless you're
  watching it: Herdr is the active app, the keyboard is in Float Space and
  that tab is shown. The sounds follow `sounds` in Herdr's settings (your
  own files, or off). **Click the toast to open that agent's tab**, even if
  you have since hidden Float Space. An expired or closed terminal is
  reported without starting a replacement. With the optional status-bar
  button in your layout, this also works while Float Space is hidden;
  without it, agents are watched only while the window is open.
- The status-bar button shows a dot in Herdr's yellow (its working color)
  when an agent finished and you haven't seen it yet. It goes away once that
  tab shows in the open window while Herdr is the active app.
- While the keyboard is in Float Space (its terminal, Notes or header), its
  border turns your theme's accent color. It follows actual keyboard focus,
  including changes made by keys or commands, and dims when another pane,
  a popup or another app has the keyboard.
- **Notes** leads the header and can't be closed. It holds up to five named
  notes, shared across spaces, in your terminal font and size. The tab shows
  the open note's name; its chevron (or a click on the tab while Notes
  shows) opens the list, where you switch, add, color (dot), rename
  (pencil) or delete (×) notes. ↑/↓ and Enter work there too. A note with text asks before it
  goes; the last note can't be deleted. Notes save once you pause typing,
  and when you switch notes or tabs or hide the window.
- **Note colors**: the dot on a note's row shows its colors, sticky-note
  style: white, black, red, orange, yellow, green, blue or pink, or
  **Theme** (the first, a ring) to follow Herdr's theme again. ←/→ and Enter
  pick one from the keyboard. A colored note paints the Notes page and the
  window's bottom edge, keeps that color in light and dark themes, and shows
  it as a small square on the Notes tab. In a dark theme the caret and
  selection stay Herdr's near-white, faint on the pastel colors. Earlier
  versions of Float Space drop the color when they save.
- **Window size** (diagonal arrows) has three presets: **Small** (25% × 50%,
  for notes or a quick command), **Normal** (50% × 60%, the default) and
  **Large** (85% × 88%, room for an agent). Sliders set any other size
  from 15% to 95%; **Apply** keeps it, and **Custom** beside the presets
  brings back the last such size in one click. Each size opens centered the
  first time and then wherever you last dragged it. Drag free header space to
  move the window.
- **−** hides the window and leaves shells and their programs running. The
  button and Ctrl+Shift+Space also work while a terminal is being created
  or a core query is pending. Work already started may finish in the
  background; it does not reopen the window after you hide it. The
  selected tab's **×** ends its terminal at once, like closing a tab in
  Herdr. When a terminal ends, the window shows the next tab, or Notes after
  the last one.

## Install

Requires Herdr desktop **0.1.14 or newer** and `hc`: this version reports
keyboard focus in floating terminals. Earlier builds were tested on Linux
with Herdr 0.1.11 and core 0.1.16; macOS and Windows have not been tested.

Float Space runs `hc` to start, list and end its own shells, and keeps Notes
as plaintext in its own file, `~/.config/herdr-app/data/float-space/notes.json`.
It makes no network requests.

**With your Herdr agent:** ask it to add this mod from
`https://github.com/thuanlm215/herdr-float-space`. It copies
`mods/float-space` into the app and merges `keys.json`, as described in the
app's `AGENTS.md`.

**With the script**, from a clone of this repository:

```sh
python3 scripts/install.py --dry-run
python3 scripts/install.py
```

It copies the mod into `~/.config/herdr-app/mods/`, adds the shortcuts
without replacing any binding you already use, and backs up `keys.json`
under `~/.config/herdr-app/backups/float-space/`. It never touches a layout.
`--update` installs a newer checkout over a previous install and refuses to
overwrite files you edited. `--app-home <folder>` picks another Herdr home.
No restart is needed.

**By hand:** copy `mods/float-space` and `mods/float-space-new` into
`~/.config/herdr-app/mods/` and add the bindings from `keys.json` to yours.

**Optional status-bar button**, if you keep a personal layout (a clone made
with "Duplicate layout"): put this block beside its `status` block. Besides
toggling the window, it shows a dot for a finished agent you haven't seen
and keeps the toasts and sounds coming while Float Space is hidden.

```json
{
  "id": "float-space-launcher",
  "type": "block",
  "size": { "px": 32 },
  "content": { "mod": "float-space", "props": { "role": "launcher" } }
}
```

## State and terminal ownership

Tabs, the selected tab and the window size are saved under the shared key
`float-space.v1`, so they survive restarts. Herdr saves where each window
size was dropped in `windows.json`. Don't hand-edit `shared.json` while
Herdr runs.

Notes live in `~/.config/herdr-app/data/float-space/notes.json`, written
atomically:

```json
{ "version": 1, "active": "n1", "sequence": 1,
  "notes": [{ "id": "n1", "name": "Notes", "text": "…" }] }
```

Keeping them out of shared state means typing no longer redraws every mod
in the app. An agent or an editor may change the file; Float Space shows the
change the next time Notes or its list opens. A change made while Notes is
open loses to the next save from Float Space, and a notification says so.
Float Space never overwrites a file it can't read; it shows the problem in
Notes instead. Earlier versions kept one Notes page in shared state; the
first opening moves it into the file as the note "Notes" and only then
removes it from shared state.

Hiding Float Space or closing Herdr leaves its shells running while the
machine stays up. After a reboot, core brings them back as shells in their
last folder (`--keep`); a program or agent that was running is not
restarted. Resume an agent through its own commands.

Its terminals carry the labels `herdr.mod=float-space` and
`herdr.float-space=<app home>`. Float Space asks core for terminals with
both labels before showing or ending one, so it never ends a terminal that
isn't its own, and it finds its shells again if its saved tab list is lost.

## Current limits

- Herdr 0.1.10 can't focus an overlay terminal for a mod, so opening the
  window focuses its header: click the terminal before typing.
- Switching layouts closes the window; the shortcut opens it again with the
  same terminals and notes.
- Mods can't add entries to the command palette (Ctrl+Shift+P) yet; use the
  shortcut.
- Right-clicking a Float Space terminal shows Herdr's pane menu, and its
  Split, Zoom and Close pane items don't work there (a mod can't replace that
  menu for its own window). Use **+** and the tab's **×**; "Send right-clicks
  to pane" works.
- Mods can't resize a window by its edges; use **Window size**.

## Development

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
herdr-app check mods/float-space
```

No npm packages or build step. `model.js` holds saved state and the window's
layout, `notes.js` the notes, `controller.js` the window's lifecycle,
`main.js` the views and Herdr calls. [RECIPE.md](RECIPE.md) is the brief to
rebuild it from scratch;
[docs/validation.md](docs/validation.md) records the checks run on the real
app. See [CONTRIBUTING.md](CONTRIBUTING.md) before sending a change.

## Remove

Hide Float Space, remove its `ctrl-shift-space` bindings, the
`terminal` section's `ctrl-shift-t` binding and the `mod:float-space` section
from `keys.json`
(and the button block, if you added one), then delete
`~/.config/herdr-app/mods/float-space` and `mods/float-space-new` from the
same app folder. Notes and shells stay (delete
`~/.config/herdr-app/data/float-space/notes.json` to remove the notes). To end the
shells too, close their tabs first, or list them with
`hc ls --json --label herdr.mod=float-space` and end only the ones whose
`herdr.float-space` label is your app home.

MIT licensed. An independent community project, not affiliated with Herdr.
