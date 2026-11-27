<?php
declare(strict_types=1);
namespace Mira\Http;

// Host-configured absolute URL only. No user-supplied endpoint/path.
// PHP stream timeout is an inactivity timeout, not a strict wall-clock deadline.
function textService(string $url, int $maxBytes = 65536, int $timeoutMs = 10000): callable {
    $parts = parse_url($url);
    if ($parts === false || !in_array($parts['scheme'] ?? '', ['http','https'], true)
        || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])
        || preg_match('/[\x00-\x20\x7f]/', $url)) throw new \InvalidArgumentException('invalid_endpoint');
    if ($maxBytes < 1 || $maxBytes > 262144 || $timeoutMs < 1 || $timeoutMs > 60000) throw new \InvalidArgumentException('invalid_http_limits');
    return static function ($payload) use ($url, $maxBytes, $timeoutMs): array {
        if ($payload !== true) throw new \InvalidArgumentException('invalid_http_payload');
        $context = stream_context_create(['http'=>[
            'method'=>'GET', 'ignore_errors'=>true, 'follow_location'=>0,
            'max_redirects'=>0, 'timeout'=>$timeoutMs / 1000,
            'protocol_version'=>1.1, 'header'=>"Connection: close\r\nAccept-Encoding: identity\r\n"
        ]]);
        $stream = @fopen($url, 'rb', false, $context);
        if ($stream === false) throw new \RuntimeException('http_transport');
        try {
            $meta = stream_get_meta_data($stream);
            $status = 0;
            $length = null;
            $transferEncoded = false;
            foreach ($meta['wrapper_data'] ?? [] as $line) {
                // A subsequent status line starts a new header block.
                if (preg_match('/^HTTP\/\S+ ([0-9]{3})(?: |$)/D', $line, $match)) {
                    $status = (int)$match[1];
                    $length = null;
                    $transferEncoded = false;
                } elseif (preg_match('/^Content-Length:\s*(.*?)\s*$/iD', $line, $match)) {
                    $n = ltrim($match[1], '0');
                    $n = $n === '' ? '0' : $n;
                    if (!preg_match('/^[0-9]+$/D', $match[1]) || ($length !== null && $length !== $n))
                        throw new \RuntimeException('http_transport');
                    $length = $n;
                } elseif (stripos($line, 'Transfer-Encoding:') === 0) {
                    $transferEncoded = true;
                }
            }
            if ($status >= 300 && $status < 400) throw new \RuntimeException('http_redirect');
            if ($status < 200 || $status > 599) throw new \RuntimeException('http_transport');
            $body = '';
            while (!feof($stream)) {
                $chunk = @fread($stream, min(8192, $maxBytes + 1 - strlen($body)));
                $meta = stream_get_meta_data($stream);
                if ($meta['timed_out']) throw new \RuntimeException('http_timeout');
                if ($chunk === false || ($chunk === '' && !feof($stream))) throw new \RuntimeException('http_transport');
                $body .= $chunk;
                if (strlen($body) > $maxBytes) throw new \RuntimeException('http_too_large');
            }
            // A clean EOF is not sufficient: PHP streams can return a
            // truncated body without reporting a transport failure.
            // 204 and 304 have no body; 304 was rejected above.
            if ($status !== 204 && !$transferEncoded && $length !== null && (string)strlen($body) !== $length)
                throw new \RuntimeException('http_transport');
            if (preg_match('//u', $body) !== 1) throw new \RuntimeException('http_invalid_text');
            return ['status'=>$status,'body'=>$body];
        } finally { fclose($stream); }
    };
}
