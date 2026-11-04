import QtQuick
import QtQuick.Window
import QtTest
import "../../ui/fire"
import "../../ui/fire/wildlife.js" as Wildlife

// Contract between shared visitor state, actual scene input, sprite rendering
// and incremental copying. In particular, a departed fox must leave no trail.
Item {
    FireState { id: fire; autoTick: false; open: true }
    Window {
        visible: true
        width: 740; height: 260
        FireScene { id: sceneA; x: 10; y: 10; width: 360; height: 240; fire: fire }
        FireScene { id: sceneB; x: 380; y: 10; width: 360; height: 240; fire: fire }
    }
    TestCase {
        id: tc
        name: "wildlife"
        when: windowShown

        function nextFrames() {
            var a = sceneA.framesDrawn, b = sceneB.framesDrawn;
            tryVerify(function() { return sceneA.framesDrawn >= a + 3 && sceneB.framesDrawn >= b + 3; }, 5000);
            wait(50);
        }
        function advanceUntilPose(pose) {
            for (var i = 0; i < 1200; i++) {
                if (fire.wildlife.fox && fire.wildlife.fox.pose === pose) return;
                Wildlife.advance(fire.wildlife, 1 / 60);
            }
            fail("visitor did not reach " + pose);
        }
        function visit() {
            Wildlife.startVisit(fire.wildlife);
            advanceUntilPose("idle");
            fire.sync();
            nextFrames();
        }
        function grab(scene, name) {
            var done = false;
            scene.grabToImage(function(result) {
                result.saveToFile(Qt.resolvedUrl("../out/wildlife-" + name + "-" + Screen.devicePixelRatio + "x.png").toString().replace(/^file:\/\//, ""));
                done = true;
            });
            tryVerify(function() { return done; }, 5000);
        }
        function initTestCase() {
            tryVerify(function() { return sceneA.ready && sceneB.ready; }, 10000);
        }
        function test_shared_click_and_clean_departure() {
            nextFrames();
            grab(sceneA, "before");
            var fullFrames = sceneA.fullFramesDrawn;
            var fuel = fire.fuel;
            visit();
            grab(sceneA, "arrived-A");
            grab(sceneB, "arrived-B");
            mouseClick(sceneA, 120, 230);
            compare(fire.wildlife.fox.pose, "idle", "unrelated clicks do not scare the fox");
            var facing = fire.wildlife.fox.direction;
            mouseClick(sceneB, fire.wildlife.fox.x, fire.wildlife.fox.y - 12);
            compare(fire.wildlife.fox.pose, "alert");
            compare(fire.wildlife.fox.direction, facing, "startle anticipates without flipping");
            compare(fire.fuel, fuel, "animal clicks do not feed the fire");
            advanceUntilPose("turn");
            compare(fire.wildlife.fox.direction, facing, "turn retains facing until complete");
            advanceUntilPose("run");
            compare(fire.wildlife.fox.direction, 1, "completed turn faces cover");
            nextFrames();
            grab(sceneA, "run-A");
            grab(sceneB, "run-B");
            for (var i = 0; i < 50; i++) {
                var fox = fire.wildlife.fox;
                if (fox) fire.pointerDown(fox.x, fox.y - 12);
                Wildlife.advance(fire.wildlife, 0.1);
            }
            nextFrames();
            compare(fire.wildlife.fox, null);
            grab(sceneA, "departed");
            compare(sceneA.fullFramesDrawn, fullFrames, "restoration uses incremental copies, not a forced full repaint");
        }
        function test_wallpaper_keeps_visit_but_hidden_or_suspend_does_not() {
            visit();
            fire.wallpaper = true;
            fire.open = false;
            verify(fire.wildlife.fox !== null, "closing popup preserves an active wallpaper visit");
            fire.wallpaper = false;
            compare(fire.wildlife.fox, null, "no frozen animal waiting when the last view closes");
            fire.open = true;
            visit();
            fire.advance(30, true);
            compare(fire.wildlife.fox, null, "a suspend gap does not replay an encounter");
            verify(fire.wildlife.wait > 0, "next visit is in the future");
        }
    }
}
