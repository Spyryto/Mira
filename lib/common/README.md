# Common outcomes — Mira 0.89.4

Data / Outcome declares ordinary nominal Option (T) and Result (T,E), with Some/None and Ok/Err. No implicit prelude or new runtime representation. Services / Date Safe and Services / Storage Optional reuse existing service contracts; the lesson-import application uses them with its normal host/provider manifests. Resolve logical sources from the composed Studio project. No duplicate adapter, no storage schema change.

try date from: returns Result (Date, Text) and uses valid date: before date from:. The existing Date host may parse twice. find text: returns Option (Text) by folding the existing zero/one list; Some("") differs from None. I/O exceptions propagate, not converted to absence. Save/remove and date arithmetic remain as before. The lesson decoder uses the same shared Result identity with its contract-generated structural host envelope. Older services are unchanged; general error migration and multifile CLI composition remain open.

## 0.89.6

Services / Date Safe is now an independent contract with a selected native provider and nominal Date Error. It replaces the earlier Text error signature (pre-1.0); callers must match Date Error or use date error code:. Both try date from: and try add days:to: preserve the existing opaque Services / Date / Date identity. The host returns only a private structural envelope. The safe provider reconstructs through date from:, so successful results are parsed again; avoiding that requires a better typed boundary or a change to the original Date contract. No new calendar implementation. The original Services / Date API remains unchanged.

## 0.89.7

Data / Decoder Outcome provides decoded result:, a generic converter from the trusted decoder envelope {values: [T], error: Text} to Result (T, Text). Both JSON providers reuse it. The zero/one list invariant belongs to the adapter; this helper is not a general wire validator. No new runtime primitive. CLI library consumers can use --module-root lib/common; additional logical roots must not contain competing modules of the same identity.
