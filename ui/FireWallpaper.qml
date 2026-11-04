import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "fire"

// An ordinary service plugin in the existing shell, not another process.
// Themes opt in with an omafire-wallpaper file containing "enabled".
Item {
    id: root

    readonly property string current: Quickshell.env("HOME") + "/.local/state/omarchy/current/"
    property bool enabled: false
    readonly property bool active: enabled && Quickshell.screens.length > 0

    onActiveChanged: FireSession.wallpaperActive = active
    Component.onCompleted: FireSession.wallpaperActive = active
    Component.onDestruction: {
        FireSession.wallpaperActive = false;
        FireSession.fire.pointerCancel();
    }

    FileView {
        id: marker
        path: root.current + "theme/omafire-wallpaper"
        printErrors: false
        watchChanges: true
        onFileChanged: reload()
        onLoaded: root.enabled = text().trim() === "enabled"
        onLoadFailed: root.enabled = false
    }
    // Reopen the marker after a theme switch: the staged theme directory is
    // replaced, so watching only the old marker would miss later switches.
    FileView {
        path: root.current + "theme.name"
        printErrors: false
        watchChanges: true
        onFileChanged: reload()
        onLoaded: marker.reload()
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

            FireScene {
                id: scene
                // Preserve aspect ratio and cover the output, cropping equally
                // on opposite edges. Keep the original 360 x 240 render buffer.
                readonly property real cover: Math.max(desktop.width / 360, desktop.height / 240)
                width: 360 * cover
                height: 240 * cover
                x: (desktop.width - width) / 2
                y: (desktop.height - height) / 2
                fire: FireSession.fire
            }
        }
    }
}
