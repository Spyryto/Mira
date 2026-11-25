<?php
declare(strict_types=1);
// Local integration example: no public authentication or multi-user isolation.
require __DIR__ . '/../private/ledger-program.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Expected POST']);
}
if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
    respond(415, ['error' => 'Expected application/json']);
}
$raw = file_get_contents('php://input', false, null, 0, 16385);
if ($raw === false || strlen($raw) > 16384) respond(413, ['error' => 'Request too large']);
try { $cmd = json_decode($raw, true, 32, JSON_THROW_ON_ERROR); }
catch (JsonException $e) { respond(400, ['error' => 'Invalid JSON']); }
$action = is_array($cmd) ? ($cmd['action'] ?? null) : null;
if (!in_array($action, ['load', 'add', 'hours', 'paid', 'remove'], true)) respond(400, ['error' => 'Invalid action']);
if ($action !== 'load' && (!is_int($cmd['revision'] ?? null) || $cmd['revision'] < 0)) respond(400, ['error' => 'Invalid revision']);
if ($action === 'add' && (!is_string($cmd['student'] ?? null) || trim($cmd['student']) === '' || strlen($cmd['student']) > 120)) respond(400, ['error' => 'Invalid student']);
if (in_array($action, ['hours', 'paid', 'remove'], true) && (!is_int($cmd['id'] ?? null) || $cmd['id'] < 1)) respond(400, ['error' => 'Invalid id']);

$db = null; $transaction = false;
try {
    $db = new PDO('sqlite:' . __DIR__ . '/../private/ledger.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout = 3000');
    $db->exec('CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL)');
    $db->exec('BEGIN IMMEDIATE');
    $transaction = true;
    $db->prepare('INSERT OR IGNORE INTO ledger VALUES (1, ?)')->execute([json_encode(['revision'=>0, 'next id'=>1, 'lessons'=>[]])]);
    $model = json_decode($db->query('SELECT snapshot FROM ledger WHERE id = 1')->fetchColumn(), true, 32, JSON_THROW_ON_ERROR);
    $status = 200;
    $result = $model;
    if ($action !== 'load' && $cmd['revision'] !== $model['revision']) {
        $status = 409; $result = ['error'=>'Revision conflict; reload'];
    } elseif ($action === 'add' && count($model['lessons']) >= 100) {
        $status = 422; $result = ['error'=>'Maximum 100 lessons'];
    } elseif (in_array($action, ['hours','paid','remove'], true)) {
        $item = null;
        foreach ($model['lessons'] as $lesson) if ($lesson['id'] === $cmd['id']) { $item = $lesson; break; }
        if ($item === null) { $status = 404; $result = ['error'=>'Unknown lesson']; }
        elseif ($action === 'hours' && $item['hours'] >= 10000) { $status = 422; $result = ['error'=>'Maximum hours']; }
    }
    if ($status === 200 && $action !== 'load') {
        // All business transformations are in the compiled Mira function.
        $result = applyCommand__command($model, $cmd);
        $db->prepare('UPDATE ledger SET snapshot = ? WHERE id = 1')->execute([json_encode($result, JSON_THROW_ON_ERROR)]);
    }
    $db->exec('COMMIT'); $transaction = false;
    respond($status, $result);
} catch (Throwable $error) {
    if ($transaction) $db->exec('ROLLBACK');
    error_log((string)$error);
    respond(500, ['error'=>'Storage unavailable']);
}
