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
        width: 870; height: 260
        FireScene { id: sceneA; x: 10; y: 10; width: 360; height: 240; fire: fire }
        FireScene { id: sceneB; x: 380; y: 10; width: 480; height: 240; wide: true; fire: fire }
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
        property string captureSuffix: ""
        function advanceUntilPose(pose) {
            for (var i = 0; i < 10800; i++) {
                if (fire.wildlife.fox && fire.wildlife.fox.pose === pose) return;
                Wildlife.advance(fire.wildlife, 1 / 60);
            }
            fail("visitor did not reach " + pose);
        }
        function visit(seed) {
            fire.wildlife = Wildlife.create(seed === undefined ? 1 : seed);
            Wildlife.startVisit(fire.wildlife);
            advanceUntilPose("idle");
            fire.sync();
            nextFrames();
        }
        function grab(scene, name) {
            var done = false;
            scene.grabToImage(function(result) {
                result.saveToFile(Qt.resolvedUrl("../out/wildlife-" + name + captureSuffix + "-" + Screen.devicePixelRatio + "x.png").toString().replace(/^file:\/\//, ""));
                done = true;
            });
            tryVerify(function() { return done; }, 5000);
        }
        function initTestCase() {
            tryVerify(function() { return sceneA.ready && sceneB.ready; }, 10000);
        }
        function test_extended_trails_data() {
            return [{ tag: "left", seed: 8, x: -28 }, { tag: "right", seed: 6, x: 390 }];
        }
        function test_extended_trails(data) {
            captureSuffix = "-extension-" + data.tag;
            nextFrames();
            grab(sceneB, "before");
            mousePress(sceneB, data.x < 0 ? 30 : 450, 200);
            verify(!fire.dragging, "unused side scenery does not act as an invisible woodpile");
            mouseRelease(sceneB, data.x < 0 ? 30 : 450, 200);
            fire.wildlife = Wildlife.create(data.seed);
            Wildlife.startVisit(fire.wildlife);
            for (var i = 0; i < 1000; i++) {
                var fox = fire.wildlife.fox;
                if (data.x < 0 ? fox.x >= data.x : fox.x <= data.x) break;
                Wildlife.advance(fire.wildlife, 0.05);
            }
            fire.sync();
            nextFrames();
            var fox = fire.wildlife.fox;
            verify(fox.x < 0 || fox.x > 360, "the fox is on an extended side trail");
            grab(sceneB, "visible");
            var fullFrames = sceneB.fullFramesDrawn;
            mouseClick(sceneB, fox.x + 60, fox.y - 12);
            verify(fox.fleeing, "a nearby click on the extension reaches the shared fox");
            for (var i = 0; i < 600 && fire.wildlife.fox; i++) Wildlife.advance(fire.wildlife, 0.05);
            compare(fire.wildlife.fox, null);
            nextFrames();
            grab(sceneB, "departed");
            compare(sceneB.fullFramesDrawn, fullFrames, "side trails restore through incremental copies");
        }
        function test_shared_click_and_clean_departure_data() {
            return [{ tag: "rock", seed: 1 }, { tag: "right-trail", seed: 6 }, { tag: "left-trail", seed: 8 }];
        }
        function test_shared_click_and_clean_departure(data) {
            captureSuffix = "-" + data.tag;
            nextFrames();
            grab(sceneA, "before");
            grab(sceneB, "before-wide");
            var fullFrames = sceneA.fullFramesDrawn, wideFullFrames = sceneB.fullFramesDrawn;
            var fuel = fire.fuel;
            visit(data.seed);
            grab(sceneA, "arrived-A");
            grab(sceneB, "arrived-B");
            mouseClick(sceneA, 120, 80);
            compare(fire.wildlife.fox.pose, "idle", "unrelated clicks do not scare the fox");
            var facing = fire.wildlife.fox.direction;
            mouseClick(sceneB, fire.wildlife.fox.x + 60, fire.wildlife.fox.y - 12);
            compare(fire.wildlife.fox.pose, "alert");
            compare(fire.wildlife.fox.direction, facing, "startle anticipates without flipping");
            compare(fire.fuel, fuel, "animal clicks do not feed the fire");
            advanceUntilPose("run");
            nextFrames();
            grab(sceneA, "run-A");
            grab(sceneB, "run-B");
            for (var i = 0; i < 120 && fire.wildlife.fox; i++) {
                var fox = fire.wildlife.fox;
                if (fox) fire.pointerDown(fox.x, fox.y - 12);
                Wildlife.advance(fire.wildlife, 0.1);
            }
            nextFrames();
            compare(fire.wildlife.fox, null);
            grab(sceneA, "departed");
            grab(sceneB, "departed-wide");
            compare(sceneA.fullFramesDrawn, fullFrames, "restoration uses incremental copies, not a forced full repaint");
            compare(sceneB.fullFramesDrawn, wideFullFrames, "the wallpaper also restores incrementally");
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
