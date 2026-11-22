package mira.resolve;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;

class Symbols {
    public final functions:Array<Definition> = [];
    public final globals:Array<String> = [];

    public function new(definitions:Array<Definition>) {
        final seenSelectors = new Map<String, Bool>();
        final seenGlobals = new Map<String, Bool>();
        final hostNames = new Map<String, String>();

        for (definition in definitions) {
            final identifier = definition.isFunction()
                ? definition.selector()
                : definition.name;
            final hostName = definition.isFunction()
                ? Mangle.selector(definition.labels)
                : Mangle.name(definition.name);

            if (definition.isFunction()) {
                if (seenSelectors.exists(identifier)) {
                    throw new MiraError("Duplicate selector " + identifier, definition.origin);
                }
                seenSelectors.set(identifier, true);
                functions.push(definition);

                final localNames = new Map<String, Bool>();
                for (parameter in definition.parameters) {
                    if (localNames.exists(parameter)) {
                        throw new MiraError("Duplicate parameter " + parameter, definition.origin);
                    }
                    localNames.set(parameter, true);
                }
            } else {
                if (seenGlobals.exists(identifier)) {
                    throw new MiraError("Duplicate value " + identifier, definition.origin);
                }
                seenGlobals.set(identifier, true);
                globals.push(definition.name);
            }

            if (!~/^[A-Za-z_][A-Za-z_0-9]*$/.match(hostName)) {
                throw new MiraError("Invalid generated symbol " + hostName, definition.origin);
            }
            if (hostNames.exists(hostName)) {
                throw new MiraError(
                    "Generated-name collision " + hostName + " (" + hostNames.get(hostName) + " and " + identifier + ")",
                    definition.origin
                );
            }
            hostNames.set(hostName, identifier);
        }
    }

    public function matchingFunctions(tokens:Array<Token>, start:Int):Array<Definition> {
        final results:Array<Definition> = [];
        for (definition in functions) {
            if (matchesWords(tokens, start, definition.labels[0])) {
                results.push(definition);
            }
        }
        return results;
    }

    public function resolveName(tokens:Array<Token>, start:Int, locals:Array<String>):Null<String> {
        final names = locals.concat(globals);
        names.sort(function(a, b) {
            return b.split(" ").length - a.split(" ").length;
        });

        for (name in names) {
            if (matchesWords(tokens, start, name)) return name;
        }
        return null;
    }

    public static function matchesWords(tokens:Array<Token>, start:Int, name:String):Bool {
        final words = name.split(" ");
        if (start + words.length > tokens.length) return false;
        for (i in 0...words.length) {
            if (tokens[start + i].kind != Word || tokens[start + i].value != words[i]) {
                return false;
            }
        }
        return true;
    }
}
