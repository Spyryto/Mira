package mira.types;

import mira.MiraError;
import mira.types.ScalarRules.ScalarRule;

// Temporary attachment of the standard GUI ABI to a Mira data resource.
// The property vocabulary and all scalar constraints live in the resource.
class GuiStyleRules {
    static var rules:Null<Map<String,ScalarRule>>;

    public static function get(key:String):Null<ScalarRule> {
        if (rules == null) {
            final source = haxe.Resource.getString("lib/gui-style-contract.mira");
            if (source == null) throw new MiraError("Missing standard GUI style contract");
            rules = ScalarRules.readRecord(source,"style rules");
        }
        return rules.get(key);
    }
}
