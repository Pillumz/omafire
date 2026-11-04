# Same-process Omarchy reload regression

This opt-in check exercises the **real installed plugin in the real Omarchy
shell**, including global plugin teardown. It is intentionally separate from
`mise run test`: ordinary tests must not reconfigure a desktop. It refuses to
run without `APP_SANDBOX=1` inside a QEMU/KVM VM.

From a task worktree on a host with `app-sandbox` and `herd-test`:

```sh
app-sandbox up --size half
herd-test --no-pg app-sandbox exec -- python scripts/check-reloads.py --prepare
herd-test --no-pg app-sandbox exec -- python scripts/check-reloads.py --count 20
# Export the printed output directory's files before teardown, e.g.:
app-sandbox fetch /home/omarchy/project/tests/out/reload-TIMESTAMP/samples.jsonl
app-sandbox fetch /home/omarchy/project/tests/out/reload-TIMESTAMP/baseline.png
app-sandbox fetch /home/omarchy/project/tests/out/reload-TIMESTAMP/after.png
app-sandbox down
```

`--prepare` installs the actual plugin using `scripts/preview`, installs a tiny
independent bar-widget reload witness, sets the canonical `theme.name=campfire`
fixture, disables guest idle screensaver/lock, closes the popup and turns sound
off. It uses the VM's existing appearance; it does not download or change the
Campfire theme. **Setup restarts the guest shell once, before measurement.**
These disposable guest configuration changes are removed by VM teardown; do not
reuse this VM as a personal desktop. Dependencies are those of `scripts/preview`,
plus Python 3, `systemd-detect-virt`, `hyprctl` and `grim` (sandbox image tools).
No owner credentials or settings directories are copied by this check.

The check itself never restarts the shell. It pins the bar's PID and `/proc`
start time, records installed/source hashes and versions, samples an eight-second
baseline, and makes serial `shell rescanPlugins` requests. A request returning
success is **not** counted as completion: a new public-IPC generation from the
independent real bar widget must appear within 15 seconds. Actual visible
wallpaper/bar/background layers and OmaFire status must then recover in the
original PID, with wallpaper active, popup closed and audio off.

Each reload has three two-second CPU/RSS samples and responsive shell/plugin
IPC checks. Sustained main-thread CPU above both 90% of one core and 30 percentage
points over the busiest baseline sample fails. Ordinary animated rendering is
not required to fall under a brittle low CPU threshold. A baseline too busy to
make this comparison refuses the run. IPC commands have a three-second timeout;
there are no retries that restart the shell, GC overrides, private accounting
reads/writes, or forced collection. All waits are bounded. Screenshots supplement
layer/status checks: inspect baseline and final images for real scene and bar
recovery; layer presence alone does not prove painted pixels.

`--out PATH` chooses a **new** artifact directory. JSONL records include request,
reconstruction and ping latency, process/main-thread CPU, RSS, PID and outcome.
Failures also capture a screenshot, bounded IPC/CPU followup and recent shell
logs. A stalled reload may recover slowly later; failure does not imply deadlock.

For before/after validation, first run the old checkout and export its failure
artifacts. Apply the fix, run `--prepare` explicitly again to start a fresh
accounting lifetime, then run at least 20 reloads. Both measured runs must each
retain their own PID throughout; a single PID across **both code variants** is
not claimed. The witness and software-rendering VM can affect exact reload
counts and RSS, so this is a lifecycle regression check, not a hardware benchmark
or proof that all Qt versions are affected. If the VM shell lacks the global
unload/rebuild lifecycle, investigate/report that mismatch rather than replacing
it with a mock or changing production shell source.
