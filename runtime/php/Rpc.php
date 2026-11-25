<?php
declare(strict_types=1);
namespace Mira\Rpc;

final class Fault extends \RuntimeException {
    public function __construct(public readonly int $status, public readonly string $kind) {
        if ($status < 400 || $status > 499 || !preg_match('/^[a-z][a-z0-9_]{0,63}$/D', $kind)) {
            throw new \InvalidArgumentException('Invalid RPC fault');
        }
        parent::__construct($kind);
    }
}

// PHP represents Mira records as associative arrays. Empty records and numeric
// keys cannot round-trip faithfully, so the portable wire subset rejects them.
function fromWire(mixed $value): mixed {
    if ($value instanceof \stdClass) {
        $fields = get_object_vars($value);
        if (!$fields) throw new Fault(400, 'empty_record');
        foreach ($fields as $key => $item) {
            if (!is_string($key) || preg_match('/^-?\d+$/D', $key)) throw new Fault(400, 'numeric_key');
            $fields[$key] = fromWire($item);
        }
        return $fields;
    }
    if (is_array($value)) return array_map(__NAMESPACE__ . '\\fromWire', $value);
    if (is_int($value) && abs($value) > 9007199254740991) throw new Fault(400, 'unsafe_number');
    if (is_float($value) && (!is_finite($value) || (floor($value) === $value && abs($value) > 9007199254740991))) throw new Fault(400, 'unsafe_number');
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

// A deliberately small wire schema, not the Mira type system.
function checkParams(mixed $params, array $schema): array {
    if (!is_array($params) || array_is_list($params)) throw new Fault(400, 'invalid_parameters');
    foreach ($schema as $field) {
        $name = $field['name'];
        $value = $params[$name] ?? null;
        if (!is_int($value) || $value < $field['min'] || $value > $field['max']) {
            throw new Fault(400, 'invalid_' . $name);
        }
    }
    if (count($params) !== count($schema)) throw new Fault(400, 'invalid_parameters');
    return $params;
}

// Interpret the compiler's closed data schema. No coercion, no evaluation.
function matchesType(mixed $value, array $type, int $depth = 0): bool {
    if ($depth > 30) return false;
    switch ($type['kind'] ?? null) {
        case 'Number':
            return (is_int($value) || is_float($value)) && is_finite((float)$value)
                && (floor((float)$value) !== (float)$value || abs($value) <= 9007199254740991);
        case 'Text': return is_string($value);
        case 'Boolean': return is_bool($value);
        case 'List':
            if (!is_array($value) || !array_is_list($value)) return false;
            foreach ($value as $item) if (!matchesType($item, $type['item'], $depth + 1)) return false;
            return true;
        case 'Record':
            if (!is_array($value) || array_is_list($value) || $type['tail'] !== null
                || count($value) !== count($type['fields'])) return false;
            foreach ($type['fields'] as $field) {
                $name = $field['name'];
                if (!array_key_exists($name, $value) || !matchesType($value[$name], $field['type'], $depth + 1)) return false;
            }
            return true;
        default: return false;
    }
}

// Policy is checked first to preserve the existing specific 400 error codes.
// A bad return is an internal server error, never a successful reply.
function invokeTyped(callable $handler, mixed $params, array $contract): mixed {
    $params = checkParams($params, $contract['integerPolicy']);
    if (!matchesType($params, $contract['parameters'])) throw new Fault(400, 'invalid_parameters');
    $result = $handler($params);
    if (!matchesType($result, $contract['result'])) throw new \RuntimeException('RPC result violates inferred type');
    return $result;
}

// No lookup of arbitrary PHP functions. The host explicitly registers names.
function serve(array $methods): never {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    try {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            header('Allow: POST');
            throw new Fault(405, 'method_not_allowed');
        }
        if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') throw new Fault(415, 'expected_json');
        $raw = file_get_contents('php://input', false, null, 0, 16385);
        if ($raw === false || strlen($raw) > 16384) throw new Fault(413, 'request_too_large');
        try { $request = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
        catch (\JsonException $e) { throw new Fault(400, 'invalid_json'); }
        if (!$request instanceof \stdClass || !is_string($request->method ?? null) ||
            !property_exists($request, 'params') || count(get_object_vars($request)) !== 2) throw new Fault(400, 'invalid_request');
        if (!array_key_exists($request->method, $methods)) throw new Fault(404, 'unknown_method');
        $result = $methods[$request->method](fromWire($request->params));
        $body = json_encode(['ok'=>true, 'value'=>toWire($result)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        if (strlen($body) > 262144) throw new \RuntimeException('RPC response too large');
        http_response_code(200);
    } catch (Fault $error) {
        http_response_code($error->status);
        $body = json_encode(['ok'=>false, 'error'=>['code'=>$error->kind]], JSON_THROW_ON_ERROR);
    } catch (\Throwable $error) {
        error_log((string)$error);
        http_response_code(500);
        $body = '{"ok":false,"error":{"code":"internal_error"}}';
    }
    echo $body;
    exit;
}
