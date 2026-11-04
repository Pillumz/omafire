#!/usr/bin/env python3
"""Exercise real global plugin teardown, only in a disposable app-sandbox VM."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = "wesleygrimes.omafire"
PROBE = "omafire-reload-probe"


def command(args, timeout=3):
    start = time.monotonic()
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return {"seconds": round(time.monotonic() - start, 4), "code": p.returncode,
                "out": p.stdout.strip(), "err": p.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"seconds": round(time.monotonic() - start, 4), "code": "timeout"}


def require(result):
    if result["code"] != 0:
        raise RuntimeError(json.dumps(result))
    return result["out"]


def ipc(target, method):
    return command(["omarchy-shell", target, method])


def sandbox_only():
    # APP_SANDBOX alone must not accidentally authorize a live desktop run.
    if os.environ.get("APP_SANDBOX") != "1" or require(command(
            ["systemd-detect-virt", "--vm"])) not in ("qemu", "kvm"):
        raise RuntimeError("Refusing: requires APP_SANDBOX=1 inside its QEMU VM")


def prepare():
    """Explicit fixture setup, including ONE preview restart, before measurements."""
    config = Path.home() / ".config/omarchy"
    target = config / "plugins/test.omafire-reload"
    target.mkdir(parents=True, exist_ok=True)
    for name in ("Probe.qml", "manifest.json"):
        shutil.copy2(ROOT / "tests/reload" / name, target / name)
    path = config / "shell.json"
    data = json.loads(path.read_text())
    data.setdefault("idle", {}).update(screensaver=0, lock=0)
    right = data.setdefault("bar", {}).setdefault("layout", {}).setdefault("right", [])
    if not any(x == "test.omafire-reload" or isinstance(x, dict) and
               x.get("id") == "test.omafire-reload" for x in right):
        right.append({"id": "test.omafire-reload"})
    path.write_text(json.dumps(data))
    # Canonical-name fixture activates the real wallpaper, not a fake scene.
    theme = Path.home() / ".local/state/omarchy/current/theme.name"
    theme.parent.mkdir(parents=True, exist_ok=True)
    theme.write_text("campfire\n")
    require(command(["bash", str(ROOT / "scripts/preview")], timeout=60))
    require(ipc(PLUGIN, "close"))
    state = json.loads(require(ipc(PLUGIN, "status")))
    if state["sound"]:
        require(ipc(PLUGIN, "sound"))
    print("Guest fixture installed; idle disabled, popup closed, sound off. "
          "Run the check separately. Teardown this VM when finished.", flush=True)


class Check:
    def __init__(self, out):
        self.out = out
        out.mkdir(parents=True, exist_ok=False)
        self.log = (out / "samples.jsonl").open("w")
        self.pid = None

    def emit(self, event, **data):
        row = {"event": event, **data}
        line = json.dumps(row, sort_keys=True)
        print(line, flush=True)
        self.log.write(line + "\n")
        self.log.flush()

    def layers(self):
        data = json.loads(require(command(["hyprctl", "-j", "layers"])))
        return [dict(layer, monitor=monitor) for monitor, v in data.items()
                for group in v["levels"].values() for layer in group]

    def stats(self):
        fields = (Path(f"/proc/{self.pid}/stat").read_text().rsplit(")", 1)[1].split())
        if fields[19] != self.starttime:
            raise RuntimeError("Shell PID was reused")
        thread = (Path(f"/proc/{self.pid}/task/{self.pid}/stat").read_text()
                  .rsplit(")", 1)[1].split())
        return {"time": time.monotonic(), "ticks": int(fields[11]) + int(fields[12]),
                "main_ticks": int(thread[11]) + int(thread[12]),
                "rss_mib": int(fields[21]) * os.sysconf("SC_PAGE_SIZE") / 2**20}

    def sample(self, seconds=2):
        before = self.stats()
        time.sleep(seconds)
        after = self.stats()
        dt = after["time"] - before["time"]
        hz = os.sysconf("SC_CLK_TCK")
        return {"cpu_percent": round(100 * (after["ticks"] - before["ticks"]) / hz / dt, 1),
                "main_cpu_percent": round(100 * (after["main_ticks"] - before["main_ticks"]) / hz / dt, 1),
                "rss_mib": round(after["rss_mib"], 1)}

    def healthy(self):
        layers = self.layers()
        for namespace in ("omafire-wallpaper", "omarchy-bar", "omarchy-background"):
            if not any(x["namespace"] == namespace and x["pid"] == self.pid and
                       x["w"] > 0 and x["h"] > 0 and x["alpha"] > 0 for x in layers):
                raise RuntimeError(f"Missing visible {namespace} in original PID")
        # Pin both PID and process start time; a supervisor restart cannot pass.
        self.stats()
        ping = ipc("shell", "ping")
        if require(ping) != "ok":
            raise RuntimeError("Shell ping did not return ok")
        status_call = ipc(PLUGIN, "status")
        state = json.loads(require(status_call))
        if state["open"] or state["sound"] or state["audioPlaying"] or not state["wallpaper"]:
            raise RuntimeError(f"Wrong fixture state: {state}")
        return {"ping": ping, "status_call": status_call, "state": state}

    def capture(self, name):
        self.emit("capture", name=name, result=command(["grim", str(self.out / f"{name}.png")]))

    def run(self, count):
        layers = self.layers()
        pids = {x["pid"] for x in layers if x["namespace"] == "omarchy-bar"}
        if len(pids) != 1:
            raise RuntimeError(f"Expected one real shell, got bar PIDs {pids}")
        self.pid = pids.pop()
        self.starttime = Path(f"/proc/{self.pid}/stat").read_text().rsplit(")", 1)[1].split()[19]
        installed = Path.home() / ".config/omarchy/plugins" / PLUGIN / "ui/fire/FireScene.qml"
        sources = [ROOT / "ui/fire/FireScene.qml", installed,
                   Path("/usr/share/omarchy/shell/shell.qml")]
        if sources[0].read_bytes() != installed.read_bytes():
            raise RuntimeError("Installed FireScene differs from checkout; run --prepare first")
        self.emit("environment", pid=self.pid, starttime=self.starttime,
                  cmdline=Path(f"/proc/{self.pid}/cmdline").read_bytes().replace(b"\0", b" ").decode(),
                  hashes={str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources},
                  versions=command(["pacman", "-Q", "qt6-declarative", "quickshell"]),
                  count=count)
        generation = require(ipc(PROBE, "generation"))
        self.emit("baseline_state", generation=generation, **self.healthy())
        baseline = []
        for i in range(4):
            sample = self.sample()
            baseline.append(sample)
            self.emit("baseline", sample=i, **sample, **self.healthy())
        # Rendering is legitimate load. Only sustained near-full MAIN-thread
        # usage substantially above the measured baseline signals starvation.
        guard = max(90, max(x["main_cpu_percent"] for x in baseline) + 30)
        if guard > 100:
            raise RuntimeError("Baseline already too busy for a meaningful starvation check")
        self.emit("guard", main_cpu_percent=guard,
                  baseline_main_median=statistics.median(x["main_cpu_percent"] for x in baseline))
        self.capture("baseline")
        for n in range(1, count + 1):
            start = time.monotonic()
            request = ipc("shell", "rescanPlugins")
            self.emit("reload_request", reload=n, result=request)
            require(request)
            # A successful request is NOT completion. Wait for reconstruction
            # of an independent real bar widget, then the actual wallpaper and IPC.
            deadline = time.monotonic() + 15
            while True:
                result = ipc(PROBE, "generation")
                if result["code"] == "timeout":
                    self.emit("timeout_cpu", reload=n, **self.sample())
                    raise RuntimeError("IPC timeout awaiting bar reconstruction")
                if result["code"] == 0 and result["out"] != generation:
                    generation = result["out"]
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError("Bar reconstruction did not complete within 15s")
                time.sleep(0.1)
            self.emit("reconstructed", reload=n, generation=generation,
                      seconds=round(time.monotonic() - start, 4), **self.healthy())
            hot = 0
            for window in range(3):
                sample = self.sample()
                hot = hot + 1 if sample["main_cpu_percent"] >= guard else 0
                self.emit("settle", reload=n, window=window, **sample)
                # Always retain CPU evidence before requiring responsive IPC.
                health = self.healthy()
                self.emit("responsive", reload=n, **health)
            if hot == 3:
                raise RuntimeError("Sustained near-full-core starvation versus baseline (6s)")
            self.emit("reload_complete", reload=n, seconds=round(time.monotonic() - start, 4))
        self.capture("after")
        self.emit("pass", pid=self.pid, completed=count)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true", help="install guest-only fixture; restarts shell BEFORE checking")
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--out", type=Path, default=ROOT / "tests/out" / ("reload-" + time.strftime("%Y%m%d-%H%M%S")))
    args = parser.parse_args()
    sandbox_only()
    if args.prepare:
        prepare()
        return 0
    if args.count < 1:
        parser.error("--count must be positive")
    check = Check(args.out)
    try:
        check.run(args.count)
        return 0
    except Exception as error:
        check.emit("fail", pid=check.pid, error=str(error))
        if check.pid:
            check.capture("failure")
            check.emit("failure_ping", result=ipc("shell", "ping"))
            try:
                for window in range(3):
                    check.emit("failure_cpu", window=window, **check.sample())
            except (OSError, RuntimeError) as stats_error:
                check.emit("failure_stats", error=str(stats_error))
            log = command(["quickshell", "log", "--pid", str(check.pid), "--no-color", "-t", "100"])
            (args.out / "shell-log.json").write_text(json.dumps(log, indent=2))
        return 1
    finally:
        check.log.close()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
