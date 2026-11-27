# Consolidamento Mira 0.83–0.89.3

Stato di riferimento: 27 novembre 2026, versione 0.89.3, merge 7c61297bc3c9b1be6ca7c568e6000e9ecc4ffa6f. Tutti gli incrementi elencati sono integrati. La revisione riguarda i servizi recenti, la loro composizione e alcune divergenze aritmetiche; non è un audit esaustivo del compilatore o una certificazione di sicurezza. Le proposte successive non sono implementazioni.

## Principi confermati

Linguaggio ricco, runtime piccolo. Preferire il compilatore e il checker quando l'informazione è disponibile staticamente; non moltiplicare sintassi, AST, runtime e protocolli per ogni servizio. La semantica Mira non deve essere una copia accidentale della rappresentazione JS o PHP.

Riutilizzo pragmatico: contratti Mira, provider selezionati staticamente, adattatori host espliciti e confinati, native API quando la semantica coincide. L'astrazione portabile nasce da un caso concreto e può essere sostituita progressivamente. Nessuna promessa di costo zero senza misure: distinguere assenza di chiamate aggiuntive, costi reali di adattamento e costo di compilazione.

I tipi dichiarati dall'host sono affidabili per il compilatore ma non sono automaticamente validati. Lo scope delle capability è risoluzione statica, non una sandbox. Il checker garantisce ciò che verifica, non purezza o terminazione generale. La CI deve verificare JS, PHP e Studio prima di integrare.

## Cronologia verificata

0.83 — Text, PR #117, merge e81fc677c6a24c0c64a45f8e261d16f21aa72592. Contratto e adapter Unicode nativi.

0.84 — JSON, PR #118, merge 93d2cb997c621d7422f26b7dc44c0d6fc2a5b0b9. Schema e manifest generati dal contratto.

0.85 — Result, PR #119, merge 235b42d088c01aac229aca81b9b0ea5171cc4fb9. Decodifica fallibile tipizzata.

0.86 — Date, PR #120, merge 0f29f2284bdeb7860e12abd5ad0e6c080780482f. Data civile opaca.

0.87 — Storage, PR #121, merge aaa3e93e28661a2252e8f60f579425635b3ce8c8. Browser/Files, binding statico.

0.88 — HTTP, PR #122, merge 93c7937545fb8a9b3bc646b92789eafb14854dec. GET testuale con effetto e adapter nativi.

0.89 — Importa una lezione, PR #123, merge bed357648bed86a597a6dea527e4216d35c9de0a. Composizione checked dei cinque servizi.

0.89.1 — Revisione, PR #124, merge c0fa10d2e96d0a5b895641dd4fa03db30d82233e. Correzioni HTTP, UI e binding, verifica in Chromium reale.

0.89.2 — ScalarEq, PR #125, merge 0a1619211ffccf32ad5349ad46c5d5592384fb89. Uguaglianza numerica portabile con specializzazione statica PHP.

0.89.3 — Resto, PR #126, merge 7c61297bc3c9b1be6ca7c568e6000e9ecc4ffa6f. fmod e matrice aritmetica differenziale.

Le PR #123–126 hanno superato i tre workflow (compiler, Studio, full-stack) sul rispettivo head prima dell'integrazione. Ultima verifica #126: compiler 45946081553, Studio 45946081557, full-stack 45946081615. I numeri sono gli identificativi delle run GitHub Actions, non misurazioni prestazionali. I test sono evidenza empirica, non prova universale di equivalenza.

## Text: cosa significa un carattere

lib/text: Services / Text espone code points:, contains:in:, starts with:in:, ends with:in:. Si contano code point Unicode scalari, non byte, code unit UTF-16 o grafemi percepiti. Confronti esatti case-sensitive, nessuna normalizzazione NFC/NFD, ago vuoto ammesso. Lone surrogate o UTF-8 invalido sono rifiutati al confine. JS usa iterazione nativa e metodi stringa; PHP PCRE e funzioni str_*, senza mbstring. Test su accenti, emoji, combinanti, ZWJ, newline e NUL. Non introdurre un motore Unicode proprietario; grapheme segmentation e locale-specific comparison richiedono contratti distinti quando utili.

## JSON: schema unico e validazione al confine

lib/json, scripts/json-contract.mjs, runtime/php/Rpc.php e studio/effects.js. Il report canonico delle interfacce fornisce lo schema; il generatore produce manifest e binding. JSON.parse/json_decode nativi. Sottoinsieme concreto di Number, Text, Boolean, liste e record chiusi non vuoti con chiavi non numeriche; numeri finiti e interi sicuri. Non si accettano campi extra, coercizioni, null, funzioni o strutture aperte. Input al massimo 16384 byte UTF-8, profondità limitata (schema/validatore 30, parser PHP 32), Unicode scalare. Chiavi duplicate seguono la politica nativa last-wins; non è un formato canonico o un encoder.

decode lesson: diretto solleva invalid_json_data; try decode lesson: produce il Result nominale del contratto. Il provider riceve un envelope strutturale privato con values: lista zero/uno ed error: Text, poi usa fold e i costruttori Mira. Non produce valori di successo fittizi e non cattura indiscriminatamente bug host. Il generatore verifica coerenza delle firme diretta e fallibile. Il costo dell'envelope non è misurato, non costituisce ABI generale. La dipendenza dei decoder da effects.js e Rpc.php è debito tecnico: estrarre il piccolo nucleo condiviso quando utile, non duplicare i validatori.

## Date: un valore civile non è un istante

lib/date: Date opaco con rappresentazione privata ISO YYYY-MM-DD, calendario gregoriano prolettico, anni 0001–9999. valid date:, date from:, iso of:, add days:to:, days between:and:, weekday of:. UTC usato soltanto per l'aritmetica nativa, nessun fuso nel valore. Differenza last - first, weekday ISO da lunedì 1 a domenica 7. Conteggi dei giorni interi, assoluto massimo 3652058, limiti di anno controllati. Manifest attuale Number; controllo runtime per integrità. Eccezioni invalid_date, invalid_day_count, date_out_of_range. Test differenziali su bisestili, date limite, anni 1–99 e differenze. Non ancora Instant, Duration, clock, mesi o timezone; non confondere i tre domini.

## Storage: capacità delimitata, non filesystem universale

lib/storage: read text: restituisce [] se assente, [testo] se presente anche vuoto. save text:for: e remove text: restituiscono true al successo; rimozione idempotente. Errori al confine come eccezioni; nessuna semantica implicita di ordinamento degli effetti tra dichiarazioni indipendenti.

Chiavi ASCII 1–64 caratteri: lettera minuscola iniziale, poi lettere minuscole, cifre, underscore e trattino. Valori Unicode scalari fino a 65536 byte UTF-8. JS localStorage con namespace deciso dall'host; PHP directory privata preesistente, un file per chiave, tempnam e rename nella stessa directory. Il controllo symlink è difensivo, non una sandbox né protezione da race con processi ostili. Nessuna garanzia di fsync, durata a crash, isolamento, transazioni, cifratura, backup o sync. L'accesso localStorage è sul thread principale, con programma repository-owned compilato a build time; non si esegue sorgente arbitrario dell'editor. Test provider sostituibili, dati tra processi PHP, storage simulato e dalla 0.89.1 Chromium reale nel pilota.

## HTTP: risposta applicativa distinta dal trasporto

lib/http: Services / Http è puro, get text: costruisce il descrittore {service, id, reply, payload}, successful: classifica 2xx. L'host sceglie l'endpoint assoluto fidato. Il programma non può scegliere URL, path, credenziali o header. GET testuale UTF-8, {status: Number, body: Text}; 4xx/5xx sono risposte normali. Il decoder è separato. Redirect rifiutati, limite default 64 KiB (max 256 KiB), timeout default 10 secondi (max 60). JS fetch, ReadableStream, AbortController e credenziali omesse; PHP stream nativo sincrono, timeout di inattività, non deadline assoluta. Errori espliciti, annullamento JS. No retry, POST generico, download binario, autenticazione, scheduler PHP o difesa SSRF per URL arbitrari.

Dalla 0.89.1 PHP verifica Content-Length dichiarato quando non c'è Transfer-Encoding (eccetto risposta 204 senza corpo). Un EOF prematuro viene rifiutato, non consegnato come successo. Non si garantisce rilevamento di ogni framing malformato. Test loopback reale e regressione corpo troncato.

## Dogfooding: importare una lezione

examples/lesson-import/App.mira e scripts/lesson-import.mjs compongono i contratti Text, Date, Storage, Http e il decoder applicativo. Il contratto Services / Lesson Import include name, date, hours, paid e tags. Si riusa il generatore JSON ma il provider ripete ancora la conversione envelope -> Result. Il build checked compone manifest e binding, rifiuta duplicati (anche binding del decoder dalla 0.89.1), emette JS e PHP con provider storage diversi.

Il flusso: GET del JSON dimostrativo; accettazione HTTP 2xx; decodifica strutturale; validazione di dominio (data valida, nome 1–120 code point, ore >0 e <=24); calcolo a tariffa fissa 30 €/ora; salvataggio esplicito del JSON originale in uno slot; recupero e nuova validazione. I tag sono validati ma non mostrati. Esempio Ada, 2026-11-27, 1.5 ore, 45 euro, non saldato. Non si promette aritmetica monetaria esatta.

La pagina Studio lesson-import.html è separata dal registro lezioni storico e ha namespace locale proprio. HTML/JS orchestra rete, eventi e UI; Mira decide validazione, classificazione e salvataggio. Non è ancora GUI checked in Mira né deploy PHP di un'app pubblica. La pagina espone sorgente, schema, JS e PHP generato; gli asset sono precache, ma il test Chromium non dimostra funzionamento offline/service worker o Safari/iPhone reale. Il pilota contiene un singolo slot, non un gestionale o backup. Usare dati dimostrativi.

0.89.1: importazione HTTP fallita o JSON remoto non valido non sostituiscono la bozza. Fallimento I/O non disabilita definitivamente un salvataggio valido, così da poter riprovare. Eliminare il valore persistito non elimina il draft. Test UI simulata e Chromium reale: importa, salva, ricarica, recupera, rifiuta input invalido, recupera nuovamente. Non toccare il registro precedente.

## Uguaglianza scalare (0.89.2)

La 0.42 aveva introdotto il predicato ScalarEq con una limitazione documentata: entrambi gli emitter usavano ===, ma PHP distingue int/float e JS no. 1 == 1.0 deve essere vero per Number nel dominio portabile, senza rendere uguali "01" e "1". La semantica checked esclude record, liste e funzioni.

Il TypeChecker raccoglie il tipo degli operandi delle espressioni e delle sezioni, lo risolve dopo l'inferenza nel contesto del modulo e passa fatti emission-only al PHP emitter. Number/Integer noti -> ==/!= nativi PHP; Text/Boolean noti -> ===/!==. JS invariato. Nessun wrapper nei casi staticamente risolti; costo aggiuntivo di compilazione non misurato. Firme host corrette sono una premessa.

Per il corpo polimorfico emesso una volta e per unchecked PHP: piccolo fallback che valuta entrambi gli operandi una sola volta, accetta uguaglianza stretta oppure confronto numerico soltanto per una coppia int/float. Nessuna monomorfizzazione, dizionario runtime, typeclass o nuovo nodo AST. Costo del fallback non misurato. Il comportamento di non scalari unchecked resta fuori dal contratto checked.

```mira
same: x (Number) -> Boolean = x == 1.0;
same value: a, as: b = a == b;
remainder = (_ % 2);
```

## Resto numerico (0.89.3)

% significa resto con quoziente troncato verso zero, non modulo euclideo. PHP % tronca gli operandi a interi e per divisori come 0.5 solleva DivisionByZeroError; JavaScript % lavora sui Number. Il percorso binarySource condiviso di espressioni/sezioni emette fmod PHP, non un helper Mira. JS invariato. fmod restituisce float anche per input interi: non confondere Number con int PHP. Non vengono aggiunte prove di range per %, né indebolito Integer.

```text
Espressione      JS         PHP prima      PHP con fmod
5.5 % 2         1.5        1              1.5
-5.5 % 2        -1.5       -1             -1.5
5.5 % -2        1.5        1              1.5
0.75 % 0.5      0.25       errore         0.25
1.5 % 0.5       0          errore         0
5 % 0           NaN        errore         NaN
```

La matrice differenziale in test/types.test.mjs verifica +, -, *, /, % su coppie positive/negative, frazioni binarie, decimali, zero dividendo e limiti sicuri. Esclude risultati non finiti o fuori dominio dalla matrice finita, verifica NaN del resto per auto-disuguaglianza, normalizza il segno dello zero nel confronto JSON. Checked, unchecked, tree shaking, funzioni/sezioni e Studio. Non è una prova bit per bit né un benchmark. La chiamata fmod ha costo non misurato; non qualificare zero-cost.

## Questioni numeriche ancora aperte

Divisione per zero: 1 / 0 produce Infinity JS, PHP solleva DivisionByZeroError; 0 / 0 produce NaN JS, PHP solleva DivisionByZeroError. fdiv è una possibile soluzione nativa, non adottata. Overflow: 9007199254740991 + 2 produce 9007199254740992 JS, 9007199254740993 PHP int64. Fuori dalla magnitudine portabile, nessuna equivalenza promessa. Non normalizzare tutti i Number con cast o guardie senza una semantica e misure.

Il checker ha già prove conservative per Integer e refinement, distingue violazione certa, prova positiva e obbligo non dimostrato, e può inserire guardie nei casi ammessi. Number non è oggi garantito finito. La futura decisione deve separare valore numerico, rappresentazione, finitezza, overflow, precisione, interi sicuri e serializzazione. Considerare anche -0, NaN, operazioni con infinito e arrotondamento monetario. Definire prima la politica, poi misurare; non è stata ancora scelta una semantica definitiva dei casi non finiti.

## Option e Result: direzione proposta, non ancora implementata

L'assenza legittima di valore e il fallimento prevedibile sono concetti distinti. L'idea è una famiglia comune di tipi somma ordinari, non keyword nuove o eccezioni mascherate.

```mira
Option (T) :: Some (T) | None;
Result (T, E) :: Ok (T) | Err (E);
```

Questa è la forma desiderata, non un nuovo modulo già disponibile. I Result attuali appartengono ai contratti JSON specifici e hanno identità nominali distinte. Un modulo comune richiede una strategia di import/re-export dei tipi, tenendo presente che i contratti indipendenti oggi non ammettono import. Non duplicare i tipi nominali pensando che siano intercambiabili. Valutare prima un caso reale e l'ABI host esistente, quindi migrazione incrementale di JSON, Date e Storage; mantenere eccezioni per bug/invarianti inattese e documentare chiaramente errori attesi. Possibile lettura fallibile Result (Option (Text), E); non approvare ancora una firma definitiva. Nessuna promessa di eliminare tutte le allocazioni.

## Priorità e debito tecnico dopo la 0.89.3

0.89.4 (proposta): coerenza delle API e degli errori. Verificare fattibilità di Option/Result comuni con moduli indipendenti; evitare nuovi envelope ad hoc e mantenere il comportamento applicativo durante migrazioni.

In parallelo come decisione progettuale, non implementazione: politica dei numeri non finiti, divisione per zero, overflow. Correggere problemi di correttezza prima di ampliare il linguaggio.

0.90 (proposta): tooling multifile; una configurazione dichiarativa di progetto, composizione dei manifest/binding, rilevamento conflitti, riutilizzo del resolver e dei report. Nessun package manager prematuro. Verificare che l'assemblaggio del pilota si semplifichi concretamente.

0.91 (proposta): codec tipizzati riutilizzabili, estrazione del validatore puro condiviso solo se motivata, encoder/decoder e versionamento dati. Nessun formato di serializzazione universale imposto.

0.92 (proposta): GUI checked, validazione dei modelli/view/binding, specializzazione a compile time quando dimostrata, fallback espliciti. 0.93 (proposta): effetti tipizzati. 0.94 (proposta): workspace Studio, diagnostica e navigazione multifile. Le versioni sono un ordine indicativo, non impegni; vanno riordinate secondo prove e necessità.

Più avanti: applicazioni realmente deployabili (PHP, MiraHost/WebView), uso progressivo di Mira in Studio, Grammar Lab e operatori personalizzati, trasformazioni compile time ed eventuale backend Go. Prima la correttezza e l'usabilità, poi cache, ottimizzazioni e nuove astrazioni.

## Verifica e misure: cosa manca

Tutti i merge sopra sono verificati via CI, ma non c'è nuovo benchmark comparativo dei costi di uguaglianza polimorfica, fmod, validatori o envelope Result. Prima di ottimizzare, misurare compilazione, byte generati ed esecuzione su input rappresentativi, separare warmup, mediane e dispersione. Non inferire regressioni da un solo campione né confrontare codice con semantica diversa. Serve anche verifica offline reale e Safari/iPhone, eventuale matrice PHP su versioni supportate e audit di sicurezza prima di un deploy con dati reali. Nessuna garanzia di compatibilità API pre-1.0 oltre ai contratti testati.

## Dove approfondire

Documentazione specialistica: docs/type-checker.md (prove, ScalarEq, matrice aritmetica); docs/grammar.md (resto e sintassi); docs/studio.md (laboratori e applicazioni); docs/browser-interop.md (effetti e RPC); docs/module-design.md (contratti e identità); docs/design-notes.md e docs/decisions.md (motivazioni storiche); docs/performance.md (misurazioni e limiti). Le directory lib/text, lib/json, lib/date, lib/storage, lib/http ed examples/lesson-import contengono contratti, adapter e README. I test principali sono test/types.test.mjs, test/effects.test.mjs, test/studio.test.mjs e test/fullstack.test.mjs. Il presente documento è una fotografia di consolidamento, non sostituisce i contratti e i test versionati.
