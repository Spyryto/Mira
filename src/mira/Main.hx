package mira;

import js.Syntax;
import mira.emit.SourceLocations.GeneratedLocation;

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
                if (iterations == null) throw new MiraError("Benchmark iterations must be an integer");
                nodeProcess.stdout.write(
                    haxe.Json.stringify(Benchmark.run(source, target, iterations)) + "\n"
                );
                return;
            }

            var host = HostEnvironment.empty();
            final flag = args.indexOf("--host");
            if (flag >= 0) {
                if (flag + 1 >= args.length) {
                    throw new MiraError("--host requires a JSON manifest path");
                }
                host = HostEnvironment.fromJson(fs.readFileSync(args[flag + 1], "utf8"));
                args.splice(flag, 2);
            }

            var providers:mira.resolve.ProviderBindings = null;
            final bindingFlag = args.indexOf("--bindings");
            if (bindingFlag >= 0) {
                if (bindingFlag + 1 >= args.length) throw new MiraError("--bindings requires a JSON manifest path");
                providers = mira.resolve.ProviderBindings.fromJson(fs.readFileSync(args[bindingFlag+1],"utf8"));
                args.splice(bindingFlag,2);
            }
            final checkedFlag = args.indexOf("--checked");
            if (checkedFlag >= 0) args.splice(checkedFlag,1);

            final shakeFlag = args.indexOf("--tree-shake");
            if (shakeFlag >= 0) args.splice(shakeFlag,1);
            if (shakeFlag >= 0 && checkedFlag < 0) throw new MiraError("--tree-shake requires --checked");

            final locationFlag = args.indexOf("--locations");
            if (locationFlag >= 0) args.splice(locationFlag, 1);

            if (args.length < 2 || args.length > 3) {
                usage(nodeProcess);
                return;
            }

            final source:String = fs.readFileSync(args[0], "utf8");
            // Imports are relative to the entry directory, not to the process cwd.
            final path:Dynamic = Syntax.code("require('node:path')");
            final root:String = fs.realpathSync(path.dirname(path.resolve(args[0])));
            final entry:String = path.basename(args[0]);
            final readModule = function(name:String):Null<String> {
                // Logical paths are resolved by this host convention, not by the core.
                final relative = StringTools.endsWith(name,".mira") ? name : name.split(" / ").join("/") + ".mira";
                final requested:String = path.resolve(root, relative);
                if (!fs.existsSync(requested)) return null;
                final actual:String = fs.realpathSync(requested);
                if (actual != requested) throw new MiraError("Module symlinks are not supported");
                if (!fs.statSync(actual).isFile()) return null;
                return fs.readFileSync(actual, "utf8");
            };
            if (checkedFlag >= 0 && args[1] != "js" && args[1] != "php")
                throw new MiraError("--checked requires a js or php target");
            if (providers != null && checkedFlag < 0 && args[1] != "--check" && args[1] != "--check-json" && args[1] != "--interfaces")
                throw new MiraError("--bindings requires --checked or --check/--check-json");
            var output:String;
            if (args[1] == "--interfaces") {
                if (locationFlag >= 0) throw new MiraError("--locations is not applicable to --interfaces");
                output = haxe.Json.stringify(Compiler.interfaces(source,host,readModule,entry,providers),null,"  ") + "\n";
            } else if (args[1] == "--check-json") {
                if (locationFlag >= 0) throw new MiraError("--locations is not applicable to --check-json");
                try {
                    output = haxe.Json.stringify({ok:true, types:Compiler.check(source,host,readModule,entry,providers), diagnostics:[]}, null, "  ") + "\n";
                } catch (error:MiraError) {
                    output = haxe.Json.stringify({ok:false, types:[], diagnostics:[error.diagnostic]}, null, "  ") + "\n";
                    nodeProcess.exitCode = 1;
                }
            } else if (locationFlag >= 0) {
                final locations:Array<GeneratedLocation> = [];
                final code = checkedFlag >= 0 ? Compiler.transpileChecked(source,parseTarget(args[1]),host,locations,readModule,entry,shakeFlag >= 0,null,providers)
                    : Compiler.transpile(source, parseTarget(args[1]), host, locations, readModule, entry);
                output = haxe.Json.stringify({output: code, locations: locations}, null, "  ") + "\n";
            } else {
                output = args[1] == "--check" ? haxe.Json.stringify(Compiler.check(source,host,readModule,entry,providers), null, "  ") + "\n"
                    : args[1] == "--tokens" ? Compiler.inspectTokens(source) + "\n"
                    : checkedFlag >= 0 ? Compiler.transpileChecked(source,parseTarget(args[1]),host,null,readModule,entry,shakeFlag >= 0,null,providers)
                    : Compiler.transpile(source, parseTarget(args[1]), host, null, readModule, entry);
            }

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
            "Usage: node dist/mira.cjs <source.mira> <js|php|--tokens|--check|--check-json|--interfaces> [output] [--host manifest.json] [--locations] [--checked] [--tree-shake] [--bindings bindings.json]\n"
        );
        nodeProcess.exitCode = 2;
    }
}
