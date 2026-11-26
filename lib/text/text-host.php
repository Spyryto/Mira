<?php
declare(strict_types=1);
// Validate Unicode scalar text at the host boundary, without mbstring.
$text = static function ($value): string {
    if (!is_string($value) || preg_match('//u', $value) !== 1) {
        throw new InvalidArgumentException('Expected valid Unicode Text');
    }
    return $value;
};
return [
    'native code points' => static function ($value) use ($text): int {
        $count = preg_match_all('/./us', $text($value));
        if ($count === false) throw new RuntimeException('Unicode count failed');
        return $count;
    },
    'native contains:in:' => static fn($needle, $value): bool => str_contains($text($value), $text($needle)),
    'native starts with:in:' => static fn($prefix, $value): bool => str_starts_with($text($value), $text($prefix)),
    'native ends with:in:' => static fn($suffix, $value): bool => str_ends_with($text($value), $text($suffix)),
];
