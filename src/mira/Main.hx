package mira;

import js.Syntax;

class Main {
    static function main():Void {
        final nodeProcess:Dynamic = Syntax.code("process");
        final fs:Dynamic = Syntax.code("require('node:fs')");
        final args:Array<String> = cast nodeProcess.argv.slice(2);

        try {
            if (args.length > 0 && args[0] == "--benchmark") {
                if (args.length != 4) {
                    throw new MiraError(
                        "Usage: node dist/mira.cjs --benchmark <source.mira> <js|php> <iterations>"
                    );
                }

                final source:String = fs.readFileSync(args[1], "utf8");
                final target = parseTarget(args[2]);
                final iterations = Std.parseInt(args[3]);

                if (iterations == null) {
                    throw new MiraError("Benchmark iterations must be an integer");
                }

                nodeProcess.stdout.write(
                    haxe.Json.stringify(Benchmark.run(source, target, iterations)) + "\n"
                );
                return;
            }

            if (args.length < 2 || args.length > 3) {
                usage(nodeProcess);
                return;
            }

            final source:String = fs.readFileSync(args[0], "utf8");
            final output = args[1] == "--tokens"
                ? Compiler.inspectTokens(source) + "\n"
                : Compiler.transpile(source, parseTarget(args[1]));

            if (args.length == 3) {
                fs.writeFileSync(args[2], output);
            } else {
                nodeProcess.stdout.write(output);
            }
        } catch (error:Dynamic) {
            nodeProcess.stderr.write(Std.string(error) + "\n");
            nodeProcess.exitCode = 1;
        }
    }

    static function parseTarget(value:String):Target {
        return switch (value) {
            case "js": JavaScript;
            case "php": Php;
            default: throw new MiraError("Unknown target: " + value + " (expected js or php)");
        };
    }

    static function usage(nodeProcess:Dynamic):Void {
        nodeProcess.stderr.write(
            "Usage: node dist/mira.cjs <source.mira> <js|php|--tokens> [output]\n"
        );
        nodeProcess.exitCode = 2;
    }
}
