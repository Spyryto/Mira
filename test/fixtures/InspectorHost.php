<?php
declare(strict_types=1);

// A reference PHP array of callables. Metrics are computed only in Mira.
require_once __DIR__ . '/CollectionHost.php';

function makeInspectorHost(array $ast): array {
    return array_merge(makeCollectionHost(), [
        'ast tree' => $ast,
        'node:is:' => static fn($item, $kind) => ($item['kind'] ?? null) === $kind ? 1 : 0,
        'fold:with:from:' => static function($root, $reducer, $initial) {
            if (is_array($root) && array_is_list($root)) {
                return array_reduce($root, $reducer, $initial);
            }
            $stack = [$root];
            $accumulator = $initial;
            $visits = 0;
            while (count($stack)) {
                $node = array_pop($stack);
                if (!is_array($node)) continue;
                if (++$visits > 10000) {
                    throw new RuntimeException('AST inspector node limit exceeded');
                }
                $accumulator = $reducer($accumulator, $node);
                $children = match ($node['kind'] ?? '') {
                    'Program' => $node['definitions'] ?? [],
                    'Function', 'Value', 'ExpressionStatement' => isset($node['body']) ? [$node['body']] : [],
                    'Binary' => [$node['left'], $node['right']],
                    'Conditional' => [$node['condition'], $node['whenTrue'], $node['whenFalse']],
                    'Call', 'Section', 'HostCall', 'HostSection' => $node['arguments'] ?? [],
                    'Apply' => [$node['callee'], $node['argument']],
                    'Sequence' => $node['items'] ?? [],
                    'Record' => array_map(static fn($field) => $field['value'], $node['fields'] ?? []),
                    default => []
                };
                for ($i = count($children) - 1; $i >= 0; $i--) $stack[] = $children[$i];
            }
            return $accumulator;
        },
        'log' => static function($message): void { echo $message, "\n"; }
    ]);
}
