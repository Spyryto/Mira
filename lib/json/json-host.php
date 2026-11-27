<?php
declare(strict_types=1);
namespace Mira\Json;
require_once __DIR__ . '/../../runtime/php/TypedData.php';

function host(array $binding): array {
    $schema = $binding['schema'];
    $decode = static fn($source) => \Mira\TypedData\decodeJson($source,$schema);
    $capabilities = [$binding['capability'] => $decode];
    if (isset($binding['fallibleCapability'])) {
        $capabilities[$binding['fallibleCapability']] = static function ($source) use ($decode): array {
            try { return ['values'=>[$decode($source)], 'error'=>'']; }
            catch (\Mira\TypedData\DataFault $error) {
                return ['values'=>[], 'error'=>'invalid_json_data'];
            }
        };
    }
    return $capabilities;
}
