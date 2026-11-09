# Validation

## Pending commands and blocked input, 2026-11-09

Checked on Linux with Herdr app 0.1.14 and core 0.1.19. The current source
passes 84 Node tests, 8 installer tests and `herdr-app check` for both mods.

An isolated Xvfb app used the exact mod source and a private `hc` wrapper
that held a Float terminal spawn before it ran. Before the fix, the normal
new-tab button worked before the hold but stopped responding while the
command was pending. Ctrl+Shift+Space could not hide Float during that wait.
The app's renderer treats width/height <= 1 as viewport fractions, so the
supposed 1-pixel command windows actually covered the viewport. Commands
also waited behind the in-flight command lease, including Hide.

After switching control windows to 2-by-2 logical pixels at the top left,
the same held-spawn test verified clicks on the background button and
clicking/typing in its terminal. In separate runs, both the hide button and
Ctrl+Shift+Space hid Float before the spawn was released. Once released,
the shell was adopted, all command overlays closed and Float stayed hidden.
The test app, private core and display were stopped afterwards.

Regression tests also cover hiding during first-show queries, agent-toast
ownership checks, reconciliation and stale-window toggles. Their delayed
results cannot mount another window after dismissal. The regular native
focus/shortcut checks, directory-swap reloads and hide/reopen cycles passed.
This reproduces a specific input-blocking path; the user's intermittent
Wayland case still needs a confirmation with the installed fix.

## Focus on Herdr 0.1.14, 2026-11-09

Checked on Linux with Herdr app 0.1.14 and core 0.1.19:

- 76 Node tests and 8 installer tests pass, plus `herdr-app check` for both
  `float-space` and `float-space-new`.
- Ten view-level focus regressions cover returning to the original pane,
  tracking the shown terminal only, stale Notes focus, native changes that
  don't redraw the header, and border copies recreated after hot reload.
  A stopped copy's focus promise can't block publication, and unchanged
  timer ticks don't publish or request redraws.
- In a disposable app home, core session and Xvfb display, native mouse and
  keyboard input plus app commands exercised header → pane → Float terminal
  → original pane, Notes focus and blur, leaving/returning to the app, and
  hiding the window. The border followed focus throughout; a shell marker
  confirmed typing after `pane.focus` reached the background pane.
- Screenshots were inspected for the terminal, Notes and inactive window.
  The sandbox ended with no mod errors and no overlays; its app, core and
  display were stopped afterwards.

The first pass observed computed focus via a shared-state probe and used
`pane.focus` to return to the pane. It didn't establish every mouse-focus
transition or border repaint. An uninstrumented check with the persistent
launcher reproduced a missed header redraw, so a 150 ms check of actual
focus is retained. The click-position guess is not.

The user then reproduced the problem on their running KDE Wayland desktop.
A temporary trace showed that `focused()` correctly reported the Float
terminal and the pane on successive clicks, but edge blocks retained their
old colors after the header's cached and drawn state changed. The borders
had waited on a promise shared across copies, including stopped copies.
They now read one boolean, `float-space.focus.v1`, published with Herdr's
shared-state API so the host refreshes every block. Only focus transitions
publish; there are no extra writes for unchanged timer ticks. The temporary
trace code was removed after diagnosis.

Further Xvfb checks use the exact source files, without instrumentation or
probe writes, and inspect all four border edges through repeated clicks,
Notes-to-pane changes and directory-swap hot reloads. Xvfb covers the X11
path; it doesn't substitute for the user's Wayland interaction.

The user confirmed the focus border behaves correctly on their desktop,
then reported that Ctrl+Shift+T inside the Float terminal created a tab in
the workspace behind it. Herdr 0.1.14 gives floating terminals the Terminal
key context, so a `mod:float-space` binding doesn't reach them.

The terminal binding now opens `float-space-new`, which checks actual focus
and ownership without depending on which tab has finished remounting. If a
newly focused terminal is not in the live cache yet, core confirms its labels.
The routing copy stays alive until Float acknowledges
that its new terminal has been created and mounted. Closing the receiver
right after dispatch was found to leave a newly spawned shell unadopted;
the acknowledgement is covered by both a regression test and native input.

With real key events in the isolated Xvfb app, Ctrl+Shift+T twice in the Float
terminal added two owned terminals and no workspace tab. The new addresses
appeared in Float's saved tab list, and no command overlays remained. From
a workspace pane, with Float hidden, and in a layout without any Float copy,
the same key added a normal tab and left the Float terminal count unchanged.
Installer checks cover fresh install, upgrade from the old single-mod
package, custom-key conflicts and rollback of both mods on a key-save error.

This does not establish everyday keyboard feel on the user's desktop, or
macOS/Windows behavior. Earlier checks below refer to their stated versions.

Checked on 2026-10-31 with Herdr app 0.1.10, core 0.1.15, and re-checked on
2026-11-01 with Herdr app 0.1.11, core 0.1.16 (see "Herdr 0.1.11"), on Linux
(KDE Wayland), in the shipped `main` layout. This records technical checks;
day-to-day comfort is for the person using it to judge.

## Automated checks

- `npm test`: 56 passing lifecycle and state tests (2026-11-04).
- `python3 -m unittest discover -s tests -p 'test_*.py'`: 4 passing installer tests.
- `herdr-app check mods/float-space`: passes (0.1.10 and 0.1.11).
- CI runs the first two on every push and pull request (Node 22 and 24,
  Python 3.10 and 3.13), plus JSON and installer file-list checks.

The lifecycle tests cover reusing hidden terminals, recovery into a fresh
controller, refusing to end a terminal whose ownership core no longer
confirms, notes edited while core replies, spawn failures, failed or empty
core queries, warm reopening without a core query, no-op reconciliation
without writes, focus returning after a space change, Herdr closing the
window when its terminal ends (with a lagging and an up-to-date snapshot, the
last terminal, and a press that reopens the window meanwhile), layout changes,
closes from replaced or hidden windows, one window key per size, and the
presets. The installer tests cover shortcut conflicts, repeat installs and
refusing to overwrite edited or extra installed files.

## Running app, current build

Checked with the app CLI (`herdr-app do`, `status`, `shot`), `hc` and the
journal, without synthetic mouse or keyboard input. Commands other than the
shortcut (Notes, new, select, resize) were sent through a temporary hook in
the installed copy that was removed afterwards; the installed files then
matched the installer's record again.

| Check | Result |
| --- | --- |
| Shortcut toggles (`mod.open:float-space`): 6, then 5 and 4 across two hot reloads, then 6 more | All correct, no command copies left over; the new state was already reported at the first poll (0.07 s) |
| An earlier design ran commands through a promise queue shared by copies | After a hot reload the journal showed `error in a promise continuation: interrupted` and toggles lagged one press; replaced by one copy per command and a lease |
| `hc kill` of the shown terminal, before the fix | Herdr closed the window while `terminals()` still listed the terminal as live; the window stayed closed |
| Handing that check from the header's `close()` to a new command copy | The copy hung on its first `hc` call and ran only after the next reload |
| Asking core inside the header's `close()`, twice | Reopened on the next tab 14–15 ms after the close |
| Window border drawn by the mod's own blocks (header top, 1px sides, 10px bottom band) | Continuous all the way round, corners included; `accent` `(97,175,239)` right after opening, `input` `(64,68,73)` on all four sides after `pane.focus` moved the keyboard to a pane outside |
| Border redraw, 3 rounds: `pane.focus` to a pane outside, then hide and show; screenshots about 0.1 s apart | All four sides always the same color; `input` within 0.09–0.14 s (through the 150 ms check), `accent` on showing |
| Earlier border redraws | Polling in each block: the person saw the sides change before the header. Calling the edge views' `cx.notify()` from the header: header `input`, sides still `accent` 0.4 s later, all `input` after about 1.4 s |
| The person clicking into the window's terminal and out to a pane, several times | Border changed at once, all sides together |
| Header | Notes icon and label, divider, terminal tabs with program icons |
| Notes | Terminal font from settings (JetBrains Mono 14) |
| Size popup | Three presets; the current size outlined |
| A former 32 × 90 preset with a single window key | Reopened at the remembered spot (424, 353) and ran about 210 px past the app's bottom edge |
| 32 × 90 and 50 × 60 with one key per size | Each opened centered; 32 × 90 at about (870, 71), inside the app |
| Focus, traced while the person clicked into the window's terminal, then a pane outside, and typed | `focused()` kept naming the pane underneath after the click into the window, so focus stayed unmarked while typing went into the window; outside, typing reached the pane. The header now decides from presses (`on_mouse_down_out`) |
| `terminal_menu` set on the window's layout, the person right-clicking its terminal | Ignored: Herdr's own pane menu showed; removed again |
| Installed with `scripts/install.py --update`, no layout file | No mod errors in `herdr-app status` |

Not checked with real input in this build: closing the shown tab with ×
since it shows the next tab before ending the terminal, clicking a header
tab from a pane outside, clicking Notes, presets, ×, dragging the window,
and typing into Notes. The size button a second time was checked with real
input on 0.1.11, below. A
core reply slower than the 250 ms Herdr gives `close()` would leave the
window closed until the next press.

## Herdr 0.1.11

Herdr 0.1.11 fixed three things this file had left open: the window freezing
while mods run, popups stacking when opened again, and mod tooltips in
embedded windows. Re-checked on 2026-11-01 with core 0.1.16, the mod files
unchanged from 0.1.0. The last two used real mouse events (a temporary
uinput pointer outside this repository) with the window at Small (20 × 50).

| Check | Result |
| --- | --- |
| First opening after a hot reload (a comment appended to the installed `main.js`, then the original restored), 11 times with Herdr on screen and every screenshot a new frame | The window was in the first screenshot each time (0.13–0.34 s after the command); `status` reported it after 0.04–0.27 s and answered within 0.04 s throughout, so the main thread stayed free. Warm openings: same first screenshot |
| The same, 8 earlier tries in that session | Not counted: the detector only looked where the Large window's header sits, and the window had meanwhile been set to Small and moved |
| Hovering the size, Notes and Hide buttons for 1.6 s | Tooltips shown: "Window size", "Notes shared across your spaces", "Hide · Ctrl+Shift+Space" |
| Clicking the size button, then clicking it again | First click opened the popup (`status` overlays `layout`, `float-space`); the second closed it (`layout` only), with no second popup and the size left at Small |

Not re-checked on 0.1.11: an opening right after the app starts, which
needs restarting Herdr.

### Agent alerts (unreleased)

| Check | Result |
| --- | --- |
| A probe terminal outside every space (`hc run --no-parent`) reporting OSC 7501 working, then done or idle, with Herdr on screen | No toast from Herdr, so Float Space's own alerts don't double Herdr's |
| A probe with Float Space's labels reporting working for 4 s, then idle, while the window showed another tab | Adopted as tab "Terminal 1" (shown as "fsprobe"), then a toast "fsprobe finished · In Float Space"; `status` overlays `layout`, `toast` |

Not checked: the sound itself (no audio capture), alerts while Herdr isn't
the active app, and blocked or error reports.

### Retry, clickable alerts and shortcuts (2026-11-02)

Tested with the installed Herdr 0.1.11 and core 0.1.16 in an isolated Xvfb
display, app home and core session. Mouse/key events were sent only to that
display. Probe programs reported OSC 7501 states; no real agents or user
terminals were used. Screenshots were inspected.

| Check | Result |
| --- | --- |
| Failed reconciliation, unchanged live snapshot, then a successful query | Unit test: the same mismatch is eligible again; new tabs appear and Notes survive |
| Successful query against a lagging snapshot, then ten checks | Unit test: only one query; catching up clears the acknowledgement, and later mismatches are eligible again |
| Snapshot changes while core answers | Unit test: the new snapshot remains eligible |
| Ctrl+Shift+T from Notes after typing, before its debounce finishes | One Float Space shell created; text saved before switching |
| Ctrl+Tab / Ctrl+Shift+Tab from the header and Notes | Wrap through Notes and terminal tabs in header order |
| Open Notes, then type without clicking its editor | Text reaches Notes |
| Ctrl+Shift+T after clicking the workspace outside Float Space | Creates a normal Herdr tab; Float Space's tab count stays unchanged |
| Two agents finish while another page is shown; hide Float Space, then click each native toast | Each toast opens its own terminal, including after hiding; both temporary receivers are cleaned up |
| Blocked agent alert, hide Float Space, end that probe, click its toast | Reports that the terminal is no longer running; no window reopened and no shell created |
| An unclicked toast expires | Its receiver also disappears |
| Initial toast implementation forwarded a click to a new command copy and immediately closed its receiver | The new copy stalled on its first `hc` call; changed to finish the reveal inside the receiver before closing it |

The four new shortcuts are scoped to `mod:float-space`, so they apply to
the header and Notes. Herdr 0.1.11 gives embedded terminals the general
`Terminal` key context; their existing terminal/workspace shortcuts remain.
These checks do not establish shortcut support inside an embedded terminal,
macOS/Windows compatibility, or sound playback.

### Status-bar dot and alerts while hidden (2026-11-04)

Tested in an isolated Xvfb display (no window manager), app home and core
session, with sounds off (`HERDR_APP_NO_SOUND`). The layout was a clone of
`main` with the button beside the status bar, as in the README. Probes
reported OSC 7501 states (`app=codex`); no real agents or user terminals
were used. Pointer clicks went to that display only. The dot was read from
screenshots, and on 0.1.12 also from a temporary trace in the sandbox copy
(removed with the sandbox).

Current build, Herdr 0.1.13 and core 0.1.18:

| Check | Result |
| --- | --- |
| Probe working, Float Space never opened | No dot |
| Probe blocked while hidden | Herdr's toast "Codex needs you" (error dot, no body), no dot on the button |
| Probe working → idle while hidden | Herdr's toast "Codex finished" (info dot, no body), yellow dot (`working`) at the icon's top right, not clipped, ringed in `chrome` |
| Open Float Space on that tab, Herdr active | Dot gone within 1.5 s |
| Two probes report working, then done, one on the shown tab, one on the other | Shown tab: no dot. Other tab: Herdr's blue done dot, button yellow |
| Click that other tab, both probes still reporting done | No dot on either tab, none on the button |

An earlier design of the same watcher (a dot for every status, Herdr 0.1.12):

| Check | Result |
| --- | --- |
| Finish with Herdr not the active window, then opened on that tab | Stays lit while inactive; gone within 1 s of Herdr getting focus |
| A second probe finishes while the first tab shows; click its tab | Dot clears |
| A probe the window hadn't adopted yet finishes while hidden | Toast named "Codex" (was "An agent"); clicking it opens that tab and clears the dot |

Not checked: the real KDE Wayland session, the light theme's colors, sound
playback, and a layout without the button (alerts then stop while hidden,
as before).

## Named notes and file storage (2026-11-07)

Checked on Herdr app 0.1.13 with core 0.1.18 in a throwaway app (its own
`HERDR_APP_HOME`, `HC_SESSION` and an Xvfb display, so no input reached the
real desktop), with `xdotool` input and screenshots, in the shipped `main`
layout.

| Check | Result |
| --- | --- |
| Start with an earlier version's Notes page in `shared.json` | Shown as the note "Notes"; `notes.json` created with it, then `notes` gone from `float-space.v1` |
| Chevron, New note, type a name, Enter | Menu closed, the new empty note shown with the keyboard in it, its name in the tab |
| Pick another note from the menu, also while a terminal tab shows | Notes page with that note; typing went into it |
| Rename with the pencil; delete a note with text | Name saved, menu stayed open; "Delete this note?" asked first |
| Add notes with ↓ and Enter until five | Ids `n3`–`n6` (the deleted `n2` not reused); New note dimmed, "5 of 5" |
| Delete the shown note, confirming with Enter | The one before it shown; menu stayed open |
| Type, then hide within 400 ms | The text was in `notes.json` |
| Edit `notes.json` while hidden, show, type | The edit shown, typing added on top, no warning |
| Edit `notes.json` while Notes is open, then type | The notes shown in Float Space saved over it; a "Float Space" warning toast |
| Restart the app | Tab name and text read back from the file |
| Start with a file that isn't JSON | Notes showed why and the path; the file was left as it was; restoring it brought Notes back within 2 s without reopening |
| Ctrl+Tab and Ctrl+Shift+N; Ctrl+Tab with the menu open | Worked; ignored while the menu was open |
| Small preset | 25 × 50; the header fits |

Not checked: the real desktop session, macOS and Windows, and a save that
fails for a reason other than an outside edit (a full disk, permissions).

## Earlier builds, with real input

These used real mouse and keyboard events (through a temporary Linux input
device outside this repository) on earlier builds with the same terminal
and Notes handling but a different header, a split Notes view and a
confirmation before ending a terminal:

| Check | Result |
| --- | --- |
| Type multiline notes into the textarea | Saved in shared state; kept across tab switches, hiding and a hot reload |
| Click the terminal, type and run a shell command | Output read back from core |
| Toggle with the real Ctrl+Shift+Space, from the window and from the workspace | Passed |
| Hide, reopen and change spaces | Same terminal address and process PID |
| Type after hiding | Went to the workspace's shell, not the scratch shell |
| Type right after opening, before clicking the terminal | Stayed in the window's chrome; nothing reached either shell |
| Unload the mod by switching layouts, then come back | Same terminal PID and notes |
| Drag the width and height sliders, Escape, Apply | Drafts didn't resize the terminal; Escape kept the size; Apply saved it |

Hide and show took 42–195 ms once warm (command to state change, through the
CLI). On Herdr 0.1.10 the first opening after the mod loads took up to about
3 s while the app's main thread was busy; on 0.1.11 it no longer did (see
above). Herdr also rebuilds the terminal view whenever the window is
replaced.

## Host limits observed

- `pane.focus {terminal}` doesn't search overlay terminals in Herdr 0.1.10
  and shows a failed-command notification, so the window focuses its own
  header and a click focuses the terminal.
- Layout dividers and window edges can't be dragged in an overlay, and mods
  have no resize call; the size popup applies a size once.
- The command palette is a fixed list (Herdr's own commands and layouts);
  mods can't add entries.

Not tested: macOS, Windows, remote machines, a machine reboot or a core
crash. Reboot behavior is from Herdr's documentation of `--keep`.
