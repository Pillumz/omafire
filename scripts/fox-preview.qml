import QtQuick
import Quickshell
import Quickshell.Io
import "ui/fire"
import "ui/fire/wildlife.js" as Wildlife

// Sandbox-only art/interaction fixture. Both are real production components
// reading one FireState. No preview controls or forced visits ship in the UI.
ShellRoot {
    id: root
    FireState { id: fire; open: true }

    function inspectAt(seconds) {
        fire.autoTick = false;
        Wildlife.startVisit(fire.wildlife);
        for (var i = 0; i < Math.round(seconds * 60); i++) fire.advance(1 / 60, true);
        fire.sync();
    }
    function play() {
        Wildlife.startVisit(fire.wildlife);
        fire.lastWall = Date.now();
        fire.autoTick = true;
        fire.sync();
    }

    FloatingWindow {
        id: window
        title: "OmaFire — fox preview"
        implicitWidth: 1110
        implicitHeight: 542
        color: "#101820"

        Row {
            x: 12; y: 8; spacing: 12
            Repeater {
                model: ["Play visit", "Inspect", "Spook", "Pause / resume"]
                Rectangle {
                    required property string modelData
                    width: label.implicitWidth + 24; height: 28
                    color: hover.containsMouse ? "#39434c" : "#26303a"
                    Text { id: label; anchors.centerIn: parent; text: modelData; color: "#dfd9cc"; font.pixelSize: 13 }
                    MouseArea {
                        id: hover; anchors.fill: parent; hoverEnabled: true
                        onClicked: {
                            if (modelData === "Play visit") root.play();
                            else if (modelData === "Inspect") root.inspectAt(10);
                            else if (modelData === "Spook" && fire.wildlife.fox) fire.pointerDown(fire.wildlife.fox.x, fire.wildlife.fox.y - 12);
                            else { fire.lastWall = Date.now(); fire.autoTick = !fire.autoTick; }
                        }
                    }
                }
            }
        }
        FireScene { x: 0; y: 46; width: 720; height: 480; fire: fire }
        FirePopup { x: 720; y: 46; width: 390; fire: fire; running: true }
    }
    IpcHandler {
        target: "omafire-fox-preview"
        function play(): void { root.play(); }
        function inspectAt(seconds: real): void { root.inspectAt(seconds); }
        function state(): string { return JSON.stringify(fire.wildlife); }
        function spook(): void { if (fire.wildlife.fox) fire.pointerDown(fire.wildlife.fox.x, fire.wildlife.fox.y - 12); }
        function resume(): void { fire.lastWall = Date.now(); fire.autoTick = true; }
        function quit(): void { Qt.quit(); }
    }
    Component.onCompleted: inspectAt(10)
}
