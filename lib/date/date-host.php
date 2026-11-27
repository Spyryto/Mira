<?php
declare(strict_types=1);
namespace Mira\Dates;

class DateFault extends \InvalidArgumentException {}

$utc = new \DateTimeZone('UTC');
$parse = static function ($text) use ($utc): ?\DateTimeImmutable {
    if (!is_string($text) || strlen($text) !== 10 || !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D', $text) || str_starts_with($text, '0000-')) return null;
    $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $text, $utc);
    return $date !== false && $date->format('Y-m-d') === $text ? $date : null;
};
$checked = static function ($text) use ($parse): \DateTimeImmutable {
    $date = $parse($text);
    if ($date === null) throw new DateFault('invalid_date');
    return $date;
};
$legacy = [
    'native valid date' => static fn($text): bool => $parse($text) !== null,
    'native checked date' => static function ($text) use ($checked): string { $checked($text); return $text; },
    'native weekday' => static fn($text): int => (int)$checked($text)->format('N'),
    'native add days:to:' => static function ($count, $text) use ($checked): string {
        $date = $checked($text);
        if ((!is_int($count) && !is_float($count)) || !is_finite((float)$count) || floor((float)$count) !== (float)$count || abs($count) > 3652058) {
            throw new DateFault('invalid_day_count');
        }
        $days = (int)$count;
        $next = $date->modify(sprintf('%+d days', $days));
        if ($next === false || (int)$next->format('Y') < 1 || (int)$next->format('Y') > 9999) throw new DateFault('date_out_of_range');
        return $next->format('Y-m-d');
    },
    'native days between:and:' => static fn($first, $last): int => (int)$checked($first)->diff($checked($last))->format('%r%a'),
];

$attempt = static function (callable $action): array {
    try { return ['values' => [$action()], 'error' => '']; }
    catch (DateFault $e) { return ['values' => [], 'error' => $e->getMessage()]; }
};
return $legacy + [
    'native try checked date' => static fn($text) => $attempt(static fn() => $legacy['native checked date']($text)),
    'native try add days:to:' => static fn($count,$text) => $attempt(static fn() => $legacy['native add days:to:']($count,$text))
];
