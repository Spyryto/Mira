<?php
declare(strict_types=1);
namespace Mira\Json;
require_once __DIR__ . '/../../runtime/php/Rpc.php';

function host(array $binding): array {
    $schema = $binding['schema'];
    $decode = static function ($source) use ($schema) {
        if (!is_string($source) || strlen($source) > 16384) throw new \InvalidArgumentException('invalid_json_data');
        try {
            $raw = json_decode($source, false, 32, JSON_THROW_ON_ERROR);
            $value = \Mira\Rpc\fromWire($raw);
        } catch (\JsonException | \Mira\Rpc\Fault $error) {
            throw new \InvalidArgumentException('invalid_json_data');
        }
        if (!\Mira\Rpc\matchesType($value, $schema)) throw new \InvalidArgumentException('invalid_json_data');
        return $value;
    };
    $capabilities = [$binding['capability'] => $decode];
    if (isset($binding['fallibleCapability'])) {
        $capabilities[$binding['fallibleCapability']] = static function ($source) use ($decode): array {
            try { return ['values'=>[$decode($source)], 'error'=>'']; }
            catch (\InvalidArgumentException $error) {
                if ($error->getMessage() !== 'invalid_json_data') throw $error;
                return ['values'=>[], 'error'=>'invalid_json_data'];
            }
        };
    }
    return $capabilities;
}
