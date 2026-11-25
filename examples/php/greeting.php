<?php
declare(strict_types=1);
// Compile ../greeting-service.mira to greeting-program.php alongside this file.
require __DIR__ . '/greeting-program.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo '{"error":"Expected POST"}';
    exit;
}
try {
    $body = file_get_contents('php://input', false, null, 0, 16385);
    if ($body === false || strlen($body) > 16384) {
        http_response_code(413);
        echo '{"error":"Request too large"}';
        exit;
    }
    $input = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($input) || !is_int($input['id'] ?? null) ||
        $input['id'] < 0 || $input['id'] > 9007199254740991 ||
        !is_string($input['name'] ?? null) || strlen($input['name']) > 120) {
        throw new InvalidArgumentException('Invalid request');
    }
    echo json_encode(greet($input), JSON_THROW_ON_ERROR);
} catch (JsonException | InvalidArgumentException $e) {
    http_response_code(400);
    echo '{"error":"Invalid request"}';
}
