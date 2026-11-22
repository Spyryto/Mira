<?php
declare(strict_types=1);

// A reference PHP array of callables. Metrics are computed only in Mira.
function makeInspectorHost(array $ast): array {
    return [
        'ast tree' => $ast,
        'node:is:' => static fn($item, $kind) => ($item['kind'] ?? null) === $kind ? 1 : 0,
        'fold:with:from:' => static function($root, $reducer, $initial) {
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
                    'Call', 'Section', 'HostCall', 'HostSection' => $node['arguments'] ?? [],
                    'Apply' => [$node['callee'], $node['argument']],
                    default => []
                };
                for ($i = count($children) - 1; $i >= 0; $i--) $stack[] = $children[$i];
            }
            return $accumulator;
        },
        'log' => static function($message): void { echo $message, "\n"; }
    ];
}
