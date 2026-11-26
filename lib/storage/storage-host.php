<?php
declare(strict_types=1);
namespace Mira\Storage;

// The directory is provisioned by the host and must be private/trusted.
// Keys are not paths; no arbitrary path capability is exposed to Mira.
function files(string $directory): array {
    $root = realpath($directory);
    if ($root === false || !is_dir($root)) throw new \InvalidArgumentException('invalid_directory');
    $path = static function ($key) use ($root): string {
        if (!is_string($key) || !preg_match('/^[a-z][a-z0-9_-]{0,63}$/D', $key)) throw new \InvalidArgumentException('invalid_key');
        return $root . DIRECTORY_SEPARATOR . $key . '.txt';
    };
    $text = static function ($value): string {
        if (!is_string($value) || preg_match('//u', $value) !== 1) throw new \InvalidArgumentException('invalid_text');
        if (strlen($value) > 65536) throw new \InvalidArgumentException('value_too_large');
        return $value;
    };
    $regular = static function (string $file): bool {
        clearstatcache(true, $file);
        if (is_link($file) || (file_exists($file) && !is_file($file))) throw new \RuntimeException('storage_failure');
        return is_file($file);
    };
    return [
        'files read text' => static function ($key) use ($path, $text, $regular): array {
            $file = $path($key);
            if (!$regular($file)) return [];
            $value = @file_get_contents($file, false, null, 0, 65537);
            if ($value === false) throw new \RuntimeException('storage_failure');
            return [$text($value)];
        },
        'files save text:for:' => static function ($value, $key) use ($root, $path, $text, $regular): bool {
            $file = $path($key);
            $value = $text($value);
            $regular($file);
            $temporary = @tempnam($root, '.mira-');
            if ($temporary === false) throw new \RuntimeException('storage_failure');
            try {
                if (dirname($temporary) !== $root || @file_put_contents($temporary, $value) !== strlen($value) || !@rename($temporary, $file)) {
                    throw new \RuntimeException('storage_failure');
                }
            } finally {
                if (is_file($temporary)) @unlink($temporary);
            }
            return true;
        },
        'files remove text' => static function ($key) use ($path, $regular): bool {
            $file = $path($key);
            if ($regular($file) && !@unlink($file)) throw new \RuntimeException('storage_failure');
            return true;
        }
    ];
}
