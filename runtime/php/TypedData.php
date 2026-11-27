<?php
declare(strict_types=1);
namespace Mira\TypedData;

final class WireFault extends \RuntimeException {}
final class DataFault extends \InvalidArgumentException {}

// PHP represents Mira records as associative arrays. Empty records and numeric
// keys cannot round-trip faithfully, so the portable wire subset rejects them.
function fromWire(mixed $value): mixed {
    if ($value instanceof \stdClass) {
        $fields = get_object_vars($value);
        if (!$fields) throw new WireFault('empty_record');
        foreach ($fields as $key => $item) {
            if (!is_string($key) || preg_match('/^-?\d+$/D', $key)) throw new WireFault('numeric_key');
            $fields[$key] = fromWire($item);
        }
        return $fields;
    }
    if (is_array($value)) return array_map(__NAMESPACE__ . '\\fromWire', $value);
    if (is_int($value) && abs($value) > 9007199254740991) throw new WireFault('unsafe_number');
    if (is_float($value) && (!is_finite($value) || (floor($value) === $value && abs($value) > 9007199254740991))) throw new WireFault('unsafe_number');
    return $value;
}
function toWire(mixed $value, int $depth = 0): mixed {
    if ($depth > 32) throw new \RuntimeException('RPC response depth');
    if (is_array($value)) {
        if (array_is_list($value)) return array_map(fn($item) => toWire($item, $depth + 1), $value);
        $record = [];
        foreach ($value as $key => $item) {
            if (!is_string($key) || preg_match('/^-?\d+$/D', $key)) throw new \RuntimeException('Nonportable response key');
            $record[$key] = toWire($item, $depth + 1);
        }
        return (object)$record;
    }
    if (is_null($value) || is_string($value) || is_bool($value)) return $value;
    if (is_int($value) && abs($value) <= 9007199254740991) return $value;
    if (is_float($value) && is_finite($value) && (floor($value) !== $value || abs($value) <= 9007199254740991)) return $value;
    throw new \RuntimeException('Nonportable RPC result');
}

// Interpret the compiler's closed data schema. No coercion, no evaluation.
function matchesType(mixed $value, array $type, int $depth = 0): bool {
    if ($depth > 30) return false;
    switch ($type['kind'] ?? null) {
        case 'Number':
            return (is_int($value) || is_float($value)) && is_finite((float)$value)
                && (floor((float)$value) !== (float)$value || abs($value) <= 9007199254740991);
        case 'Text': return is_string($value) && preg_match('//u', $value) === 1;
        case 'Boolean': return is_bool($value);
        case 'List':
            if (!is_array($value) || !array_is_list($value)) return false;
            foreach ($value as $item) if (!matchesType($item, $type['item'], $depth + 1)) return false;
            return true;
        case 'Record':
            if (!is_array($value) || array_is_list($value) || $type['tail'] !== null
                || !$type['fields'] || count($value) !== count($type['fields'])) return false;
            foreach ($type['fields'] as $field) {
                $name = $field['name'];
                if (!is_string($name) || preg_match('//u', $name) !== 1 || preg_match('/^-?\d+$/D', $name) || !array_key_exists($name, $value) || !matchesType($value[$name], $field['type'], $depth + 1)) return false;
            }
            return true;
        default: return false;
    }
}

function decodeJson(mixed $source, array $schema): mixed {
    if (!is_string($source) || strlen($source) > 16384) throw new DataFault('invalid_json_data');
    try {
        $value = fromWire(json_decode($source, false, 32, JSON_THROW_ON_ERROR));
    } catch (\JsonException | WireFault $error) {
        throw new DataFault('invalid_json_data');
    }
    if (!matchesType($value, $schema)) throw new DataFault('invalid_json_data');
    return $value;
}

function encodeJson(mixed $value, array $schema): string {
    if (!matchesType($value, $schema)) throw new DataFault('invalid_json_data');
    try {
        $source = json_encode(toWire($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (\JsonException $error) {
        throw new DataFault('invalid_json_data');
    }
    if (strlen($source) > 16384) throw new DataFault('invalid_json_data');
    return $source;
}
