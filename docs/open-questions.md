# Mira — Registro delle questioni aperte (0.1–0.89.3)

Fotografia del 27 novembre 2026, baseline 0.89.3 integrata. Questo registro conserva il lavoro rimasto aperto dall'inizio del progetto, non soltanto la prossima roadmap. Fonti: documentazione storica nel repository, PR, discussioni di progetto recuperabili, principi architetturali e fonte «Riutilizzo pragmatico e portabilità progressiva». La ricostruzione è ampia ma non pretende di recuperare ogni messaggio o esperimento non conservato. Ogni voce ha un identificativo stabile; non rinumerare o cancellare quando risolta: riportare versione, PR, evidenza e nuovo eventuale limite. Non rappresenta una promessa di implementare tutto.

Legenda: A = aperta, P = implementazione parziale o limite verificato, R = rinviata deliberatamente, V = verifica o misura mancante, S = superata/risolta nel perimetro indicato. Le voci R non sono implicitamente approvate come feature. Priorità: correttezza prima; poi esigenze applicative e strumenti; poi estensioni e ottimizzazioni motivate da dati. Le voci possono dipendere da più aree. I riferimenti di versione indicano l'origine o il punto di consolidamento, non una scadenza.

## Sintassi e grammatica — SYN

SYN-01 [A, 0.1–0.12, discussioni 0.51] — Grammar Lab: parametrizzare lexer e parser reali, non duplicare una grammatica dimostrativa. Profili serializzabili; mostrare token, AST canonico, diagnostica, output, benchmark e compatibilità. Separare profilo ufficiale e sperimentale. Riferimento: design-notes.md, principi di progetto.

SYN-02 [A, Grammar Lab] — Unicode negli identificatori, es. quantità, façade, ç, è; caratteri ammessi, NFC, collisioni, mangling e portabilità. Non accettare indiscriminatamente qualsiasi carattere. Keyword localizzate, delimitatori e altre regole configurabili sono possibilità sperimentali, non sintassi adottata.

SYN-03 [A, 0.1/0.51] — Operatori personalizzati: dichiarazione statica e come funzioni, precedenza per famiglie o relazione above/below, associatività, conflitti/cicli. Esempio discusso, non valido oggi: ( ** ) :: { precedence: above arithmetic, associativity: right };. Decidere risoluzione e scope, eventuali overload e operatori unari utente. AND/OR/NOT e sezioni sono già implementati, non riproporli come mancanti.

SYN-04 [A, 0.65+] — Estensioni grammaticali tra moduli: import compile time separato da import di valori, ordine di risoluzione, dipendenze e collisioni, nessuna modifica silenziosa alla grammatica dei consumatori. Pratt parser o precedence climbing sono candidati, non scelta attuata. La grammatica rimane deterministica e non dipendente dai tipi inferiti.

SYN-05 [A, 0.2–0.14] — Currying/partial application generalizzati, applicazione n-aria uniforme e arità statica quando una funzione passa attraverso variabili. Blocchi multi-parametro e sezioni esistono, pipeline >> resta unaria (con caso nullario documentato); non introdurre automaticamente currying implicito. Sintassi di argomenti omessi (es. join, with " ") resta alternativa storica da valutare, non requisito.

SYN-06 [P, 0.5–0.10] — Sezioni complesse, placeholder in espressioni annidate (es. (_ ~ hours >= 1)), riferimenti ripetuti allo stesso hole vs hole distinti. Il blocco {_ | ...} già risolve il caso esplicito di un parametro ripetuto; preservare distinzione record/blocco e scoping. Evitare duplicare sintassi senza vantaggio.

SYN-07 [A, 0.4/Atlas] — Stringhe e interpolazione, template testuali e formattazione; oggi parte delle etichette resta nell'host. DSL HTML/form e disambiguazione delle graffe se motivati da app, senza parsing type-directed.

SYN-08 [P, 0.59/0.75] — Disambiguazioni residue: scrutinee record non parentetizzato e chiamate complesse in match, header parametrico non usato ambiguo con annotazione (Box (T);). I casi già risolti con parentesi o regole contestuali non vanno riaperti indiscriminatamente.

SYN-09 [A, 0.1–0.60.2] — Mangling generale reversibile e anticollisione tra identificatori discorsivi, nomi nativi e riservati JS/PHP. La protezione di alcuni nomi host e la diagnostica delle collisioni esistono; verificare collisioni di maiuscole PHP e identificatori Unicode. Preservare compatibilità di emissione quando utile.

Fonti: syntax.md, grammar.md, decisions.md, design-notes.md, module-design.md, type-checker.md, mira04.md, discussioni Grammar Lab.

## Compilatore, metaprogrammazione e target — COMP

COMP-01 [A, 0.1 e principi] — Macro/trasformatori procedurali a compile time, protocollo AST/IR canonico, igiene, scope, versionamento e diagnostica delle trasformazioni. Imparare da Nail senza importarne automaticamente architettura o VM. Non imporre una seconda IR o una nuova macchina virtuale senza necessità.

COMP-02 [P, 0.4–0.6] — Abbassare FieldGet checked a accesso diretto nativo quando è dimostrata presenza/forma del campo; oggi il controllo di campo mancante conserva semantica dell'accessor. Preservare valutazione singola e comportamento unchecked. Misurare prima di eliminare controlli e non confondere accesso ~ con pipeline >>.

COMP-03 [A, 0.77–0.80] — Ottimizzare l'emissione dopo profiling ripetibile; emissione dominante in alcuni campioni sintetici, non prova causale. Costi di AST/simboli/mangling, dimensione e throughput. Specializzazione/monomorfizzazione di funzioni soltanto se dimostra vantaggio (uguaglianza polimorfica è un caso osservato); evitare bloat.

COMP-04 [R, discussioni Go] — Eventuale backend Go con casi concreti, definire semantica, rappresentazioni, interop, concorrenza e packaging; suite differenziale JS/PHP/Go. Non sostituire i target correnti o riscrivere il compilatore Haxe senza motivazione.

COMP-05 [R, discussioni PHX-VM] — Possibile backend sperimentale Mira → IR/bytecode PHX-VM, non frontend ufficiale. Funzioni statiche/interi prima, closure/sezioni/pipeline dinamiche e CALL_INDIRECT o specializzazione dopo; parità semantica con JS/PHP. Decisione non presa.

COMP-06 [R, 0.1/Atlas] — Dogfooding più profondo del compilatore in Mira, eventuale self-hosting. Nessuna esigenza di riscrivere lexer/parser oggi; riusare Haxe e trasformazioni Mira dove concretamente utili.

## Tipi, prove e diagnostica — TYPE

TYPE-01 [P, 0.39–0.89] — Checked opt-in e maturità del checker: criteri per renderlo default, portabilità dei valori, garanzie sulle firme host, inizializzazione ed effetti. Test generativi/proprietà di unificazione, righe, ricorsione, catture e istanziazioni; soundness non dimostrata globalmente. Nessun Dynamic universale per mascherare errori.

TYPE-02 [P, 0.41/0.49/0.50] — Aggiornamento di record aperti e nominali, overwrite/aggiunta con vincoli lacks, proiezioni strutturali dentro tipi e nuove dichiarazioni, callback e righe esplicite. Aggiornamenti attuali conservativi; preservare identità e vincoli interni, niente subtyping nominale implicito tra fratelli.

TYPE-03 [P, 0.43] — Diagnostica per intervalli completi, più errori con recovery, catene di origine dei vincoli, coordinate LSP zero-based e Unicode, riferimenti multi-file; token anchor e primo errore sono implementati. Integrare con editor e navigazione senza nuovo checker.

TYPE-04 [P, 0.44/0.47/0.48] — Espressività delle firme host e annotazioni: firme generiche, righe aperte, tipi opachi, Integer/refinement, eventuale Unit/null ed effetti; distinguere ABI e algebra interna. Valutare annotazione esplicita del risultato dei blocchi e altri contesti di tipo non coperti; tipi funzione pubblici e annotazioni locali già esistono. Non introdurre Unit/null senza semantica e caso d'uso.

TYPE-05 [P, 0.51–0.57] — Refinement oltre intervalli numerici con AND: predicati generali, OR/!=, testo non vuoto, vincoli in campi/liste, relazioni tra campi; conservare l'esito tripartito prova/violazione/incertezza. Definire linguaggio dei predicati, non un solver generale indiscriminato.

TYPE-06 [P, 0.52–0.56] — Prove di divisibilità, modulo, intervalli non limitati e divisori prossimi a zero; propagazione dei fatti attraverso espressioni/narrowing e intermedi non portabili, guardie selettive. Non attribuire garanzie Integer dopo perdita di precisione. Codec Integer e refinement per host/RPC restano da integrare.

TYPE-07 [A, 0.57/0.62] — Validazione ricorsiva di record/liste, messaggi strutturati/localizzati, composizione e accumulo errori, integrazione con form e GUI. Risultati fallibili numerici e match sono già presenti; generalizzazione non implementata.

TYPE-08 [P, 0.58–0.64] — Tipi somma: match contestuale con scrutinee già noto, inferenza bidirezionale dei callback, pattern più ricchi/annidati quando utili; tipi somma ricorsivi diretti regolari implementati, mutua ricorsione tra dichiarazioni, ricorsione non regolare e tipi nominali non somma ricorsivi restano aperti. Non promettere terminazione.

TYPE-09 [P, 0.60–0.64] — Generici espliciti: ricorsione, vincoli sui parametri, alias arbitrari (Box (T) :: T), refinement parametrici e proiezione strutturale parametrica. Record/liste nominali parametrici e somme regolari esistono. Valutare astrazioni sulle operazioni solo da casi concreti; niente typeclass generale implicita.

TYPE-10 [A, 0.85–0.89] — Option e Result comuni, identità nominale condivisa, import/re-export nei contratti indipendenti; distinguere assenza, errori prevedibili e violazioni invarianti. Migrazione compatibile di JSON, Date e Storage e dell'envelope ABI. Vedi consolidation-089.md. Non dichiarare già disponibile un prelude comune.

## Semantica dei valori e collezioni — NUM/DATA

NUM-01 [A, 0.42/0.55/0.89.3] — Politica di Number: divisione per zero (Infinity/NaN JS vs eccezione PHP), possibile fdiv oppure errore esplicito, finitezza, overflow oltre interi sicuri, rounding, precisione, signed zero e serializzazione. Non normalizzare tutti i Number con cast/guardie; decisione da motivare. Uguaglianza int/float e resto frazionario sono risolti nel perimetro portabile dalla 0.89.2–0.89.3.

NUM-02 [V, 0.89.2–0.89.3] — Estendere test differenziali ai limiti, casi non finiti, operazioni miste e firme host dopo la decisione NUM-01; misurare wrapper polimorfico e fmod. Matrice finita esistente non è prova formale né benchmark.

NUM-03 [A, 0.34/0.89] — Denaro/compensi: politica di arrotondamento, rappresentazione esatta (centesimi Integer o altro), validazioni di dominio. La tariffa fissa e la moltiplicazione Number del pilota sono dimostrative; nessun tipo Decimal già deciso.

DATA-01 [A, 0.4/Atlas/0.32] — Collezioni portabili più ricche: sort, groupBy, traversal, count e accesso indicizzato dove oggi restano capability host. Definire stabilità dell'ordinamento, comparatori, chiavi e tipi di ritorno; usare select per filtro e collect per trasformazione (decisione Smalltalk già adottata).

DATA-02 [P, 0.31–0.32] — Immutabilità semantica vs copia superficiale, record vuoti e liste vuote PHP, chiavi numeriche, alias e mutabilità dei valori provenienti da host; regole di uguaglianza strutturale non adottate. Valutare rappresentazioni solo se esigenze applicative le richiedono.

DATA-03 [V/R, 0.32–0.34] — Benchmark liste/record immutabili (100, 1000, 10000, 100000 elementi), append ripetuto O(n²) nel modello di copia, builder mutabile interno O(n) ammortizzato, structural sharing/HAMT/persistent vector, fusioni di trasformazioni o mutazioni non osservabili. Nessun nuovo contenitore deciso; PHP copy-on-write non equivale a costo zero.

Fonti: structured-data.md, decisions.md, type-checker.md, grammar.md, performance.md, atlas.md, consolidation-089.md.

## Moduli, contratti e build — MOD

MOD-01 [P, 0.65–0.70] — Riferimento qualificato nelle espressioni, uso di alias di modulo e risoluzione di conflitti tra nomi discorsivi e selettori. Import selettivi, rinomina, import completo e riesportazione statica esistono; distinguere sintassi proposta non adottata (namespace puntato PR #95).

MOD-02 [A, 0.74–0.76] — Import/re-export nei contratti indipendenti, dipendenze tra tipi pubblici, composizione di contratti e più implements, export aggiuntivi del provider (oggi vietati). Valutare compatibilità direzionale/subtyping delle firme, non sostituire la verifica delle implementazioni con confronto di stringhe. Identità pubblica stabile e analisi senza provider sono già implementate.

MOD-03 [P, 0.65–0.79] — Precisare moduli senza interface, punto di ingresso esplicito, inizializzazione ed effetti top-level, cicli tra moduli e compatibilità legacy. Scope piatti, identità logiche, privacy e firme opzionali sono scelte confermate; non imporre annidamento o annotazioni obbligatorie.

MOD-04 [A, 0.77–0.80] — Compilazione incrementale/separata, riuso delle interfacce, cache completa e invalidazione corretta: sorgenti realmente letti, fingerprint pubblico, provider, host, binding, target, opzioni, versione compiler e dipendenze grammaticali. Report e impatto inverso conservativo esistono ma l'analisi resta whole-program. Distinguere modifica privata, modifica ABI pubblico e collegamento. Misurare prima di progettare cache.

MOD-05 [P/V, 0.70.1–0.80] — Tree shaking più preciso con effetti inizializzatori, purezza, specializzazione e import; pruning conservativo opt-in implementato. Verificare miglioramenti su progetti reali e non alterare inizializzazione osservabile o guardie. Profiling su più dimensioni, warmup e mediane.

MOD-06 [A, 0.89] — Configurazione dichiarativa multifile, composizione dei manifest host e binding senza glue specifico di ogni app, diagnostica di duplicati e conflitti, percorsi logici, build per target. Riutilizzare resolver/report; pacchetti/versioni/lockfile e package manager sono rinviati, non prerequisiti della 0.90.

Fonti: module-design.md, grammar.md, design-notes.md, decisions.md, scripts/lesson-import.mjs.

## GUI, rendering e reattività — GUI

GUI-01 [P, 0.15–0.25] — GUI checked: tipi per view, componenti, stili, binding, modello, messaggi e callback, eliminazione controlli runtime quando provati. Oggi GUI descrittiva e runtime validate; il pilota recente usa HTML/JS per UI.

GUI-02 [P, 0.19–0.25] — Portare specializzazione e updater nel percorso di compilazione, analisi statica delle dipendenze e riuso di IR/AST. Oggi pass Studio separato, prepara/recompila slot prima del mount, non tutto al compile time. Ridurre allocazioni di descrittori, valutazioni di view e confronti ridondanti; mantenere fallback generico esplicito.

GUI-03 [P, 0.23–0.33] — Specializzazione di stato annidato, liste keyed, componenti dinamici e rami condizionali; partizione ibrida ricorsiva e più generale, row/grid/decorazioni/argomenti trasformati. Oggi partizione conservativa alla radice e stato annidato generico. Nessun wrapper DOM artificiale.

GUI-04 [V, 0.26–0.29] — Esperimento Text.data e nodi testo persistenti: misure comparabili e convenienza su device lenti, memoria/paint e costo di mount; CSS content-visibility e altezza ricordata non equivalgono a virtualizzazione. Valutare virtualizzazione/cache delle sezioni fuori viewport e rendering DOM più fine soltanto dopo misure. PR #48 sperimentale ancora aperta, non integrare senza verifica del main.

GUI-05 [P, 0.33] — Identità dei dati e componenti: key stabili, duplicati, focus/caret, reinserimento, reset e riordino; key esplicite già implementate, valutare ergonomia automatica soltanto se semantica stabile (non contatore di ogni render). Specializzazione keyed e prestazioni grandi liste ancora aperte.

GUI-06 [A, 0.15–0.34] — Catalogo controlli e componenti: form completi, select/checkbox e altri input dove mancanti, validazione, navigazione/routing, responsive layout, dialoghi/notifiche, temi, SVG/grafici e accessibilità. CSS arbitrario/HTML raw, animazioni e lifecycle non sono approvati automaticamente: precisare limiti di sicurezza e comportamento. Verificare ciò che già esiste prima di aggiungere duplicati.

GUI-07 [V, 0.16–0.33] — Safari/iPhone fisico: tastiera, focus, caret, IME, riordino, touch, scroll e prestazioni; test Chromium/DOM simulato non sostituiscono prova reale. Ripetere benchmark su iPhone e browser smart TV con medesimi carichi, layout/paint/FPS, memoria, latenza di digitazione e punto di pareggio mount/update.

GUI-08 [P, 0.23/0.35] — Coerenza commit stato/DOM, errori inattesi durante commit, cancellazione/lifecycle e smontaggio; validazione preventiva esiste, non rollback transazionale di effetti esterni o DOM arbitrari. Composizione stato/effetti tipizzata, evitare framework pesante.

Fonti: browser-interop.md, gui-rendering.md, decisions.md, studio.md, principi di progetto, catalog/laboratory/gui-rendering.json.

## Effetti, interop e librerie — HOST

HOST-01 [P, 0.3/0.44/0.81] — Extern/adapter ergonomici, dichiarazione import host, eventuale use Host, generazione di firme da TypeScript o API native, verificare firme e conversioni ai confini. Manifest tipizzato e scope già presenti; non è sandbox, niente ABI universale o runtime reflection per default.

HOST-02 [A, 0.35/0.89] — Effetti tipizzati e loro risposte: messaggi somma, payload/reply legati al contratto, composizione e concorrenza, cancellation, ordine/staleness, errori e lifecycle. Runtime 0.35 gestisce descrizioni/risposte, ma purezza e tipi non sono verificati globalmente. Valutare integrazione GUI e checker prima di adottare un sistema generale di effect types.

HOST-03 [P, 0.36–0.46] — RPC generato da contratti moderni, host method signatures, validatori per tipi oltre sottoinsieme wire, errori strutturati, version negotiation e compatibilità; registri espliciti e validazione JS/PHP esistono. Non accesso a callable arbitrari, non esposizione automatica di tutte le funzioni.

HOST-04 [P, 0.84–0.85] — JSON/codec: encoder, decoder riutilizzabili da tipi, identità nominali, somme, refinement, versionamento e migrazioni, separazione del validatore puro da effects/RPC, eliminazione della duplicazione dei provider e degli envelope ad hoc. Definire formato wire, limiti, duplicati, null/record vuoti e chiavi numeriche; non un codec universale prematuro.

HOST-05 [R, 0.83] — Text: grafemi, normalizzazione Unicode, confronto/ordinamento locale e interpolazione/formattazione, soltanto se richiesti. Code point e confronto esatto già definiti.

HOST-06 [P, 0.86] — Date: operazioni fallibili tipizzate, Integer nelle firme, eventuali mesi, istanti, durata, timezone e Clock esplicito; distinguere data civile da istante. Nessuna dipendenza implicita dall'ora corrente.

HOST-07 [P, 0.87] — Storage: Option/Result, versionamento dei dati, collezioni, transazioni, durabilità, concorrenza, backup, cifratura e sincronizzazione dove necessarie. IndexedDB o storage remoto richiedono contratto asincrono, non sostituzione trasparente del servizio sincrono. Directory fidata PHP e namespace browser non sono protezioni universali.

HOST-08 [P, 0.88–0.89.1] — HTTP: tipi di errore strutturati, POST/parametri/header/credenziali, binario, retry e policy di timeout/cancellazione. URL dinamici solo con modello esplicito di trust/SSRF; oggi GET a endpoint fidato, PHP sincrono e timeout inattività, JS deadline. Completezza oltre Content-Length e framing malformati non garantita. Non implementare un event loop PHP solo per parità nominale.

HOST-09 [R, discussioni concorrenza] — Concorrenza e parallelismo cross-target: distinguere worker/Promise JS, eventuale AMPHP/server PHP e Go futuro. Partire dalle capacità native con adapter; non promettere semantica comune senza casi concreti. Nessun scheduler universale deciso.

Fonti: dogfooding.md, browser-interop.md, type-checker.md, consolidation-089.md, lib/*/README.md, discussioni di progetto.

## Studio, IDE, manuale e strumenti — TOOL

TOOL-01 [A, 0.30/0.65/0.89] — Workspace multifile: gestione sorgenti/moduli, cartelle, import, manifest, binding, build, salvataggio e riapertura del progetto. PWA/IndexedDB candidato, non scelta definitiva. Offline, import/export e backup senza perdere modifiche; non solo editor di un file.

TOOL-02 [A, 0.39/0.43, discussioni IDE] — Un motore di analisi riusato da Mira Studio e LSP/VS Code: diagnostica continua senza salvataggio, completamento semantico, tipi al cursore, go-to-definition, find references, rename e assistenza import. Misurare latenza/cancellazione e invalidazione. Non duplicare parser/type checker; CodeMirror 6 e Monaco erano alternative, non decisione definitiva.

TOOL-03 [A, 0.3/Atlas] — Formatter, linter, refactoring, test runner e debug: mapping sorgente-generato più preciso, stack trace, breakpoint/step, DAP eventuale, ispezione valori e tipi. Coordinate e generated locations esistono in parte; non promettere debugger completo.

TOOL-04 [A, discussioni IDE] — Inspector moldable in stile Pharo/Roassal con IntelliSense ispirato a Dart: viste contestuali static/live, grafi AST/tipi/moduli, estensioni tramite funzioni tipizzate o altra sintassi da decidere; D3/JS, SVG prima di Canvas se utile, riuso nativo e riscrittura solo motivata. Atlas/Module Explorer sono basi, non IDE completo.

TOOL-05 [P, 0.1–0.82] — Manuale vivo: language tour e cookbook, esempi eseguibili e versionati, storia dal primo commit, motivazioni/alternative, grafi e architettura interattiva, collegamenti profondi, indice/ricerca e navigazione mobile. Reference/catalogo, laboratori e quaderno esistono; non duplicare fonti, evitare solo Markdown. Valutare cache delle rappresentazioni vs generazione dinamica da misure reali.

TOOL-06 [V, 0.6/0.29] — Prestazioni Studio su sorgenti grandi (oltre 50 KB segnalato), editor e rendering delle sezioni non visibili, fullscreen, memoria e responsiveness su smartphone e PC lenti. Verificare cache/offline/update service worker reale e che nuova CI verde porti al deploy effettivo; evitare perdita di lavoro durante aggiornamenti.

TOOL-07 [P, 0.80+] — Introspezione compilatore: tracing per fase, grafi dipendenze/contratti e tipi, timeline di build e benchmark interattivi, evidenza di fallback. Profili e report esistono; correlare sorgenti, errori e rappresentazioni, senza eseguire codice utente non fidato nel thread UI.

## Applicazioni, deploy e MiraHost — APP

APP-01 [P, 0.34–0.46/0.89] — Registro lezioni utile nella vita reale: più lezioni, tariffa modificabile, validazione, calendario, ricerca, stato pagamento, schema/versioning, persistenza/backup e sync; non migrare o sovrascrivere automaticamente i piloti. Full-stack SQLite locale e import singolo sono esperimenti verificati, non prodotto. Altri dogfood proposti: Studio, LiveDoc, registro concerti e ricevute.

APP-02 [A, 0.36/0.89] — Deploy PHP reale: hosting con FTP da CI o soluzione alternativa, ambiente di staging, configurazione privata, rollback, segreti, accessi e monitoraggio. GitHub Pages è frontend statico; non prova backend pubblico. Prima di dati reali: auth, autorizzazione per utente, protezione richieste, CORS esplicito, TLS, backup, audit e policy privacy.

APP-03 [A, discussioni MiraHost] — Desktop/WebView leggero, iniziare JS mantenendo scelta PHP/HTML/htmx locale quando serve. WebView2/WebKit, bridge host asincrono, lifecycle, packaging portabile, avvio, hot reload, sicurezza e aggiornamenti. Valutare host disaccoppiato dal linguaggio e modalità JS/PHP/ibrida, interop JSON/stdin o server locale. Nessuna piattaforma definitivamente selezionata; non assumere PHP distribuito senza dipendenze su ogni OS.

APP-04 [R, 0.15 e MiraHost] — GUI desktop nativa o altri target: riuso della semantica view se motivato, non framework cross-platform proprietario per principio. Verificare risorse, distribuzione e parità funzionale prima di estendere.

## Prestazioni, verifiche e manutenzione — QA

QA-01 [V, 0.1–0.89.3] — Benchmark compilazione/throughput (righe/s e complessità), esecuzione, byte generati, dimensione runtime, allocazioni e RAM. Separare startup, warmup, emissione, mount, paint e I/O. Confronto nativo equivalente, mediane/dispersione, hardware/versioni; non inferire speedup da campioni singoli o tempi zero.

QA-02 [V, 0.32–0.89.3] — Costi specifici: collezioni, key/reconciliation, accessors, specializzazione GUI, validatori JSON/RPC, envelope Result, guardie, confronto polimorfico, fmod, build moduli. Nessuna dichiarazione di zero-cost senza misure. Misurare anche dimensioni dei programmi generati e possibili duplicazioni.

QA-03 [V, 0.36–0.89.3] — Matrice reale OS/browser/host: Chromium CI, Safari/iPhone e TV fisici, Windows/macOS per CLI/host, versioni PHP supportate. Offline/service worker, recupero dopo refresh, errori di rete/archivio, test negativi e integrativi. Non estendere supporto dichiarato oltre verifiche.

QA-04 [A, 0.1–1.0] — Criteri di stabilità pre-1.0, compatibilità sorgente/ABI/schema, release e deprecazioni, riproducibilità e versioni dipendenze; aggiornare CI quando necessario. Verificare ogni modifica JS/PHP/Studio prima del merge; documentare incompatibilità, senza bloccare miglioramenti pre-1.0.

QA-05 [V, PR storiche] — PR #36 (0.17 stili), #37 (0.18 benchmark), #48 (0.26 Text.data), #75 (0.51 refinement/congiunzione) risultano ancora aperte al controllo. Confrontare diff col main, distinguere superseded da eventuale contributo utile, chiudere motivatamente solo dopo verifica. Non mergiarle in blocco. La vecchia sintassi & non sostituisce AND/OR/NOT concordati.

QA-06 [A, documentazione] — Mantenere indice e stato delle questioni aperte aggiornati quando una PR risolve una voce; fonte unica, link ai test e decisioni; classificare nuovi Markdown nel catalogo della provenienza. Evitare che le sezioni storiche vengano scambiate per stato attuale.

## Questioni storiche risolte o superate

S-01 [S, 0.1+] — Mira autonomo, compilatore in Haxe, parser manuale modulare e resolver separato, target JS/PHP. Non riaprire come se fossero ancora indecisi.

S-02 [S, 0.2–0.14] — Sezioni, blocchi multi-parametro/nullari, closure, pipeline >>, accesso ~ e precedenza, record/liste, valori locali immutabili e condizioni lazy. La generalizzazione delle sezioni/currying è distinta.

S-03 [S, 0.15–0.34] — GUI incrementale, stili/grid, binding, specializzazione sperimentale, ibrido automatico, anteprima/ispettore, CSS contenimento, liste native, update immutabile, chiavi stabili e persistenza locale. Rimangono i limiti GUI/DATA/APP elencati, non la mancanza assoluta delle feature.

S-04 [S, 0.35–0.46] — Effetti asincroni pilota, HTTP locale, RPC registrato, contratti e schema derivato, validazione runtime; non ancora effetti totalmente tipizzati o deploy produttivo.

S-05 [S, 0.39–0.64] — Inferenza, row polymorphism/lacks, ricorsione di funzioni, polimorfismo locale, ScalarEq, diagnostica a token, firme host, annotazioni, nominalità, proiezione, refinement, Integer, narrowing, guardie selettive, validazione fallibile, somme e match, generici e ricorsione regolare diretta. I limiti sono TYPE/NUM, non nuove proposte duplicate.

S-06 [S, 0.65–0.82] — Moduli isolati/piatti, export/import/alias, firme pubbliche opzionali, opacità/re-export, pruning conservativo, contratti indipendenti, provider statici, analisi senza provider, identità stabile, report e fingerprint, confronto dipendenze e profiling, capability scoped e Host Module Lab. Cache, qualificazione e composizione restano MOD.

S-07 [S, 0.83–0.89.3] — Servizi Text/JSON/Result/Date/Storage/HTTP, import app checked e correzioni di troncamento/retry, Chromium reale, uguaglianza numerica portabile e resto frazionario. Vedi consolidation-089.md per versioni, PR, run e limiti.

## Priorità operative (proposta)

Prima: NUM-01/02 (politica e correttezza), TYPE-10 e HOST-04/06/07 (Option/Result e confini), senza introdurre sintassi o envelope inutili. Poi MOD-06 e TOOL-01 (tooling multifile), codec, GUI checked e updater, effetti tipizzati, workspace/IDE. In parallelo verifiche QA e dogfooding. Le versioni 0.89.4, 0.90–0.94 sono indicative nel rapporto di consolidamento, non assegnare tutto il registro a una release.

Successivamente applicazioni realmente deployabili e MiraHost; Grammar Lab, macro, operatori custom, Go o PHX-VM quando il nucleo applicativo e le misure giustificano il lavoro. Non trasformare i rinvii in obblighi della 1.0. La 1.0 deve essere uno strumento di lavoro, non una lista di feature.

## Indice delle fonti e metodo

Documentazione storica consultata: syntax.md, mira04.md, atlas.md, structured-data.md, dogfooding.md, browser-interop.md, gui-rendering.md, performance.md, grammar.md, type-checker.md, module-design.md, design-notes.md, decisions.md, studio.md, README.md; rapporto consolidation-089.md e PR #117–126. Discussioni recuperate su Grammar Lab, moduli, tipo/GUI, MiraHost, IDE, PHX-VM, Go e riuso. Le proposte non presenti come implementazioni nel main restano A o R. Le fonti di progetto dettano principi, non una specifica eseguibile. Non sono stati rieseguiti tutti i test per questa ricognizione documentale; non si certifica che ogni limite storico sia ancora riproducibile. Eventuali lacune o stati incerti vanno corretti con riferimenti alla versione e ai test, non con supposizioni.

## Aggiornamento 0.89.4 (implementazione candidata)

TYPE-10 e MOD-02: primo incremento. Data / Outcome introduce Option e Result comuni e import selettivi di tipi nei contratti indipendenti. Il decoder del pilota usa Result comune, Date Safe espone try date from:, Storage Optional espone find text:. Non sono ancora risolti Result degli errori I/O, fallimenti di aritmetica date, re-export/import di valori nei contratti autonomi, migrazione del servizio JSON storico e semplificazione dell'envelope. HOST-04/06/07 restano parziali. Verificare la CI prima di marcare le voci risolte; nessuna garanzia prestazionale nuova.

## Aggiornamento 0.89.5 (implementazione candidata)

La 0.89.4 è stata integrata (PR #128, merge 98fd67ab0f739d23435eb326dea6c0ae64376ef4, tutti i tre workflow verdi). TYPE-10/HOST-07 avanzano: Storage Safe usa Result (Option (Text), Storage Error) e Result (Boolean, Storage Error) nelle tre operazioni, con errori nominali e provider nativi sostituibili. Il pilota usa questa API, mantiene formato dati e vecchio contratto. Restano aperti la migrazione JSON storico, Date/arithmetic fallibili, codec/ABI nominale host, storage asincrono, transazioni, versionamento e backup. QA-02: misurare il costo degli envelope/validazione e dei controlli di accessibilità. Non segnare come risolto l'intero gruppo prima dei relativi test.

## Aggiornamento 0.89.6 (implementazione candidata)

0.89.5 integrata (PR #129, merge 275ef1c550c585ba8f25e4ded4c7e61512d00ce4; tre workflow verdi dopo correzione del predicato parentetizzato del pilota). TYPE-10/HOST-06 avanzano: Date Safe usa Result (Date, Date Error) per costruzione e somma giorni; Date Error nominale, identità opaca del contratto esistente e adapter riusati. Rimane il doppio parsing al successo e l'ABI host strutturale, da misurare; la firma Number permette di riportare conteggi invalidi, Integer host non è risolto. Nessun Instant/Duration/Clock o aritmetica mesi. HOST-04: migrazione JSON storico ed envelope ancora aperti. MOD-06: build multifile autonomo da sviluppare. La firma sperimentale 0.89.4 Result (Date, Text) cambia: migrazione del pilota esplicita, vecchia API Services / Date invariata. Attendere CI prima di segnare la candidata come integrata.

## Aggiornamento 0.89.7 (implementazione candidata)

0.89.6 integrata (PR #130, merge 73ec9b41ccfa0d65bdaccc7c0cb49afbca99f9e0, tre workflow verdi). TYPE-10: identità Result comune anche nel decoder JSON storico, con helper parametrico condiviso dai due decoder. HOST-04: ridotta duplicazione dei provider; envelope, validatore puro, encoder, codec nominali e categorie di errore JSON restano aperti. Text error deliberatamente mantenuto finché esiste solo invalid_json_data. MOD-06: primo supporto CLI a radici logiche multiple esplicite, collisioni rifiutate, legacy invariato. Configurazione multifile e composizione manifest ancora da fare. Nessun costo runtime nuovo misurato e nessuna dichiarazione di zero-cost; la conversione fold resta. Attendere CI prima di segnare la candidata come integrata.

## Aggiornamento 0.90 (implementazione candidata)

0.89.7 integrata (PR #131, merge 78e900f01d13b8f129a81283dd05b16289f0c5dd, tre workflow verdi). MOD-06: primo formato progetto dichiarativo e assemblatore unico per CLI di progetto/Studio. La composizione del pilota non elenca più i singoli sorgenti; si dichiarano sottoalberi, host, binding e target, con rifiuto dei conflitti. Generator JSON opzionale già esistente, non un sistema generale di plugin. Rimangono packaging, manifest di dipendenze/versioni, supporto legacy nel nuovo formato, diagnostica di progetto più ricca, risoluzione lazy e cache; TOOL-01 workspace interattivo non implementato. TYPE-10: il vocabolario comune è operativo ma l'ABI strutturale rimane, HOST-04 codec/validatore puro prossimo incremento. Attendere CI prima di segnare la candidata integrata. Nessuna nuova misura prestazionale.

## Aggiornamento 0.91 (implementazione candidata)

0.90 integrata (PR #132, merge f76d86b85e10012b66a4d2491507f1071293bf38, tre workflow verdi). HOST-04 avanza: nucleo indipendente JS/PHP per validazione checked, decodeJson/encodeJson sullo stesso schema concreto e controllo schema comune ai generatori. JSON non dipende da effetti/RPC; compatibilità delle funzioni RPC mantenuta, dipendenza runtime esplicita. Restano encoder esposti da contratti Mira, codec di tipi nominali/somme/refinement/Integer, categorie di errori e integrazione con persistenza/form. Validazione strutturale del sottoinsieme wire, non type system universale. MOD-06 e TOOL-01: packaging/workspace/cache ancora aperti. QA-02: costo delle verifiche e delle copie non misurato. Attendere CI prima di segnare la candidata integrata.
