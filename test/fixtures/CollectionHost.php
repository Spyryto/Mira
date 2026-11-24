<?php
declare(strict_types=1);

// PHP equivalents of the tiny host collection capabilities.
// Reducers and record calculations remain authored in Mira.
function makeCollectionHost(): array {
    $filter = static function($items, $callback) {
        if (!is_array($items) || !is_callable($callback) || count($items) > 10000) {
            throw new RuntimeException('filter:with: expects a bounded list and predicate');
        }
        return array_values(array_filter($items, $callback));
    };
    $map = static function($items, $callback) {
        if (!is_array($items) || !is_callable($callback) || count($items) > 10000) {
            throw new RuntimeException('map:with: expects a bounded list and function');
        }
        return array_map($callback, $items);
    };
    return [
        'get:from:' => static function($key, $record) {
            if (!is_string($key) || !is_array($record) || !array_key_exists($key, $record)) {
                throw new RuntimeException('Missing record field: ' . strval($key));
            }
            return $record[$key];
        },
        'filter:with:' => $filter,
        'select:with:' => $filter,
        'select:if:' => $filter,
        'collect:if:' => $filter,
        'map:with:' => $map,
        'collect:with:' => $map,
        'fold:with:from:' => static function($items, $callback, $seed) {
            if (!is_array($items) || !is_callable($callback) || count($items) > 10000) {
                throw new RuntimeException('fold:with:from: expects a bounded list and function');
            }
            return array_reduce($items, $callback, $seed);
        }
    ];
}
