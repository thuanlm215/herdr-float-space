# Changelog

## Unreleased

- Slow terminal creation no longer leaves a transparent window covering the
  app's buttons. Hide and Ctrl+Shift+Space stay responsive while work is
  pending, and a delayed result does not reopen Float after it was hidden.
- Ctrl+Shift+T creates a terminal in Float when its terminal has the keyboard.
  From a workspace terminal it still creates a regular tab, with Float open,
  hidden or absent from the layout.
- Focus follows Herdr 0.1.14's actual floating-terminal focus, plus the
  header and Notes' native focus. Returning to a pane by a key or command
  clears the window's accent border and restores agent alerts correctly.
  The old click-position guess is gone; a 150 ms check reads real focus
  because native focus changes don't always redraw the mod. It redraws
  only on a change. A stale Notes focus flag can't keep a terminal tab's
  border lit. The border also dims when Herdr loses focus. Requires Herdr
  0.1.14 or newer.
- All four border edges refresh from the same published focus state.
  Closing, reopening or hot-reloading a copy can no longer strand the
  border on the previous color through a stopped copy's focus promise.
- Notes holds up to five named notes. The Notes tab shows the open note's
  name; its chevron opens a list to switch, add, rename or delete notes.
- Notes are kept in `data/float-space/notes.json` in the app's folder
  instead of Herdr's shared state, so typing no longer redraws every mod.
  The single Notes page of earlier versions moves there on first opening.
- The Small window preset is 25% wide (was 20%).
- Window size has a fourth choice, Custom: the last size you applied with
  the sliders, one click away like the presets, and kept across restarts.
- A window can be as small as 15% wide and 15% tall (was 20% and 30%).
- A tab goes back to the shell icon and its own title once the agent in it
  quits. Before, it kept the agent's icon and name, because herdr-core keeps
  an agent's last report after the agent exits.
- Notes no longer jumps when you press Enter at the bottom: the text moves up
  one row per new line, as in a terminal. Before, in a window tall enough for
  24 rows, it went up three rows for a moment and then dropped back two.
- The status-bar button shows a dot in Herdr's yellow when an agent finished
  and you haven't seen it yet. It stays until that tab shows in the open
  window.
- With the status-bar button in your layout, agent toasts and sounds also
  come while Float Space is hidden.
- Agent toasts are Herdr's own: "Codex finished" or "Codex needs you" (an
  error too), with Herdr's levels and timing, no extra text.
- A tab's done dot goes away once you've seen that tab, as in Herdr; before,
  it stayed for as long as the agent reported done.
- Focus: Notes reliably takes keyboard focus on open and tab selection without
  racing header chrome focus.
- Hiding Float Space cleanly restores keyboard focus to the previously active
  pane by unmounting the overlay window before requesting pane focus.
- The status-bar button's label waits 1000 ms before showing (a `HoverCard`
  instead of the 500 ms tooltip), matching a status bar whose other buttons
  wait that long.

## 0.2.0 — 2026-11-02

- Failed terminal-list synchronization retries on the next check, even when
  the live snapshot hasn't changed.
- Clicking an agent alert opens its Float Space tab, including after hiding
  the window. A stale alert never starts a replacement shell.
- Header/Notes shortcuts: Ctrl+Tab and Ctrl+Shift+Tab cycle pages,
  Ctrl+Shift+T starts a terminal, Ctrl+Shift+N opens Notes. Opening Notes
  focuses its editor. Embedded terminals keep Herdr's existing bindings.
- New shells start in the folder the open space's terminal is in now, the
  same place a new Herdr tab starts. A space on another machine still starts
  in your home directory.
- While the window is open, an agent in it that finishes or needs you posts
  a toast and plays Herdr's done or blocked sound (following `sounds` in
  Herdr's settings), unless you're watching it.
- New shells take the lowest free number, like Herdr's tabs, instead of
  counting up forever ("Terminal 37").
- Tested with Herdr 0.1.11 and core 0.1.16. The first opening after the mod
  loads no longer pauses, and the header's tooltips show; both were Herdr
  fixes, so nothing changed in the mod.
- `CONTRIBUTING.md`, issue forms and CI (Node and Python tests, file checks).

## 0.1.0 — 2026-10-31

First release.

- Floating scratch window over any Herdr layout, toggled with
  **Ctrl+Shift+Space**; hiding it keeps shells and their programs running.
- Terminal tabs of its own (up to 12), with agent names, icons, Herdr's
  working spinner and blocked/done dots.
- **Notes**: one autosaved scratchpad shared across all spaces.
- Window sizes: Small (20% × 50%), Normal (50% × 60%), Large (85% × 88%) or
  custom; each size remembers where you dragged it.
- The whole window border marks keyboard focus in your theme's accent color.
- Closing the shown terminal switches to the next tab, or Notes after the last.
- `scripts/install.py` installs or updates the mod and merges `keys.json`
  without replacing your bindings, with backups and `--dry-run`.

Tested on Linux with Herdr 0.1.10 and core 0.1.15. macOS and Windows testers
welcome.
