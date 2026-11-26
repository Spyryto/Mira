package mira;

import haxe.Timer;

// Optional per-compilation measurements. Never passed to emitted programs.
// Marks are consecutive intervals of the actual checked pipeline.
class CompileProfile {
    var started:Float = 0;
    var last:Float = 0;
    var phases:Array<{phase:String,ms:Float}> = [];

    public function new() {}

    public function begin():Void {
        phases = [];
        started = last = Timer.stamp();
    }

    public function mark(phase:String):Void {
        final now = Timer.stamp();
        phases.push({phase:phase,ms:Math.max(0,(now-last)*1000)});
        last = now;
    }

    public function report():Dynamic {
        return {totalMs:Math.max(0,(last-started)*1000),phases:phases.copy()};
    }
}
