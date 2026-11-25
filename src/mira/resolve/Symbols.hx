package mira.resolve;

import mira.HostEnvironment;
import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;

class Symbols {
    public final functions:Array<Definition> = [];
    public final globals:Array<String> = [];
    public final hostNames:Array<String> = [];
    public final environment:HostEnvironment;

    public function new(definitions:Array<Definition>, ?environment:HostEnvironment) {
        this.environment = environment == null ? HostEnvironment.empty() : environment;
        final seenSelectors = new Map<String, Bool>();
        final seenGlobals = new Map<String, Bool>();
        final mangled = new Map<String, String>();

        for (name in this.environment.values.concat(this.environment.callables)) {
            seenGlobals.set(name, true);
            hostNames.push(Mangle.name(name));
        }
        for (selector in this.environment.selectors) {
            seenSelectors.set(selector, true);
            hostNames.push(Mangle.selector(selector.substr(0, selector.length - 1).split(":")));
            final labels = selector.substr(0, selector.length - 1).split(":");
            final parameters = [for (i in 0...labels.length) "hostArg" + i];
            functions.push(new Definition("", labels, parameters, [],
                new Token(Word, labels[0], 1, 1)));
        }

        for (definition in definitions) {
            if (definition.isStatement) continue;
            final identifier = definition.isFunction()
                ? definition.selector() : definition.name;
            final hostName = definition.isFunction()
                ? Mangle.selector(definition.labels) : Mangle.name(definition.name);

            if (definition.isFunction()) {
                if (seenSelectors.exists(identifier)) {
                    throw new MiraError("Duplicate or conflicting selector " + identifier, definition.origin);
                }
                seenSelectors.set(identifier, true);
                functions.push(definition);

                final locals = new Map<String, Bool>();
                for (parameter in definition.parameters) {
                    if (parameter == "_") {
                        throw new MiraError("'_' is reserved for section placeholders", definition.origin);
                    }
                    if (locals.exists(parameter)) {
                        throw new MiraError("Duplicate parameter " + parameter, definition.origin);
                    }
                    locals.set(parameter, true);
                }
            } else {
                if (identifier == "_") {
                    throw new MiraError("'_' is reserved for section placeholders", definition.origin);
                }
                if (seenGlobals.exists(identifier)) {
                    throw new MiraError("Duplicate or conflicting value " + identifier, definition.origin);
                }
                seenGlobals.set(identifier, true);
                globals.push(definition.name);
            }

            if (!~/^[A-Za-z_][A-Za-z_0-9]*$/.match(hostName)) {
                throw new MiraError("Invalid generated symbol " + hostName, definition.origin);
            }
            if (hostName == "__miraHost") {
                throw new MiraError("Reserved generated symbol " + hostName, definition.origin);
            }
            if (mangled.exists(hostName)) {
                throw new MiraError("Generated-name collision " + hostName
                    + " (" + mangled.get(hostName) + " and " + identifier + ")", definition.origin);
            }
            mangled.set(hostName, identifier);
            hostNames.push(hostName);
        }
        // Validate named-function scopes after all globals are collected,
        // regardless of declaration order. The same literal name may shadow
        // a global; distinct names must not become the same JS/PHP symbol.
        for (definition in definitions) {
            if (!definition.isFunction()) continue;
            final generated = new Map<String, String>();
            for (index in 0...definition.parameters.length) {
                final parameter = definition.parameters[index];
                final symbol = Mangle.name(parameter);
                final token = definition.parameterOrigins.length > index
                    ? definition.parameterOrigins[index] : definition.origin;
                if (symbol == "__miraHost") {
                    throw new MiraError("Reserved function parameter __miraHost", token);
                }
                final previous = generated.get(symbol);
                if (previous != null) {
                    throw new MiraError("Generated-name collision for function parameter "
                        + parameter + " with " + previous, token);
                }
                generated.set(symbol, parameter);
                for (outer in globals) {
                    if (outer != parameter && Mangle.name(outer) == symbol) {
                        throw new MiraError("Generated-name collision for function parameter "
                            + parameter + " with visible name " + outer, token);
                    }
                }
            }
        }
    }

    public function isHostName(name:String):Bool {
        return environment.values.indexOf(name) >= 0
            || environment.callables.indexOf(name) >= 0;
    }

    public function isHostSelector(selector:String):Bool {
        return environment.selectors.indexOf(selector) >= 0;
    }

    public function matchingFunctions(tokens:Array<Token>, start:Int):Array<Definition> {
        final matches:Array<Definition> = [];
        for (definition in functions) {
            if (matchesWords(tokens, start, definition.labels[0])) matches.push(definition);
        }
        return matches;
    }

    public function resolveName(tokens:Array<Token>, start:Int, locals:Array<String>):Null<String> {
        final names = locals.concat(globals)
            .concat(environment.values)
            .concat(environment.callables);
        names.sort(function(a, b) return b.split(" ").length - a.split(" ").length);
        for (name in names) if (matchesWords(tokens, start, name)) return name;
        return null;
    }

    public static function matchesWords(tokens:Array<Token>, start:Int, name:String):Bool {
        final words = name.split(" ");
        if (start + words.length > tokens.length) return false;
        for (i in 0...words.length) {
            if (tokens[start + i].kind != Word || tokens[start + i].value != words[i]) return false;
        }
        return true;
    }
}
