package mira.syntax;

import mira.MiraError;
import mira.lex.Token;
import mira.lex.Token.TokenKind;
import mira.resolve.SelectorResolver;
import mira.resolve.Symbols;
import mira.resolve.Mangle;
import mira.types.Type;

class ExpressionParser {
    final tokens:Array<Token>;
    final symbols:Symbols;
    final selectorResolver:SelectorResolver;
    final localNames:Array<String>;
    // Names declared later in the enclosing block are kept out of the
    // lexical scope, but allow a precise forward-reference diagnostic.
    final pendingLocals:Array<String>;
    var position:Int = 0;
    var operatorDepth:Int = 0;
    final allowOperatorArgument:Bool;
    final origins:Null<ExpressionOrigins>;
    final types:Map<String,Type>;

    public function new(tokens:Array<Token>, symbols:Symbols, localNames:Array<String>,
        ?allowOperatorArgument:Bool = false, ?pendingLocals:Array<String>, ?origins:ExpressionOrigins, ?types:Map<String,Type>) {
        this.origins = origins;
        this.types = types == null ? new Map<String,Type>() : types;
        this.tokens = tokens.copy();
        final last = tokens.length > 0 ? tokens[tokens.length - 1] : new Token(End, "", 1, 1);
        this.tokens.push(new Token(End, "", last.line, last.column, last.file));
        this.symbols = symbols;
        this.localNames = localNames;
        this.pendingLocals = pendingLocals == null ? [] : pendingLocals;
        this.allowOperatorArgument = allowOperatorArgument;
        this.selectorResolver = new SelectorResolver(symbols);
    }

    inline function at(expr:Expr, token:Token):Expr {
        return origins == null ? expr : origins.remember(expr,token);
    }

    public function parse():Expr {
        if (allowOperatorArgument && tokens[1].kind == End && isOperatorValue(current())) {
            return operatorValue(consume());
        }
        final parsed = expression();
        final result = allowOperatorArgument ? sectionify(parsed) : parsed;
        if (current().kind != End) {
            throw new MiraError("Unexpected token " + current().value, current());
        }
        return result;
    }

    function expression():Expr {
        var left = conjunction();
        while (current().isSymbol("OR")) {
            final token = consume();
            left = at(Binary("OR",left,conjunction()),token);
        }
        return left;
    }

    function conjunction():Expr {
        var left = negation();
        while (current().isSymbol("AND")) {
            final token = consume();
            left = at(Binary("AND",left,negation()),token);
        }
        return left;
    }

    function negation():Expr {
        if (current().isSymbol("NOT")) {
            final token = consume();
            return at(Conditional(negation(),BooleanLiteral(false),BooleanLiteral(true)),token);
        }
        return nonBooleanExpression();
    }

    static function isOperatorValue(token:Token):Bool {
        return token.kind == Symbol && (token.value == "NOT" || token.value == "AND" || token.value == "OR"
            || (token.value != ">>" && isOperator(token.value)));
    }

    function operatorValue(token:Token):Expr {
        return token.value == "NOT"
            ? at(Block(["_"],Conditional(Name("_"),BooleanLiteral(false),BooleanLiteral(true))),token)
            : at(OperatorSection(token.value,Placeholder,Placeholder),token);
    }

    function nonBooleanExpression():Expr {
        var left:Expr;
        // () is syntax for zero arguments only, not a primary/value.
        if (current().isSymbol("(") && tokens[position + 1].isSymbol(")")) {
            final opening = consume();
            consume();
            if (!current().isSymbol(">>")) {
                throw new MiraError("Expected expression: Empty () is only allowed before >>", opening);
            }
            final token = consume();
            final callee = fieldAccess();
            validatePipeline(callee, 0, token);
            left = at(Apply(callee, null),token);
        } else {
            left = fieldAccess();
        }

        // Arithmetic, comparisons, and >> keep their existing
        // left-to-right grouping. Only ~ binds more tightly.
        while (current().kind == Symbol && isOperator(current().value)) {
            final token = consume();
            final right = fieldAccess();
            if (token.value == ">>") {
                validatePipeline(right, 1, token);
                left = at(Apply(right, left),token);
            } else {
                left = at(Binary(token.value, left, right),token);
            }
        }
        return left;
    }

    static function validatePipeline(callee:Expr, arity:Int, token:Token):Void {
        final expected = arity == 0 ? "zero-argument" : "unary";
        switch (callee) {
            case Section(_, args) | HostSection(_, args):
                var holes = 0;
                for (arg in args) if (isPlaceholder(arg)) holes++;
                if (holes != arity) {
                    throw new MiraError("Pipeline needs a " + expected + " section; this section has "
                        + holes + " holes", token);
                }
            case OperatorSection(_, sectionLeft, sectionRight):
                final holes = (isPlaceholder(sectionLeft) ? 1 : 0)
                    + (isPlaceholder(sectionRight) ? 1 : 0);
                if (holes != arity) {
                    throw new MiraError("Pipeline needs a " + expected + " operator section; this section has "
                        + holes + " holes", token);
                }
            case Block(parameters, _):
                if (parameters.length != arity) {
                    throw new MiraError("Pipeline needs a " + expected + " block; this block has "
                        + parameters.length + " parameters", token);
                }
            case Numeric(_) | Text(_) | BooleanLiteral(_) | Binary(_, _, _) | Placeholder
                | FieldGet(_, _) | OptionalFieldGet(_,_,_):
                throw new MiraError("Pipeline target must be a function", token);
            case FieldSection(_) | FieldAccessor(_):
                if (arity == 0) throw new MiraError("Pipeline needs a unary argument for a field accessor", token);
            default:
        }
    }

    // A field lookup is a postfix operator: a ~ b ~ c means
    // (a ~ b) ~ c, and it binds before all arithmetic operators.
    function fieldAccess():Expr {
        var left = application();
        while (current().isSymbol("~") || current().isSymbol("~?")) {
            final op = consume();
            final keyToken = current();
            final key = literalKey("Expected a field name after " + op.value);
            if (op.value == "~?") {
                final template = types.get("Option");
                switch (template) {
                    case SumType(_,alternatives,[Variable(id)]) if (id < 0 && Lambda.count(alternatives) == 2 && alternatives.exists("None") && alternatives.get("None") == null):
                        switch (alternatives.get("Some")) {
                            case Variable(slot) if (slot == id):
                                left = at(OptionalFieldGet(left,key,template),keyToken);
                            default: throw new MiraError("Safe field access requires Option (T) :: Some (T) | None",op);
                        }
                    default: throw new MiraError("Safe field access requires Option (T) :: Some (T) | None",op);
                }
            } else left = at(FieldGet(left,key),keyToken);
        }
        return left;
    }

    // Juxtaposition is unary function application: log "hello", double (x).
    // It never consumes operators and never consults inferred types.
    function application():Expr {
        var callee = primary();
        while (startsPrimary(current()) && isPotentialCallable(callee)) {
            switch (callee) {
                case Block(parameters, _) if (parameters.length == 0):
                    throw new MiraError("Zero-argument block requires () >>", current());
                default:
            }
            final argumentToken = current();
            final argument = primary();
            callee = at(Apply(callee, argument),argumentToken);
        }
        return callee;
    }

    static function startsPrimary(token:Token):Bool {
        return token.kind == Word || token.kind == Number || token.kind == Text
            || token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{");
    }

    static function isPotentialCallable(expr:Expr):Bool {
        return switch (expr) {
            case Name(_) | HostRef(_) | Call(_, _) | HostCall(_, _) | Section(_, _)
                | HostSection(_, _) | OperatorSection(_, _, _) | FieldSection(_)
                | Block(_, _) | Apply(_, _): true;
            default: false;
        };
    }

    function primary():Expr {
        final token = current();
        if (token.isSymbol("[")) return at(sequence(),token);
        if (token.isSymbol("{")) return at(isBlockStart() ? block() : record(),token);
        if (token.isSymbol("(")) {
            consume();
            if (current().isSymbol(")")) throw new MiraError("Expected expression: Empty () is only allowed before >>", token);
            if (isOperatorValue(current()) && tokens[position+1].isSymbol(")")) {
                final op = consume();
                consume();
                return operatorValue(op);
            }
            operatorDepth++;
            final inner = expression();
            operatorDepth--;
            if (!current().isSymbol(")")) throw new MiraError("Expected closing )", current());
            consume();
            return sectionify(inner);
        }
        if (token.kind == Number) {
            consume();
            return at(Numeric(token.value),token);
        }
        if (token.kind == Text) {
            consume();
            return at(Text(token.value),token);
        }
        if (token.kind != Word) throw new MiraError("Expected expression", token);
        // Native, typed-independent Boolean/record features; no host dispatch.
        if (token.value == "true" || token.value == "false") {
            consume();
            return at(BooleanLiteral(token.value == "true"),token);
        }
        if (token.value == "field" && tokens[position + 1].kind == Text) {
            consume(); // field
            final key = consume().value;
            return at(FieldAccessor(key),token);
        }
        if (token.value == "match" && tokens[position + 1].isSymbol(":")) {
            final opening = matchOpening(position + 2);
            if (opening >= 0) return at(matchExpression(opening),token);
        }
        if (token.value == "validate" && tokens[position + 1].isSymbol(":")) return at(validation(),token);
        if (token.value == "if" && (tokens[position + 1].isSymbol(":")
            || tokens[position + 1].isSymbol("("))) {
            return at(conditional(),token);
        }
        if (token.value == "_") {
            // Inside an explicit {_ | body} block, every _ is the SAME
            // lexical variable, not a new implicit section parameter.
            if (localNames.indexOf("_") >= 0) {
                consume();
                return at(Name("_"),token);
            }
            if (operatorDepth > 0 || allowOperatorArgument) {
                consume();
                return Placeholder;
            }
            throw new MiraError("Placeholder '_' must be a complete keyword-selector argument", token);
        }

        final matched = selectorResolver.match(tokens, position);
        if (matched != null) {
            position = matched.end;
            final args:Array<Expr> = [];
            var holes = 0;
            for (argumentTokens in matched.arguments) {
                if (argumentTokens.length == 1 && argumentTokens[0].kind == Word
                    && argumentTokens[0].value == "_") {
                    args.push(Placeholder);
                    holes++;
                } else {
                    args.push(new ExpressionParser(argumentTokens, symbols, localNames,
                        true, pendingLocals, origins,types).parse());
                }
            }
            if (symbols.isHostSelector(matched.selector)) {
                return at(holes == 0 ? HostCall(matched.selector, args)
                    : HostSection(matched.selector, args),token);
            }
            final selector = symbols.resolvedSelector(matched.selector);
            return at(holes == 0 ? Call(selector, args) : Section(selector, args),token);
        }

        final name = symbols.resolveName(tokens, position, localNames);
        if (name != null) {
            position += name.split(" ").length;
            // Local parameter shadows an external name if explicitly present.
            if (localNames.indexOf(name) == -1 && symbols.isHostName(name)) {
                return at(HostRef(name),token);
            }
            return at(Name(localNames.indexOf(name) >= 0 ? name : symbols.resolvedName(name)),token);
        }
        for (future in pendingLocals) {
            if (Symbols.matchesWords(tokens, position, future)) {
                throw new MiraError("Local value '" + future
                    + "' used before its declaration", token);
            }
        }
        throw new MiraError(
            "Unknown identifier or incomplete selector; register host names explicitly",
            token
        );
    }

    // Like keyword selectors, ':' and ',' are optional separators.
    // All forms lower to the same native, lazy Conditional AST:
    // if: (test), then: (yes), else: (no)
    // if (test), then: (yes), else: (no)
    // if (test) then yes else no
    // Parenthesize nested conditionals to make boundaries unambiguous.
    function conditional():Expr {
        consume(); // if
        optionalSymbol(":");
        final predicate = parenthesizedBranch("if");
        optionalSymbol(",");
        requireWord("then");
        optionalSymbol(":");

        final start = position;
        var depth = 0;
        while (current().kind != End) {
            final token = current();
            if (depth == 0 && token.kind == Word && token.value == "else") break;
            if (depth == 0 && token.isSymbol(",")
                && tokens[position + 1].kind == Word && tokens[position + 1].value == "else") break;
            if (depth == 0 && (token.isSymbol(";") || token.isSymbol(")")
                || token.isSymbol("]") || token.isSymbol("}"))) break;
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) {
                depth++;
            } else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) {
                depth--;
            }
            consume();
        }
        if (start == position) throw new MiraError("Expected then expression", current());
        final whenTrue = new ExpressionParser(tokens.slice(start, position), symbols,
            localNames, allowOperatorArgument, pendingLocals, origins,types).parse();

        optionalSymbol(",");
        requireWord("else");
        optionalSymbol(":");
        if (current().kind == End || current().isSymbol(";") || current().isSymbol(",")
            || current().isSymbol(")") || current().isSymbol("]") || current().isSymbol("}")) {
            throw new MiraError("Expected else expression", current());
        }
        final whenFalse = expression();
        return Conditional(predicate, whenTrue, whenFalse);
    }

    // Contextual syntax only. A top-level brace after a nonempty
    // scrutinee introduces match branches. A comma ends a normal
    // selector argument; braces inside parentheses remain ordinary data.
    function matchOpening(start:Int):Int {
        var depth = 0;
        for (i in start...tokens.length) {
            final token = tokens[i];
            if (token.kind == End) break;
            if (depth == 0) {
                if (token.isSymbol("{") && i > start) return i;
                if (token.isSymbol(",") || token.isSymbol(";") || token.isSymbol(")")
                    || token.isSymbol("]") || token.isSymbol("}")) break;
            }
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) depth++;
            else if (token.isSymbol(")") || token.isSymbol("]") || token.isSymbol("}")) depth--;
        }
        return -1;
    }

    function matchExpression(opening:Int):Expr {
        final input = new ExpressionParser(tokens.slice(position+2,opening),symbols,
            localNames.copy(),false,pendingLocals.copy(),origins,types).parse();
        position = opening + 1;
        final tags:Array<String> = [];
        final handlers:Array<Expr> = [];
        while (true) {
            final anchor = current();
            final label = literalKey("Expected match alternative");
            if (!~/^[a-z][A-Za-z0-9_]*( [A-Za-z_][A-Za-z0-9_]*)*$/.match(label))
                throw new MiraError("Match alternative must start with a lowercase letter",anchor);
            final tag = label.charAt(0).toUpperCase() + label.substr(1);
            if (tags.indexOf(tag) >= 0) throw new MiraError("Duplicate match alternative " + label,anchor);
            requireSymbol(":");
            if (!current().isSymbol("{") || !isBlockStart())
                throw new MiraError("Match alternative requires a block",current());
            final handlerOrigin = current();
            final handler = at(block(),handlerOrigin);
            tags.push(tag);
            handlers.push(handler);
            if (current().isSymbol("}")) break;
            requireSymbol(",");
        }
        requireSymbol("}");
        return Match(input,tags,handlers);
    }

    // Explicit validation: the type operand is syntax, never a runtime value.
    function validation():Expr {
        consume(); // validate
        requireSymbol(":");
        final value = parenthesizedBranch("validate");
        requireSymbol(",");
        requireWord("as");
        requireSymbol(":");
        final anchor = current();
        requireSymbol("(");
        final start = position;
        var depth = 1;
        while (current().kind != End && depth > 0) {
            if (current().isSymbol("(")) depth++;
            if (current().isSymbol(")")) depth--;
            if (depth > 0) consume();
        }
        if (depth != 0) throw new MiraError("Unclosed validation type",anchor);
        final required = new TypeParser(tokens.slice(start,position),anchor,types).parse();
        consume();
        if (mira.types.NumericRange.ofType(required) == null && mira.types.TextChoices.ofType(required) == null && mira.grammar.GrammarMachine.ofType(required) == null)
            throw new MiraError("Validation currently requires a numeric type or text refinement",anchor);
        // A comma belongs to the long form only if followed by its then label.
        if (!(current().isSymbol(",") && tokens[position+1].kind == Word
            && tokens[position+1].value == "then" && tokens[position+2].isSymbol(":"))) {
            final template = types.get("Result");
            switch (template) {
                case SumType(_,alternatives,[Variable(a),Variable(b)])
                    if (a < 0 && b < 0 && a != b && Lambda.count(alternatives) == 2):
                    switch [alternatives.get("Ok"),alternatives.get("Err")] {
                        case [Variable(x),Variable(y)] if (x == a && y == b):
                            return ValidateResult(value,required,mira.types.TypeTemplates.apply(template,[required,TextType]));
                        default:
                    }
                default:
            }
            throw new MiraError("Short validation requires Result (T, E) :: Ok (T) | Err (E)",anchor);
        }
        requireSymbol(",");
        requireWord("then");
        requireSymbol(":");
        final success = validationBlock();
        requireSymbol(",");
        requireWord("else");
        requireSymbol(":");
        final failure = validationBlock();
        return Validate(value,required,success,failure);
    }

    function validationBlock():Expr {
        final anchor = current();
        if (!anchor.isSymbol("{") || !isBlockStart())
            throw new MiraError("Validation requires a unary handler block",anchor);
        final result = at(block(),anchor);
        switch (result) {
            case Block(parameters,_) if (parameters.length == 1):
            default: throw new MiraError("Validation requires a unary handler block",anchor);
        }
        return result;
    }

    function optionalSymbol(value:String):Void {
        if (current().isSymbol(value)) consume();
    }

    function parenthesizedBranch(label:String):Expr {
        if (!current().isSymbol("(")) {
            throw new MiraError(label + " requires a parenthesized expression", current());
        }
        consume();
        final branch = expression();
        requireSymbol(")");
        return branch;
    }

    function requireWord(expected:String):Void {
        if (current().kind != Word || current().value != expected) {
            throw new MiraError("Expected " + expected + " branch", current());
        }
        consume();
    }

    function requireSymbol(expected:String):Void {
        if (!current().isSymbol(expected)) {
            throw new MiraError("Expected " + expected, current());
        }
        consume();
    }

    // Data literals are deliberately expression-level constructs, not host APIs.
    // They keep exactly the same meaning on JS and PHP.
    function sequence():Expr {
        consume(); // [
        final items:Array<Expr> = [];
        while (!current().isSymbol("]")) {
            if (current().kind == End) throw new MiraError("Unclosed list literal", current());
            items.push(expression());
            if (current().isSymbol("]")) break;
            if (!current().isSymbol(",")) throw new MiraError("Expected , or ]", current());
            consume();
            if (current().isSymbol("]")) throw new MiraError("Trailing comma in list", current());
        }
        consume(); // ]
        return Sequence(items);
    }

    // An empty or comma-separated sequence of parameter names
    // followed by | distinguishes a block from a record, without guessing.
    function isBlockStart():Bool {
        var cursor = position + 1;
        if (tokens[cursor].isSymbol("|")) return true;
        if (tokens[cursor].kind != Word) return false;
        while (true) {
            cursor = bindingEnd(cursor);
            if (cursor < 0) return false;
            if (tokens[cursor].isSymbol("|")) return true;
            if (!tokens[cursor].isSymbol(",")) return false;
            cursor++;
            if (tokens[cursor].kind != Word) return false;
        }
        return false;
    }

    // A block has zero or more parameters and expressions separated by ';'.
    // Names can have spaces. Repeated _ refers to a single bound parameter.
    function block():Expr {
        consume(); // {
        final parameters:Array<String> = [];
        final annotations:Array<Null<Type>> = [];
        final emitted:Array<String> = [];
        if (!current().isSymbol("|")) while (true) {
            final parameterToken = current();
            final end = bindingEnd(position);
            if (end < 0) throw new MiraError("Expected block parameter",parameterToken);
            final binding = DefinitionParser.annotatedName(tokens.slice(position,end),types);
            position = end;
            final parameter = binding.name;
            annotations.push(binding.type);
            final symbol = Mangle.name(parameter);
            if (symbol == "__miraHost") {
                throw new MiraError("Reserved block parameter __miraHost", parameterToken);
            }
            if (parameters.indexOf(parameter) >= 0 || emitted.indexOf(symbol) >= 0) {
                throw new MiraError("Duplicate or conflicting block parameter " + parameter,
                    parameterToken);
            }
            // Identical names may shadow lexically. Different Mira names must
            // never produce the same JS/PHP variable, or captured references
            // silently refer to the wrong binding.
            for (outer in localNames.concat(symbols.globals)) {
                if (outer != parameter && Mangle.name(outer) == symbol) {
                    throw new MiraError("Generated-name collision for block parameter "
                        + parameter + " with visible name " + outer, parameterToken);
                }
            }
            parameters.push(parameter);
            emitted.push(symbol);
            if (!current().isSymbol(",")) break;
            consume();
        }
        requireSymbol("|");
        final pending = upcomingLocalNames(position);
        for (name in pending) pendingLocals.push(name);
        for (parameter in parameters) localNames.unshift(parameter);
        final expressions:Array<Expr> = [];
        if (current().isSymbol("}")) {
            throw new MiraError("A block needs at least one expression", current());
        }
        final bindings:Array<String> = [];
        final taken = emitted.copy();
        while (true) {
            final nameEnd = localAssignmentEnd();
            if (nameEnd >= 0) {
                final nameToken = current();
                final binding = DefinitionParser.annotatedName(tokens.slice(position,nameEnd),types);
                position = nameEnd;
                final name = binding.name;
                final symbol = Mangle.name(name);
                if (symbol == "__miraHost") {
                    throw new MiraError("Reserved local name __miraHost", nameToken);
                }
                var shadowsOuter = false;
                for (outer in localNames.concat(symbols.globals)) {
                    if (Mangle.name(outer) == symbol) shadowsOuter = true;
                }
                if (taken.indexOf(symbol) >= 0 || shadowsOuter) {
                    throw new MiraError("Duplicate or shadowed local name " + name, nameToken);
                }
                consume(); // =
                if (current().isSymbol(";") || current().isSymbol("}")) {
                    throw new MiraError("Expected value for local " + name, current());
                }
                // The initializer is resolved before this name comes into scope.
                final value = expression();
                final local = at(Expr.Local(name,value),binding.typeOrigin == null ? nameToken : binding.typeOrigin);
                if (origins != null && binding.type != null) origins.annotate(local,[binding.type]);
                expressions.push(local);
                taken.push(symbol);
                localNames.unshift(name);
                bindings.push(name);
                if (current().isSymbol("}")) {
                    throw new MiraError("A block must end with a value expression", current());
                }
                if (!current().isSymbol(";")) {
                    throw new MiraError("Expected ; after local " + name, current());
                }
                consume();
                if (current().isSymbol("}")) {
                    throw new MiraError("A block must end with a value expression", current());
                }
            } else {
                expressions.push(expression());
                if (!current().isSymbol(";")) break;
                consume();
                // A single trailing ';' is allowed after the final expression.
                if (current().isSymbol("}")) break;
            }
        }
        for (_ in bindings) localNames.shift();
        for (_ in parameters) localNames.shift();
        for (_ in pending) pendingLocals.pop();
        requireSymbol("}");
        final body:Expr = expressions.length == 1 ? expressions[0] : Expr.Steps(expressions);
        final block:Expr = Expr.Block(parameters,body);
        if (origins != null) origins.annotate(block,annotations);
        return block;
    }

    // Scan only statement starts at the current brace depth; assignments
    // nested in a child block do not belong to this lexical scope.
    function upcomingLocalNames(start:Int):Array<String> {
        final names:Array<String> = [];
        var cursor = start;
        var depth = 0;
        var startOfStep = true;
        while (cursor < tokens.length && tokens[cursor].kind != End) {
            final token = tokens[cursor];
            if (depth == 0 && token.isSymbol("}")) break;
            if (depth == 0 && startOfStep && token.kind == Word) {
                var end = cursor;
                final words:Array<String> = [];
                while (tokens[end].kind == Word) {
                    words.push(tokens[end].value);
                    end++;
                }
                final binding = bindingEnd(cursor);
                if (binding >= 0 && tokens[binding].isSymbol("=")) names.push(words.join(" "));
            }
            if (token.isSymbol("(") || token.isSymbol("[") || token.isSymbol("{")) {
                depth++;
            } else if (token.isSymbol(")") || token.isSymbol("]")
                || token.isSymbol("}")) {
                depth--;
            }
            if (depth == 0) startOfStep = token.isSymbol(";");
            cursor++;
        }
        return names;
    }

    // Look ahead without interpreting a parenthesized expression as a type.
    // The following '=', ',' or '|' is what establishes binding context.
    function bindingEnd(start:Int):Int {
        var cursor = start;
        if (tokens[cursor].kind != Word) return -1;
        while (tokens[cursor].kind == Word) cursor++;
        if (tokens[cursor].isSymbol("(")) {
            var depth = 0;
            do {
                final token = tokens[cursor++];
                if (token.kind == End) return -1;
                if (token.isSymbol("(")) depth++;
                else if (token.isSymbol(")")) depth--;
            } while (depth > 0 && cursor < tokens.length);
            if (depth != 0 || cursor >= tokens.length) return -1;
        }
        return cursor;
    }

    // Calls and comparisons remain ordinary expressions.
    function localAssignmentEnd():Int {
        final end = bindingEnd(position);
        return end >= 0 && tokens[end].isSymbol("=") ? end : -1;
    }

    function record():Expr {
        consume(); // {
        final keys:Array<String> = [];
        final values:Array<Expr> = [];
        while (!current().isSymbol("}")) {
            final keyToken = current();
            final key = literalKey("Expected record key");
            if (keys.indexOf(key) >= 0) throw new MiraError("Duplicate record key " + key, keyToken);
            if (!current().isSymbol(":")) throw new MiraError("Expected : after record key", current());
            consume();
            keys.push(key);
            values.push(expression());
            if (current().isSymbol("}")) break;
            if (!current().isSymbol(",")) throw new MiraError("Expected , or }", current());
            consume();
            if (current().isSymbol("}")) throw new MiraError("Trailing comma in record", current());
        }
        consume(); // }
        return Record(keys, values);
    }

    // Shared grammar for record literals and ~ field access.
    // Unquoted consecutive words form one literal key, never a variable.
    function literalKey(diagnostic:String):String {
        final first = current();
        if (first.kind == Text) return consume().value;
        if (first.kind != Word) throw new MiraError(diagnostic, first);
        final words:Array<String> = [];
        while (current().kind == Word) words.push(consume().value);
        return words.join(" ");
    }

    function current():Token {
        return tokens[position];
    }

    function consume():Token {
        return tokens[position++];
    }

    // Parenthesized binary expressions can be functions without a new lambda
    // grammar. The holes must be direct operands; grouping stays explicit.
    function sectionify(expr:Expr):Expr {
        final result:Expr = switch (expr) {
            case Binary(symbol, left, right):
                switch ([left, right]) {
                    case [FieldGet(Placeholder, _), _] | [_, FieldGet(Placeholder, _)]:
                        throw new MiraError("Complex placeholders require blocks; use a named function for now", current());
                    default:
                }
                isPlaceholder(left) || isPlaceholder(right)
                    ? OperatorSection(symbol, left, right) : expr;
            case FieldGet(Placeholder, key):
                FieldSection(key);
            case Placeholder:
                throw new MiraError("Placeholder '_' requires an operator section", current());
            default: expr;
        };
        return origins == null ? result : origins.inherit(result,expr);
    }

    static function isPlaceholder(expr:Expr):Bool {
        return switch (expr) {
            case Placeholder: true;
            default: false;
        };
    }

    static function isOperator(value:String):Bool {
        return ["+", "-", "*", "/", "%", ">>", "==", "!=", "<", ">", "<=", ">="].indexOf(value) >= 0;
    }
}
