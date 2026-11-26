package mira.types;

import mira.Compiler;
import mira.HostEnvironment;
import mira.MiraError;
import mira.lex.Lexer;
import mira.syntax.ModuleSections;
import mira.syntax.PublicSignature;
import mira.syntax.Definition;
import mira.syntax.ExpressionOrigins;
import mira.resolve.ModuleIdentity;

// A deliberately small first independent contract verifier. Contracts contain
// explicit value and selector signatures, in the existing interface syntax.
// They do not introduce runtime objects, nominal type equations or binding.
class ContractVerifier {
    public static function signatures(contract:String):Array<PublicSignature> {
        final tokens = new Lexer(contract,"<contract>").tokenize();
        final sections = new ModuleSections(tokens,-1,true);
        if (sections.references.length > 0 || sections.imports.length > 0 || sections.typeTokens.length != 1)
            throw new MiraError("Independent contracts currently require explicit value and selector signatures only",tokens[0]);
        if (sections.signatures.length == 0)
            throw new MiraError("Empty independent contract",tokens[0]);
        final names = new Map<String,Type>();
        final required = [for (item in sections.signatures) PublicSignature.read(item,names)];
        final seen = new Map<String,Bool>();
        for (signature in required) {
            if (seen.exists(signature.name)) throw new MiraError("Duplicate contract symbol " + signature.name,signature.origin);
            seen.set(signature.name,true);
        }
        return required;
    }

    public static function verify(source:String,provider:String,contract:String,?host:HostEnvironment,
        ?readModule:String->Null<String>):Dynamic {
        final required = signatures(contract);
        final origins = new ExpressionOrigins();
        final visibility = new TypeVisibility();
        // Parse a fresh program. The verifier never changes the original source
        // or a previously compiled program.
        final program = Compiler.parse(source,host,readModule,null,origins,visibility,null,true);
        final exported = new Map<String,Definition>();
        for (d in program) if (d.modulePath == provider && d.isExported && !d.isStatement)
            exported.set(d.isFunction() ? d.selector() : d.name,d);
        for (signature in required) {
            final identity = ModuleIdentity.qualify(provider,signature.name);
            final d = exported.get(identity);
            if (d == null) throw new MiraError("Contract symbol not publicly defined by " + provider + ": " + signature.name,signature.origin);
            // Reuse the same checking path as explicitly annotated module
            // interfaces; parameter names are irrelevant to the contract.
            signature.apply(d);
        }
        final rows = new TypeChecker(origins,host == null ? HostEnvironment.empty() : host,null,visibility).check(program);
        final byName = new Map<String,Dynamic>();
        for (row in rows) byName.set(row.name,row);
        return {provider:provider,verified:[for (signature in required) {
            name:signature.name,signature:byName.get(ModuleIdentity.qualify(provider,signature.name))
        }]};
    }
}
