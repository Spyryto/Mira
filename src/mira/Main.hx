package mira;

#if js
import js.Syntax;
#end
import haxe.io.Path;
import mira.emit.SourceLocations.GeneratedLocation;

class Main {
    static function main():Void {
        #if js
        final args:Array<String> = cast Syntax.code("process.argv.slice(2)");
        #else
        final args = Sys.args();
        #end
        var exitCode = 0;

        try {
            if (args.length > 0 && args[0] == "--benchmark") {
                if (args.length != 4) {
                    throw new MiraError(
                        "Usage: mira compiler --benchmark <source.mira> <js|php> <iterations>"
                    );
                }
                final source:String = readText(args[1]);
                final target = parseTarget(args[2]);
                final iterations = Std.parseInt(args[3]);
                if (iterations == null) throw new MiraError("Benchmark iterations must be an integer");
                writeOut(
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
                host = HostEnvironment.fromJson(readText(args[flag + 1]));
                args.splice(flag, 2);
            }

            var providers:mira.resolve.ProviderBindings = null;
            final bindingFlag = args.indexOf("--bindings");
            if (bindingFlag >= 0) {
                if (bindingFlag + 1 >= args.length) throw new MiraError("--bindings requires a JSON manifest path");
                providers = mira.resolve.ProviderBindings.fromJson(readText(args[bindingFlag+1]));
                args.splice(bindingFlag,2);
            }
            // Explicit additional logical module roots, relative to cwd.
            // Quoted legacy file imports stay relative to the entry.
            final extraRoots:Array<String> = [];
            var rootFlag = args.indexOf("--module-root");
            while (rootFlag >= 0) {
                if (rootFlag + 1 >= args.length || StringTools.startsWith(args[rootFlag+1],"--"))
                    throw new MiraError("--module-root requires a directory");
                extraRoots.push(args[rootFlag+1]);
                args.splice(rootFlag,2);
                rootFlag = args.indexOf("--module-root");
            }
            final checkedFlag = args.indexOf("--checked");
            if (checkedFlag >= 0) args.splice(checkedFlag,1);

            final shakeFlag = args.indexOf("--tree-shake");
            if (shakeFlag >= 0) args.splice(shakeFlag,1);
            if (shakeFlag >= 0 && checkedFlag < 0) throw new MiraError("--tree-shake requires --checked");

            final profileFlag = args.indexOf("--profile");
            if (profileFlag >= 0) args.splice(profileFlag,1);
            if (profileFlag >= 0 && checkedFlag < 0) throw new MiraError("--profile requires --checked");

            final locationFlag = args.indexOf("--locations");
            if (locationFlag >= 0) args.splice(locationFlag, 1);

            if (args.length < 2 || args.length > 3) {
                usage();
                finish(2);
                return;
            }

            final source:String = readText(args[0]);
            // Imports are relative to the entry directory, not to the process cwd.
            final root:String = realPath(directoryOf(absolutePath(args[0])));
            final roots:Array<String> = [root];
            for (directory in extraRoots) {
                if (!exists(directory) || !isDirectory(directory))
                    throw new MiraError("Module root is not a directory: " + directory);
                final resolved:String = realPath(directory);
                if (roots.indexOf(resolved) < 0) roots.push(resolved);
            }
            final entry:String = Path.withoutDirectory(args[0]);
            final readModule = function(name:String):Null<String> {
                // Logical paths are resolved by this host convention, not by the core.
                final legacy = StringTools.endsWith(name,".mira");
                final relative = legacy ? name : name.split(" / ").join("/") + ".mira";
                var found:Null<String> = null;
                for (directory in (legacy ? [root] : roots)) {
                    final requested:String = absolutePath(relative, directory);
                    if (!exists(requested)) continue;
                    final actual:String = realPath(requested);
                    if (actual != requested) throw new MiraError("Module symlinks are not supported");
                    if (!isFile(actual)) continue;
                    if (found != null) throw new MiraError("Ambiguous module " + name + ": " + found + " and " + actual);
                    found = actual;
                }
                return found == null ? null : readText(found);
            };
            if (checkedFlag >= 0 && args[1] != "js" && args[1] != "php")
                throw new MiraError("--checked requires a js or php target");
            if (providers != null && checkedFlag < 0 && args[1] != "--check" && args[1] != "--check-json" && args[1] != "--interfaces")
                throw new MiraError("--bindings requires --checked or --check/--check-json");
            var output:String;
            if (profileFlag >= 0) {
                final profile = new mira.CompileProfile();
                final locations:Array<GeneratedLocation> = locationFlag >= 0 ? [] : null;
                final code = Compiler.transpileChecked(source,parseTarget(args[1]),host,locations,readModule,entry,shakeFlag >= 0,null,providers,profile);
                final report:Dynamic = {output:code,profile:profile.report()};
                if (locations != null) Reflect.setField(report,"locations",locations);
                output = haxe.Json.stringify(report,null,"  ") + "\n";
            } else if (args[1] == "--interfaces") {
                if (locationFlag >= 0) throw new MiraError("--locations is not applicable to --interfaces");
                output = haxe.Json.stringify(Compiler.interfaces(source,host,readModule,entry,providers),null,"  ") + "\n";
            } else if (args[1] == "--check-json") {
                if (locationFlag >= 0) throw new MiraError("--locations is not applicable to --check-json");
                try {
                    output = haxe.Json.stringify({ok:true, types:Compiler.check(source,host,readModule,entry,providers), diagnostics:[]}, null, "  ") + "\n";
                } catch (error:MiraError) {
                    output = haxe.Json.stringify({ok:false, types:[], diagnostics:[error.diagnostic]}, null, "  ") + "\n";
                    exitCode = 1;
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
                writeText(args[2], output);
            } else {
                writeOut(output);
            }
        } catch (error:Dynamic) {
            writeError(Std.string(error) + "\n");
            exitCode = 1;
        }
        finish(exitCode);
    }

    static function parseTarget(value:String):Target {
        return switch (value) {
            case "js": JavaScript;
            case "php": Php;
            default: throw new MiraError("Unknown target: " + value + " (expected js or php)");
        };
    }

    static function usage():Void {
        writeError(
            "Usage: node dist/mira.cjs <source.mira> <js|php|--tokens|--check|--check-json|--interfaces> [output] [--host manifest.json] [--locations] [--checked] [--tree-shake] [--profile] [--bindings bindings.json] [--module-root directory]...\n"
        );
    }
    static function readText(path:String):String {
        #if js
        return Syntax.code("require('node:fs').readFileSync({0}, 'utf8')", path);
        #else
        return sys.io.File.getContent(path);
        #end
    }
    static function writeText(path:String, value:String):Void {
        #if js
        Syntax.code("require('node:fs').writeFileSync({0}, {1})", path, value);
        #else
        sys.io.File.saveContent(path, value);
        #end
    }
    static function writeOut(value:String):Void {
        #if js
        Syntax.code("process.stdout.write({0})", value);
        #else
        Sys.stdout().writeString(value);
        #end
    }
    static function writeError(value:String):Void {
        #if js
        Syntax.code("process.stderr.write({0})", value);
        #else
        Sys.stderr().writeString(value);
        #end
    }
    static function finish(code:Int):Void {
        #if js
        Syntax.code("process.exitCode = {0}", code);
        #else
        if (code != 0) Sys.exit(code);
        #end
    }
    static function exists(path:String):Bool {
        #if js
        return Syntax.code("require('node:fs').existsSync({0})", path);
        #else
        return sys.FileSystem.exists(path);
        #end
    }
    static function isDirectory(path:String):Bool {
        #if js
        return Syntax.code("require('node:fs').statSync({0}).isDirectory()", path);
        #else
        return sys.FileSystem.isDirectory(path);
        #end
    }
    static function isFile(path:String):Bool {
        #if js
        return Syntax.code("require('node:fs').statSync({0}).isFile()", path);
        #elseif php
        return php.Syntax.code("is_file({0})", path);
        #else
        return exists(path) && !isDirectory(path);
        #end
    }
    static function realPath(path:String):String {
        #if js
        return Syntax.code("require('node:fs').realpathSync({0})", path);
        #else
        return Path.normalize(sys.FileSystem.fullPath(path));
        #end
    }
    static function directoryOf(path:String):String {
        #if js
        return Syntax.code("require('node:path').dirname({0})", path);
        #else
        return Path.directory(path);
        #end
    }
    static function absolutePath(path:String, ?base:String):String {
        #if js
        return base == null ? Syntax.code("require('node:path').resolve({0})", path)
            : Syntax.code("require('node:path').resolve({0}, {1})", base, path);
        #else
        return Path.normalize(Path.isAbsolute(path) ? path : Path.join([base == null ? Sys.getCwd() : base, path]));
        #end
    }
}
