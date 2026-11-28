# Mira SDK — Kaizen 0 (experimental)

Two bootstrap scripts, same commands; no npm/Composer dependency at runtime.
The JavaScript host requires Node 22+, the PHP host PHP CLI 8.3+ (proc_open,
HTTPS streams with OpenSSL enabled for downloads). The Node bootstrap works in CommonJS and ES module projects.

Set MIRA_VERSION to select a version, MIRA_HOME to choose a cache directory.
Default: 0.108, ~/.mira/versions/0.108. No silent update. A release contains
mira-sdk.json, mira-sdk.json.sha256, mira.js, mira.php. SHA-256 detects
corruption, not a malicious release publisher. Only use trusted releases.
Offline: install /path/to/mira-sdk.json with the adjacent .sha256 file.
The JSON archive avoids platform-specific ZIP extraction dependencies.

    node mira.js install
    php mira.php install

Copy the installed quickstart directory to a writable workspace (including
lib/gui.mira: it is real source, not a magical import). From that workspace:

    node /path/to/mira.js run hello.mira
    php /path/to/mira.php run hello.mira
    node /path/to/mira.js build hello.mira php
    php /path/to/mira.php build hello.mira js
    php hello.php
    node hello.mjs

Both print 150. build emits standalone console code for this log capability.
run uses a temporary generated file and needs the chosen output runtime.

    node /path/to/mira.js web counter.mira site
    php /path/to/mira.php serve counter.mira 8765

Open http://127.0.0.1:8765/ for serve, then Ctrl+C to stop. The web output is
three static files; publish them on any static web server. The counter uses
the real existing Mira renderer. No compiler in the browser required.
serve listens on loopback only. Use trusted sources; this is not a sandbox.

Current scope: log and basic GUI, not general-purpose project manifests,
filesystem/HTTP capability packaging, checked GUI compilation or Cozy offline.
The PHP compiler host and both local GUI servers are verified by CI. The release workflow publishes an immutable version after Windows and Linux checks.
