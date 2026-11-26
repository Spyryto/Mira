package mira.resolve;

import mira.HostEnvironment;
import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.syntax.Definition;

class Symbols {
    public static inline final RECORD_UPDATE = "update:with:";

    // Legacy collection capabilities may be explicitly supplied by a host
    // (the AST inspector folds trees). Ordinary programs use native lists.
    public static function collectionSelectors():Array<String> {
        return ["append:to:", "remove:if:", "map:with:", "collect:with:",
            "filter:with:", "select:with:", "select:if:", "fold:with:from:"];
    }

    public static function nativeSelectors():Array<String> {
        return [RECORD_UPDATE].concat(collectionSelectors());
    }
    public final functions:Array<Definition> = [];
    public final globals:Array<String> = [];
    public final hostNames:Array<String> = [];
    public final environment:HostEnvironment;
    final scopedGlobals = new Map<String,Array<String>>();
    final resolvedValues = new Map<String,String>();
    final resolvedSelectors = new Map<String,String>();

    public function new(definitions:Array<Definition>, ?environment:HostEnvironment, ?modulePath:String) {
        this.environment = environment == null ? HostEnvironment.empty() : environment;
        final seenSelectors = new Map<String, Bool>();
        final seenGlobals = new Map<String, Bool>();
        final mangled = new Map<String, String>();

        // Native selector participates in the ordinary selector resolver.
        for (selector in nativeSelectors()) {
            // Only pre-existing host collection signatures can override.
            if (selector != RECORD_UPDATE && selector != "append:to:" && selector != "remove:if:"
                && this.environment.selectors.indexOf(selector) >= 0) continue;
            seenSelectors.set(selector, true);
            final labels = selector.substr(0, selector.length - 1).split(":");
            functions.push(new Definition("", labels, [for (i in 0...labels.length) "nativeArg" + i],
                [], new Token(Word, labels[0], 1, 1)));
        }
        for (name in this.environment.values.concat(this.environment.callables)) {
            seenGlobals.set(name, true);
            hostNames.push(Mangle.name(name));
        }
        for (selector in this.environment.selectors) {
            if (StringTools.startsWith(selector,"validate:")) throw new MiraError("Reserved validation selector " + selector);
            if (seenSelectors.exists(selector)) throw new MiraError("Reserved native selector " + selector);
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
            if (modulePath != null) {
                if (definition.isFunction()) resolvedSelectors.set(identifier,ModuleIdentity.qualify(modulePath,identifier));
                else resolvedValues.set(identifier,ModuleIdentity.qualify(modulePath,identifier));
            }
            final hostName = definition.isFunction()
                ? Mangle.selector(resolvedSelector(identifier).substr(0,resolvedSelector(identifier).length-1).split(":"))
                : Mangle.name(resolvedName(definition.name));

            if (definition.isFunction()) {
                if (definition.labels[0] == "validate") throw new MiraError("Reserved validation selector " + identifier,definition.origin);
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

    public function globalsOf(modulePath:Null<String>):Array<String> {
        final key = modulePath == null ? "" : modulePath;
        if (!scopedGlobals.exists(key))
            scopedGlobals.set(key,[for (name in globals) if (ModuleIdentity.owner(name) == modulePath) name]);
        return scopedGlobals.get(key);
    }

    public function resolvedName(name:String):String
        return resolvedValues.exists(name) ? resolvedValues.get(name) : name;

    public function resolvedSelector(selector:String):String
        return resolvedSelectors.exists(selector) ? resolvedSelectors.get(selector) : selector;

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
