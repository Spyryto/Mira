package mira;

import haxe.Timer;

// Measures the core Mira -> target compilation in one warmed-up process.
// Disk I/O, Node startup and Haxe compilation are intentionally excluded.
class Benchmark {
    public static function run(source:String, target:Target, iterations:Int):Dynamic {
        if (iterations < 1 || iterations > 10000) {
            throw new MiraError("Benchmark iterations must be between 1 and 10000");
        }

        for (i in 0...10) {
            Compiler.transpile(source, target);
        }

        final elapsedMs:Array<Float> = [];
        var generatedBytes = 0;

        for (i in 0...iterations) {
            final start = Timer.stamp();
            final generated = Compiler.transpile(source, target);
            elapsedMs.push((Timer.stamp() - start) * 1000);
            generatedBytes = generated.length;
        }

        elapsedMs.sort(function(a, b) return a < b ? -1 : a > b ? 1 : 0);

        var totalMs = 0.0;
        for (elapsed in elapsedMs) {
            totalMs += elapsed;
        }

        return {
            target: switch (target) {
                case JavaScript: "js";
                case Php: "php";
            },
            iterations: iterations,
            sourceLength: source.length,
            generatedBytes: generatedBytes,
            medianMs: percentile(elapsedMs, 0.50),
            p95Ms: percentile(elapsedMs, 0.95),
            meanMs: totalMs / iterations
        };
    }

    static function percentile(sorted:Array<Float>, fraction:Float):Float {
        final index = Std.int(Math.ceil(sorted.length * fraction)) - 1;
        return sorted[index < 0 ? 0 : index];
    }
}
