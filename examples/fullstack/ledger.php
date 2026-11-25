<?php
declare(strict_types=1);
// Local integration example: no public authentication or multi-user isolation.
require __DIR__ . '/../private/ledger-program.php';
require __DIR__ . '/../private/Rpc.php';

use Mira\Rpc\Fault;
use function Mira\Rpc\serve;

function ledgerCommand(mixed $cmd): array {
    $action = is_array($cmd) ? ($cmd['action'] ?? null) : null;
    if (!in_array($action, ['load', 'add', 'hours', 'paid', 'remove'], true)) throw new Fault(400, 'invalid_action');
    if ($action !== 'load' && (!is_int($cmd['revision'] ?? null) || $cmd['revision'] < 0)) throw new Fault(400, 'invalid_revision');
    if ($action === 'add' && (!is_string($cmd['student'] ?? null) || trim($cmd['student']) === '' || strlen($cmd['student']) > 120)) throw new Fault(400, 'invalid_student');
    if (in_array($action, ['hours','paid','remove'], true) && (!is_int($cmd['id'] ?? null) || $cmd['id'] < 1)) throw new Fault(400, 'invalid_id');

    $db = new PDO('sqlite:' . __DIR__ . '/../private/ledger.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec('PRAGMA busy_timeout = 3000');
    $db->exec('CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL)');
    $db->exec('BEGIN IMMEDIATE');
    try {
        $db->prepare('INSERT OR IGNORE INTO ledger VALUES (1, ?)')->execute([json_encode(['revision'=>0, 'next id'=>1, 'lessons'=>[]])]);
        $model = json_decode($db->query('SELECT snapshot FROM ledger WHERE id = 1')->fetchColumn(), true, 32, JSON_THROW_ON_ERROR);
        if ($action !== 'load' && $cmd['revision'] !== $model['revision']) throw new Fault(409, 'revision_conflict');
        if ($action === 'add' && count($model['lessons']) >= 100) throw new Fault(422, 'maximum_lessons');
        if (in_array($action, ['hours','paid','remove'], true)) {
            $item = null;
            foreach ($model['lessons'] as $lesson) if ($lesson['id'] === $cmd['id']) { $item = $lesson; break; }
            if ($item === null) throw new Fault(404, 'unknown_lesson');
            if ($action === 'hours' && $item['hours'] >= 10000) throw new Fault(422, 'maximum_hours');
        }
        $result = $model;
        if ($action !== 'load') {
            $result = apply_command__command($model, $cmd);
            $db->prepare('UPDATE ledger SET snapshot = ? WHERE id = 1')->execute([json_encode($result, JSON_THROW_ON_ERROR)]);
        }
        $db->exec('COMMIT');
        return $result;
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}

// Second, stateless Mira service at the same endpoint; no database access.
function ledgerQuote(mixed $params): array {
    $hours = is_array($params) ? ($params['hours'] ?? null) : null;
    if (!is_int($hours) || $hours < 1 || $hours > 10000) throw new Fault(400, 'invalid_hours');
    return quote($hours);
}

serve(['ledger.command'=>'ledgerCommand', 'ledger.quote'=>'ledgerQuote']);
