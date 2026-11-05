import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "fire"

// An ordinary service plugin in the existing shell, not another process.
// The unmodified Campfire theme enables the shared desktop scene by name.
Item {
    id: root

    property bool enabled: false
    readonly property bool active: enabled && Quickshell.screens.length > 0

    onActiveChanged: FireSession.wallpaperActive = active
    Component.onCompleted: FireSession.wallpaperActive = active
    Component.onDestruction: {
        FireSession.wallpaperActive = false;
        FireSession.fire.pointerCancel();
    }

    FileView {
        path: Quickshell.env("HOME") + "/.local/state/omarchy/current/theme.name"
        printErrors: false
        watchChanges: true
        onFileChanged: reload()
        onLoaded: root.enabled = text().trim() === "campfire"
        onLoadFailed: root.enabled = false
    }

    Variants {
        model: root.active ? Quickshell.screens : []
        PanelWindow {
            id: desktop
            required property var modelData
            screen: modelData
            anchors { top: true; bottom: true; left: true; right: true }
            color: "transparent"
            exclusionMode: ExclusionMode.Ignore
            WlrLayershell.namespace: "omafire-wallpaper"
            // Above the normal still wallpaper, below every regular window.
            WlrLayershell.layer: WlrLayer.Bottom
            WlrLayershell.keyboardFocus: WlrKeyboardFocus.None

            // Keep the full window's default input region. Unused desktop
            // clicks stop here rather than opening the still-wallpaper picker
            // underneath. FireScene handles logs/coals; keyboard shortcuts and
            // normal windows above this layer remain unaffected.

            Item {
                id: landscape
                // The fire keeps its original scale and coordinates; the fox
                // and scene input also cover the extended side trails.
                readonly property real cover: Math.max(desktop.width / 480, desktop.height / 240)
                width: 480 * cover
                height: 240 * cover
                x: (desktop.width - width) / 2
                y: (desktop.height - height) / 2
                clip: true

                FireScene {
                    anchors.fill: parent
                    wide: true
                    fire: FireSession.fire
                }
            }
        }
    }
}
