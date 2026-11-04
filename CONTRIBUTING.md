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

`mise run test` runs everything: the fire math, a Chromium comparison against
the reference art, offscreen QML tests and, on a live desktop, a Quickshell
integration test and `omarchy plugin validate`. Tests that need a missing tool
skip and say so. CI runs the same command.

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
For audio verification without physical speakers, create a guest-only sink:

```sh
app-sandbox exec -- pactl load-module module-null-sink sink_name=omafire_test
app-sandbox exec -- pactl set-default-sink omafire_test
```

Turn sound and **Keep sound when closed** on, close the popup, and check
`omarchy-shell wesleygrimes.omafire status` and the guest sink's monitor.
Verify that **Sound off** silences it, disabling background sound restores
close-to-mute behavior, and restarting the guest shell keeps the preference
but starts muted. The popup should still stop animating while closed. With an enabled wallpaper theme,
the desktop keeps animating from the same fire. Verify a successful desktop log
drop increases fuel, an off-target drop does not, and switching away from the
theme removes the live layer. Check the woodpile and fire at more than one
screen shape; the desktop uses aspect-preserving center crop.

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
