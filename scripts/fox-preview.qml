import QtQuick
import Quickshell
import Quickshell.Io
import "ui/fire"
import "ui/fire/wildlife.js" as Wildlife

// Sandbox-only art/interaction fixture. Both are real production components
// reading one FireState. No preview controls or forced visits ship in the UI.
ShellRoot {
    id: root
    FireState { id: fire; open: true; autoTick: false }

    property bool playing: false
    property real playbackRate: 1
    property int visitSeed: 1
    Timer {
        interval: 50; repeat: true; running: root.playing && !recorder.running
        onTriggered: fire.advance(0.05 * root.playbackRate, true)
    }
    function resetVisit() {
        fire.wildlife = Wildlife.create(visitSeed);
        Wildlife.startVisit(fire.wildlife);
    }
    function inspectPose(pose) {
        root.playing = false;
        resetVisit();
        for (var i = 0; i < 10800 && fire.wildlife.fox && fire.wildlife.fox.pose !== pose; i++)
            Wildlife.advance(fire.wildlife, 1 / 60);
        fire.sync();
    }
    function inspectAt(seconds) {
        root.playing = false;
        resetVisit();
        for (var i = 0; i < Math.round(seconds * 60); i++) fire.advance(1 / 60, true);
        fire.sync();
    }
    function play() {
        resetVisit();
        root.playing = true;
        fire.sync();
    }

    FloatingWindow {
        id: window
        title: "OmaFire — fox preview"
        implicitWidth: 1350
        implicitHeight: 578
        color: "#101820"

        Flow {
            x: 12; y: 8; width: window.width - 24; spacing: 8
            Repeater {
                model: ["Play visit", "Next fox", "Listen", "Sniff", "Rest", "Turn", "Spook", "Pause / resume", "Step frame", "Slow / normal"]
                Rectangle {
                    required property string modelData
                    width: label.implicitWidth + 24; height: 28
                    color: hover.containsMouse ? "#39434c" : "#26303a"
                    Text { id: label; anchors.centerIn: parent; text: modelData; color: "#dfd9cc"; font.pixelSize: 13 }
                    MouseArea {
                        id: hover; anchors.fill: parent; hoverEnabled: true
                        onClicked: {
                            if (modelData === "Play visit") root.play();
                            else if (modelData === "Next fox") { root.visitSeed++; root.play(); }
                            else if (modelData === "Listen") root.inspectPose("idle");
                            else if (modelData === "Sniff") root.inspectPose("sniff");
                            else if (modelData === "Rest") root.inspectPose("sit");
                            else if (modelData === "Turn") root.inspectPose("turn");
                            else if (modelData === "Spook" && fire.wildlife.fox) { fire.pointerDown(fire.wildlife.fox.x, fire.wildlife.fox.y - 12); root.playing = true; }
                            else if (modelData === "Step frame") { root.playing = false; fire.advance(0.05, true); }
                            else if (modelData === "Slow / normal") root.playbackRate = root.playbackRate === 1 ? 0.25 : 1;
                            else root.playing = !root.playing;
                        }
                    }
                }
            }
        }
        FireScene {
            id: scene; x: 0; y: 82
            width: Math.min(960, window.width - 390); height: width / 2
            wide: true; fire: fire
        }
        FirePopup { x: scene.width; y: 82; width: 390; fire: fire; running: true }
    }
    function startRecording(directory, seconds, spookAt) {
        root.playing = false;
        recorder.directory = directory;
        recorder.frame = 0;
        recorder.count = Math.round(seconds * 20);
        recorder.startleAt = spookAt;
        recorder.painted = scene.framesDrawn;
        recorder.start();
    }
    // Deterministic captures of the real renderer, not a second drawing path.
    // mkdir the destination in the guest first; fetch it after recording.
    Timer {
        id: recorder
        interval: 60; repeat: true
        property string directory
        property int frame: 0
        property int count: 0
        property int painted: 0
        property real startleAt: -1
        property bool busy: false
        onTriggered: {
            if (busy || scene.framesDrawn <= painted) return;
            busy = true;
            scene.grabToImage(function(result) {
                result.saveToFile(directory + "/" + ("0000" + frame).slice(-4) + ".png");
                frame++;
                if (frame >= count) { stop(); busy = false; return; }
                if (startleAt >= 0 && frame === Math.round(startleAt * 20) && fire.wildlife.fox)
                    fire.pointerDown(fire.wildlife.fox.x, fire.wildlife.fox.y - 12);
                fire.advance(0.05, true);
                fire.sync();
                painted = scene.framesDrawn;
                busy = false;
            }, Qt.size(960, 480));
        }
    }
    IpcHandler {
        target: "omafire-fox-preview"
        function play(): void { root.play(); }
        function inspectAt(seconds: real): void { root.inspectAt(seconds); }
        function seed(value: int): void { root.visitSeed = value; root.inspectAt(0); }
        function pose(value: string): void { root.inspectPose(value); }
        function state(): string { return JSON.stringify(fire.wildlife); }
        function capture(path: string): void {
            scene.grabToImage(function(result) { result.saveToFile(path); }, Qt.size(960, 480));
        }
        function record(directory: string, seconds: real, spookAt: real): void {
            root.inspectAt(0);
            root.startRecording(directory, seconds, spookAt);
        }
        function recordCurrent(directory: string, seconds: real, spookAt: real): void {
            root.startRecording(directory, seconds, spookAt);
        }
        function step(seconds: real): void { root.playing = false; fire.advance(seconds, true); }
        function slow(rate: real): void { root.playbackRate = Math.max(0.1, Math.min(1, rate)); }
        function recording(): bool { return recorder.running; }
        function spook(): void { if (fire.wildlife.fox) fire.pointerDown(fire.wildlife.fox.x, fire.wildlife.fox.y - 12); }
        function resume(): void { root.playing = true; }
        function quit(): void { Qt.quit(); }
    }
    Component.onCompleted: inspectPose("idle")
}
