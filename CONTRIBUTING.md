# Contributing

OmaFire is a tiny campfire, and it stays tiny on purpose. Bugs and small ideas
are welcome. Big features probably belong in their own plugin.

For vulnerabilities, follow [SECURITY.md](SECURITY.md).

## Questions and ideas

Ask questions and float ideas in
[Discussions](https://github.com/wesleygrimes/omafire/discussions). Issues are
for bugs and concrete feature requests.

## Issues

Use the [bug report](https://github.com/wesleygrimes/omafire/issues/new?template=bug_report.yml)
or [feature request](https://github.com/wesleygrimes/omafire/issues/new?template=feature_request.yml)
form. For anything visual, a screenshot saves a lot of back and forth.

## Pull requests

Anyone can open a pull request. For anything bigger than a small fix, open an
issue first so we can agree on the approach before you write the code.

## Labels

| Label | Use |
| --- | --- |
| `bug` | Existing behavior is broken. |
| `enhancement` | New capability or improvement. |
| `documentation` | Docs work; supplements bug or enhancement. |
| `accessibility` | Keyboard, focus, contrast or screen reader problems. |
| `approved` | A maintainer agreed to the approach. PRs are welcome. |
| `needs-author` | Waiting on information or changes from the author. |
| `blocked` | Waiting on another issue or an upstream change. |
| `help wanted` | Open for anyone to pick up. |
| `good first issue` | Small, scoped, and a good start. |
| `duplicate` | Already tracked; link the original when closing. |
| `wontfix` | Out of scope; say why when closing. |

## Develop

You need an Omarchy desktop. Install your fork as the plugin, and restart the
shell after each change, since hot reload doesn't pick up OmaFire's QML:

```sh
omarchy plugin add https://github.com/<you>/omafire --enable
mise run test
```

`mise run test` runs the standard suite: the fire math, a Chromium comparison against
the reference art, offscreen QML tests and, on a live desktop, a Quickshell
integration test and `omarchy plugin validate`. Tests that need a missing tool
skip and say so. CI runs the same command. For Canvas allocation/lifetime
changes, also run the [real same-process reload check](docs/RELOADS.md) in a
disposable VM; fresh launches and popup-only tests do not cover global reloads.

### Isolated desktop preview

From your task checkout on a host with `app-sandbox`:

```sh
app-sandbox up --size half
app-sandbox exec -- bash scripts/preview
app-sandbox shot --desktop
herd-test --no-pg app-sandbox exec -- node --test --test-concurrency=1 'tests/*.test.js'
app-sandbox down
```

The preview installs the actual plugin into the guest's running Omarchy shell;
it refuses to run on the host. The guest needs Quickshell, Qt Quick/Qt Test,
`qt6-imageformats`, `qt6-multimedia`, Node 22+, Chromium and ImageMagick.
For desktop verification, install the unmodified theme inside the guest:

```sh
app-sandbox exec -- omarchy theme install https://github.com/piermark/omarchy-campfire-theme
```

Its canonical name must be `campfire`; no marker file is needed. Do not run the
theme\'s optional video helper.

For audio verification without physical speakers, create a guest-only sink:

```sh
app-sandbox exec -- pactl load-module module-null-sink sink_name=omafire_test
app-sandbox exec -- pactl set-default-sink omafire_test
```

Turn sound and **Keep sound when closed** on, close the popup, and check
`omarchy-shell wesleygrimes.omafire status` and the guest sink's monitor.
Verify that **Sound off** silences it, disabling background sound restores
close-to-mute behavior, and restarting the guest shell restores both sound choices and resumes enabled
background ambience. Also verify that explicitly turning sound off survives a restart. The popup should still stop animating while closed. With Campfire selected,
the desktop keeps animating from the same fire. Verify a successful desktop log
drop increases fuel, an off-target drop does not, and switching away from the
theme removes the live layer. Check the woodpile and fire at more than one
screen shape: 3:2, 16:9 and 2:1 should retain the full original campsite over
the static extended scenery. Taller and wider outputs use centered cropping.
Check log drops and nearby fox clicks after resizing, and verify clicks in the
extended sides do not open the still-wallpaper picker. The popup stays 3:2.

For a repeatable wildlife art/interaction preview, launch the full-width
wallpaper scene and original popup with a shared fire and visitor:

```sh
app-sandbox launch -- bash scripts/preview-fox
```

The preview-only toolbar can replay a seeded visit immediately, choose the
next fox, inspect listening/sniffing/resting/turning, startle it, pause/resume,
step one frame, or switch to quarter-speed playback.
Not every visit includes every pose (a passing fox need not sit). IPC `seed(n)`
selects a repeatable visit: 1 lingers from the rocks, 2 crosses from the rocks
to the left trail, 6 enters from the right trail, 7 leaves behind the rocks,
and 8 forages from the left. Check the entire fox crosses the old central
scene edges and is fully hidden when a rock entrance or departure finishes.
`pose(name)` finds the first occurrence; `inspectAt(seconds)` freezes any time.
Click near the fox in either scene to exercise real input. Production has no extra buttons or forced
visits.

For a repeatable motion capture, create a guest directory, then call the
fixture's `record(directory, seconds, spookAt)` IPC method. `spookAt = -1`
records an undisturbed visit; a nonnegative value clicks near the fox at that
visit time. To record from an inspected pose instead of restarting the visit, use
`recordCurrent(directory, seconds, spookAt)`. For example, on seed 1 use
`pose("sit")` and then `recordCurrent(directory, 3.5, 0.4)` to record a nearby
click 0.4 seconds into the seated rest. `step(0.05)` advances one paused frame;
`slow(0.25)` selects quarter speed, and `resume()` starts playback. Playback
advances simulation time, not wall time, so a slow VM does not dismiss the visit.
Frames are numbered PNGs at 20 fps, captured from the actual scene. `recording()` reports completion.
Select the fixture with `qs ipc -p /tmp/omafire-fox.*/shell.qml`; use
`app-sandbox fetch` to export the resulting images or an encoded video. The
capture size follows the guest device scale, so inspect its actual dimensions
before cropping.

Keep these rules from [docs/NOTES.md](docs/NOTES.md):

- No network, no web view, no extra background process. Wallpaper mode is an
  in-process shell service plugin, not a systemd service.
- Don't edit `assets/campsite-approved.webp`. The tests check its hash.
- Rendering changes need before and after screenshots in the PR.

## Commits and pull requests

One change per pull request. PRs are squash-merged and the PR title becomes the
commit message, so write it as a
[conventional commit](https://www.conventionalcommits.org/en/v1.0.0/):

```text
<type>(optional-scope): <description>
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
`chore`, `style`, `revert`. Use a lowercase type, an imperative description,
and no trailing period:

```text
fix: keep the ember glow at 2x scale
feat: drag a second log onto the fire
docs: explain the optional sound package
```

In the PR body, say what changed and how you checked it.

## Contributors

The README credits contributors with [all-contributors](https://allcontributors.org).
To add someone, comment on their pull request or issue:

```text
@all-contributors please add @username for code
```

Pick the contribution type from the
[emoji key](https://allcontributors.org/docs/en/emoji-key), such as `code`,
`doc`, `bug`, or `ideas`. The bot opens a pull request that updates the table.

## Conduct

Be kind and treat people well.
