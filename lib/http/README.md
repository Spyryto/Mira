# HTTP text (Mira 0.88)

Services / Http è un modulo Mira puro: get text: costruisce il descrittore
dell'effetto, successful: classifica status 2xx. App.mira esporta due
funzioni. L'host associa "http text" a un endpoint assoluto scelto
dall'applicazione host, non dal sorgente Mira. Il payload è true (nessun
parametro in questa iterazione). La risposta è {status: Number, body: Text};
4xx/5xx sono risposte normali, non errori di trasporto. Redirect rifiutati.

JS: MiraHttpHost.textService(url, {maxBytes, timeoutMs}) produce un
handler per MiraEffects.createApp; fetch nativa, credenziali omesse,
streaming UTF-8 rigoroso e limite prima di accumulare oltre maxBytes,
deadline con AbortController, cancellazione alla chiusura dell'app.
PHP: require http-host.php, Mira\Http\textService(url, maxBytes, timeoutMs)
produce un callable sincrono basato sullo stream HTTP nativo
(allow_url_fopen deve essere attivo). Timeout PHP di inattività, non
deadline assoluta; fallimento di apertura è http_transport. Non è un
scheduler PHP asincrono. Limite default 65536 byte (max 262144),
timeout default 10000 ms (max 60000). Errori: http_transport,
http_redirect, http_timeout, http_too_large, http_invalid_text,
invalid_http_payload e, su JS, http_cancelled.

Solo GET testuale, UTF-8, nessuna autenticazione, header arbitrario,
retry, download binario, POST o URL dinamico. Il browser deve poter
leggere la risposta (same-origin/CORS). PHP chiede identity encoding;
non si promette equivalenza con risposte compresse o server difettosi.
Il binding host è fidato: non passare URL provenienti da utenti.
Non è una difesa SSRF per URL arbitrari. Il laboratorio Studio usa
un file same-origin versionato e disponibile offline.
