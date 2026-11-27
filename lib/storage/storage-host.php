<?php
declare(strict_types=1);
namespace Mira\Storage;

class StorageInputFault extends \InvalidArgumentException {}
class StorageIoFault extends \RuntimeException {}

// The directory is provisioned by the host and must be private/trusted.
// Keys are not paths; no arbitrary path capability is exposed to Mira.
function files(string $directory): array {
    $root = realpath($directory);
    if ($root === false || !is_dir($root)) throw new \InvalidArgumentException('invalid_directory');
    $path = static function ($key) use ($root): string {
        if (!is_string($key) || !preg_match('/^[a-z][a-z0-9_-]{0,63}$/D', $key)) throw new StorageInputFault('invalid_key');
        return $root . DIRECTORY_SEPARATOR . $key . '.txt';
    };
    $text = static function ($value): string {
        if (!is_string($value) || preg_match('//u', $value) !== 1) throw new StorageInputFault('invalid_text');
        if (strlen($value) > 65536) throw new StorageInputFault('value_too_large');
        return $value;
    };
    $regular = static function (string $file) use ($root): bool {
        // Do not report missing keys when the provisioned directory is gone
        // or inaccessible. This is not a defence against hostile local races.
        clearstatcache();
        if (!is_dir($root) || !is_readable($root) || (DIRECTORY_SEPARATOR === '/' && !is_executable($root)))
            throw new StorageIoFault('storage_failure');
        clearstatcache(true, $file);
        if (is_link($file) || (file_exists($file) && !is_file($file))) throw new StorageIoFault('storage_failure');
        return is_file($file);
    };
    $legacy = [
        'files read text' => static function ($key) use ($path, $text, $regular): array {
            $file = $path($key);
            if (!$regular($file)) return [];
            $value = @file_get_contents($file, false, null, 0, 65537);
            if ($value === false) throw new StorageIoFault('storage_failure');
            return [$text($value)];
        },
        'files save text:for:' => static function ($value, $key) use ($root, $path, $text, $regular): bool {
            $file = $path($key);
            $value = $text($value);
            $regular($file);
            $temporary = @tempnam($root, '.mira-');
            if ($temporary === false) throw new StorageIoFault('storage_failure');
            try {
                if (dirname($temporary) !== $root || @file_put_contents($temporary, $value) !== strlen($value) || !@rename($temporary, $file)) {
                    throw new StorageIoFault('storage_failure');
                }
            } finally {
                if (is_file($temporary)) @unlink($temporary);
            }
            return true;
        },
        'files remove text' => static function ($key) use ($path, $regular): bool {
            $file = $path($key);
            if ($regular($file) && !@unlink($file)) throw new StorageIoFault('storage_failure');
            return true;
        }
    ];
    $attempt = static function (callable $action, bool $read): array {
        try {
            $value = $action();
            return ['values' => $read ? $value : [$value], 'error' => ''];
        } catch (StorageInputFault | StorageIoFault $e) {
            return ['values' => [], 'error' => $e->getMessage()];
        }
    };
    return $legacy + [
        'files try read text' => static fn($key) => $attempt(static fn() => $legacy['files read text']($key), true),
        'files try save text:for:' => static fn($value,$key) => $attempt(static fn() => $legacy['files save text:for:']($value,$key), false),
        'files try remove text' => static fn($key) => $attempt(static fn() => $legacy['files remove text']($key), false)
    ];
}
