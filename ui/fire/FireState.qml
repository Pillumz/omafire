import QtQuick
import "fire.js" as Fire
import "wildlife.js" as Wildlife

// One fire: the simulation from fire.js plus the bindable properties the
// popup, the scene, and the bar icon read. Plain QtQuick, no shell imports,
// so tests and captures can build it standalone. FireSession owns the one
// instance the shell uses.
QtObject {
    id: root

    // The popup and wallpaper share one simulation. Background sound remains
    // a separate opt-in; a visible wallpaper does not silently enable audio.
    property bool open: false
    property bool wallpaper: false
    readonly property bool animating: open || wallpaper
    property bool reducedMotion: false
    // Tests turn this off and step with advance().
    property bool autoTick: true

    property var sim: Fire.createState()
    // One visitor for every view, with a separate random stream. Wildlife is
    // ephemeral: no saved animals, overdue visits or background catch-up.
    property var wildlife: Wildlife.create(Date.now())
    // Bumped whenever sim changes; the scene and icon repaint on it.
    property int revision: 0

    property real fuel: sim.fuel
    property real heat: sim.heat
    property real boost: sim.boost
    property string statusText: Fire.status(sim).text
    property string statusKey: Fire.status(sim).key
    property bool statusFilled: Fire.status(sim).filled
    property string toastText: ""
    property bool toastVisible: false
    property bool dragging: false
    property bool sound: false
    // Saved separately from sound: allow ambience while the popup is closed,
    // but never start playback automatically after a shell restart.
    property bool backgroundSound: false
    property bool audioAvailable: true
    readonly property string hint: Fire.HINT

    signal changedByUser()
    // Views share decoded art; a device-scale correction refreshes them all.
    signal backgroundDecoded()

    property real lastWall: Date.now()
    property var audioObject: null

    property int statusIndex: -1

    // Runs at 60 Hz while a scene is visible, allocating nothing on this path.
    function sync() {
        fuel = sim.fuel;
        heat = sim.heat;
        boost = sim.boost;
        // Status text only changes when its state changes.
        var index = Fire.statusIndex(sim);
        if (index !== statusIndex) {
            var st = Fire.status(sim);
            statusIndex = index;
            statusKey = st.key;
            statusText = st.text;
            statusFilled = st.filled;
        }
        if (sim.toastShown && sim.toastText !== toastText) toastText = sim.toastText;
        toastVisible = sim.toastShown;
        dragging = !!sim.drag;
        revision++;
        if (audioObject) {
            audioObject.heat = heat;
            audioObject.boost = boost;
        }
    }

    // Step particles while either view needs them. Long gaps (suspend)
    // still move fuel, heat and boost forward analytically.
    function step() {
        if (!autoTick) return;
        var now = Date.now();
        var dt = (now - lastWall) / 1000;
        lastWall = now;
        if (dt > 0) {
            Fire.tick(sim, dt, animating);
            if (animating) Wildlife.advance(wildlife, dt);
        }
        sync();
    }

    // Test hook: advance by a fixed amount.
    function advance(seconds, particles) {
        var visibleStep = particles === undefined ? animating : particles;
        Fire.tick(sim, seconds, visibleStep);
        if (visibleStep) Wildlife.advance(wildlife, seconds);
        lastWall = Date.now();
        sync();
    }

    function addLog() { step(); Fire.addLog(sim); sync(); if (audioObject) audioObject.playLog(); changedByUser(); }
    function stoke() {
        step();
        var stoked = Fire.stoke(sim) === Fire.MESSAGES.stoke;
        sync();
        if (stoked && audioObject) audioObject.playStoke();
        changedByUser();
    }
    function poke() { step(); Fire.poke(sim); sync(); changedByUser(); }
    function pointerDown(x, y) {
        // Nearby scene clicks startle; buttons and unrelated desktop clicks
        // do not. No fuel changes, sound effects or notification for wildlife.
        if (Wildlife.spook(wildlife, x, y)) { sync(); return "spook"; }
        var r = Fire.pointerDown(sim, x, y);
        sync();
        if (r === "poke") changedByUser();
        return r;
    }
    function pointerMove(x, y) { if (Fire.pointerMove(sim, x, y)) revision++; }
    function pointerUp(x, y) {
        var landed = Fire.pointerUp(sim, x, y);
        sync();
        if (landed && audioObject) audioObject.playLog();
        if (landed) changedByUser();
        return landed;
    }
    function pointerCancel() { Fire.pointerCancel(sim); sync(); }
    function cursorFor(x, y) { return Fire.cursorFor(sim, x, y); }

    function serialize() { return Fire.serialize(sim, Date.now()); }
    function restore(text) {
        var r = Fire.restore(text, Date.now());
        sim = r.state;
        lastWall = Date.now();
        statusIndex = -1;
        sync();
        return r;
    }

    function statusJson() {
        return JSON.stringify({ fuel: sim.fuel, heat: sim.heat, boost: sim.boost, status: Fire.status(sim).label, open: open, wallpaper: wallpaper, sound: sound, backgroundSound: backgroundSound, audioPlaying: audioPlaying });
    }

    // ------------------------------------------------------------------ sound
    // QtMultimedia lives in FireAudio.qml, created on first use, so a missing
    // module only costs the sound: the toast says so and it stays off.
    function toggleSound() {
        if (sound) { sound = false; return; }
        if (!audioObject) {
            var c = Qt.createComponent(Qt.resolvedUrl("FireAudio.qml"));
            if (c.status === Component.Ready) audioObject = c.createObject(root, { heat: heat, boost: boost });
            if (!audioObject || audioObject.failed) {
                if (audioObject) { audioObject.destroy(); audioObject = null; }
                audioAvailable = false;
                Fire.toast(sim, Fire.MESSAGES.soundUnavailable);
                sync();
                return;
            }
            audioObject.failedChanged.connect(function () {
                if (audioObject && audioObject.failed) {
                    root.sound = false;
                    audioAvailable = false;
                    Fire.toast(sim, Fire.MESSAGES.soundUnavailable);
                    sync();
                }
            });
        }
        sound = true;
    }

    readonly property bool audioPlaying: sound && (open || backgroundSound)
    onAudioPlayingChanged: if (audioObject) audioObject.playing = audioPlaying
    onSoundChanged: if (audioObject) audioObject.playing = audioPlaying

    function shutdown() {
        sound = false;
        if (audioObject) { audioObject.stopNow(); audioObject.destroy(); audioObject = null; }
    }

    // One simulation timer, regardless of the number of views.
    property Timer driver: Timer {
        running: root.autoTick
        repeat: true
        interval: root.animating ? 16 : 1000
        onTriggered: root.step()
    }

    onOpenChanged: if (!open) pointerCancel()
    onAnimatingChanged: {
        // Bank the time up to now under the previous mode, then switch.
        var wasAnimating = !animating;
        var now = Date.now();
        var dt = (now - lastWall) / 1000;
        lastWall = now;
        if (dt > 0) Fire.tick(sim, dt, wasAnimating);
        if (!animating) {
            Fire.pointerCancel(sim);
            if (wildlife.fox) Wildlife.advance(wildlife, 2);
        }
        sync();
    }

    Component.onDestruction: shutdown()
}
