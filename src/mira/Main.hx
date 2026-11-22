package mira;

import js.Syntax;

class Main {
    static function main():Void {
        final process:Dynamic = Syntax.code("process");
        final fs:Dynamic = Syntax.code("require('node:fs')");
        final args:Array<String> = cast process.argv.slice(2);

        if (args.length < 2 || args.length > 3
            || ["js", "php", "--tokens"].indexOf(args[1]) < 0) {
            process.stderr.write(
                "Usage: node dist/mira.cjs <source.mira> <js|php|--tokens> [output]\n"
            );
            process.exitCode = 2;
            return;
        }

        try {
            final source:String = fs.readFileSync(args[0], "utf8");
            final output = args[1] == "--tokens"
                ? Compiler.inspectTokens(source) + "\n"
                : Compiler.transpile(source, args[1]);

            if (args.length == 3) {
                fs.writeFileSync(args[2], output);
            } else {
                process.stdout.write(output);
            }
        } catch (error:Dynamic) {
            process.stderr.write(Std.string(error) + "\n");
            process.exitCode = 1;
        }
    }
}
