<?php
declare(strict_types=1);

// A small reference adapter for the documented Mira extern contract.
// This test adapter does not compute any metrics; Mira reducers do that.
final class MiraHost
{
    private static array $ast = [];

    public static function initialize(array $ast): void
    {
        self::$ast = $ast;
    }

    public static function get(string $name): mixed
    {
        if ($name !== 'ast tree') {
            throw new RuntimeException('Unknown host value: ' . $name);
        }
        return self::$ast;
    }

    public static function call(string $selector, array $arguments): mixed
    {
        if ($selector === 'node:is:') {
            [$node, $kind] = $arguments;
            return ($node['kind'] ?? null) === $kind ? 1 : 0;
        }

        if ($selector !== 'fold:with:from:') {
            throw new RuntimeException('Unknown host selector: ' . $selector);
        }

        [$root, $reducer, $accumulator] = $arguments;
        $stack = [$root];
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
                'Function', 'Value' => isset($node['body']) ? [$node['body']] : [],
                'Binary' => [$node['left'], $node['right']],
                'Call', 'Section' => $node['arguments'] ?? [],
                'Apply' => [$node['callee'], $node['argument']],
                default => []
            };
            for ($i = count($children) - 1; $i >= 0; $i--) {
                $stack[] = $children[$i];
            }
        }
        return $accumulator;
    }
}
