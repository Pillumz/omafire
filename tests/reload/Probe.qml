import QtQuick
import qs.Commons

// Independent public-IPC witness: a newly constructed bar widget proves that
// rescanPlugins has progressed beyond unloading and registry discovery.
Item {
    id: probe
    implicitWidth: 1
    implicitHeight: 1
    readonly property string instance: Date.now() + ":" + Math.random()
    ShellIpc {
        target: "omafire-reload-probe"
        function generation(): string { return probe.instance; }
    }
}
