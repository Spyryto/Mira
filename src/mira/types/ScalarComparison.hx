package mira.types;

// Emission-only fact. No AST change or runtime dictionary.
// Missing fact means the operands may have any ScalarEq representation.
enum ScalarComparison {
    Numeric;
    Strict;
}
