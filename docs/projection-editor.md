# Mira Studio — Proiezione strutturale, UX e dogfooding

Stato: direzione progettuale condivisa il 27 novembre 2026. Questo documento raccoglie le intenzioni e le ipotesi di lavoro, non descrive funzionalità già implementate e non costituisce una specifica definitiva. Le scelte indicate come aperte richiedono esperimenti e valutazione.

## Obiettivo e principio guida

Quando l'intenzione del programmatore è chiara, l'editor si occupa della sintassi; il programmatore si occupa della semantica. La sintassi è una proiezione del programma, non necessariamente la sua rappresentazione primaria. L'esperienza deve essere fluida come un buon editor testuale, pur manipolando strutture come in Blockly, senza obbligare a una rappresentazione a blocchi.

La UX è un requisito architetturale: un editor che evita errori sintattici ma impone menu, click o navigazione eccessivi non ha raggiunto l'obiettivo. Non si assume che l'editing strutturale sia automaticamente più rapido o più accessibile.

## Editing diretto della struttura

Direzione condivisa: Projection Lab esplora un AST editabile proiettato direttamente in HTML. Non si richiede una textarea globale, né CodeMirror come fondamento. Un identificatore può essere uno span con classe var; operatori, keyword e delimitatori sono elementi della proiezione, non caratteri modificabili accidentalmente. Piccoli input nativi contestuali restano utili per digitazione, tastiera virtuale, composizione IME e accessibilità.

La digitazione serve principalmente a filtrare simboli o costrutti, introdurre o rinominare identificatori, inserire literal. Un operatore digitato può essere interpretato come comando compositivo; il resto dell'interazione consiste in selezione, inserimento, sostituzione, eliminazione, spostamento, riordino, avvolgimento e navigazione. Mouse, tastiera, touch e gesture devono accedere alle stesse azioni semantiche. Swipe e giroscopio sono idee sperimentali, non requisiti: devono dimostrare utilità e non sostituire alternative accessibili.

L'editor conserva una selezione semantica (nodo, campo, slot di inserimento), non soltanto una posizione tra caratteri. Le azioni sono esplicite e reversibili. Undo/redo deve ripristinare struttura e selezione; una singola intenzione, ad esempio avvolgere un'espressione in una moltiplicazione, è una singola transazione.

## UX: evitare la tassa dei menu

Proposte da verificare con prototipi e uso reale:
- La digitazione deve poter avviare direttamente un'azione o filtrare il contesto senza un click preparatorio. Accettare con un gesto o tasto naturale; annullare senza cambiare il programma.
- Suggerimenti ordinati per tipo atteso, scope, compatibilità e pertinenza; evitare liste enormi, popup obbligatori e selezioni arbitrarie. Offrire un percorso rapido per utenti esperti e suggerimenti scopribili per chi apprende.
- Operatori come +, ~ e >> possono avvolgere o estendere la selezione senza ricostruire manualmente l'espressione. Prevedere inserimento prima/dopo, sostituzione di un ramo, spostamento di sottoalberi, selezione del padre e dei fratelli, editing di più dichiarazioni.
- Non proteggere la sintassi rendendo impossibile un cambiamento deliberato: match è atomico, ma il nodo Match si può sostituire, rimuovere o riorganizzare. Non cancellare per errore contenuti figli; il comportamento di cancellazione deve essere prevedibile.
- Navigazione e completamento non devono sottrarre il focus agli input o far saltare scroll, selezione e tastiera. Conservare identità dei nodi e aggiornare granularmente la proiezione.
- Su mobile portrait: target touch adeguati, azioni contestuali vicine alla selezione, uso con tastiera virtuale e fisica, niente menu profondi o hover obbligatorio. Supportare screen reader e navigazione da tastiera; verificare il significato della proiezione anche senza colore o CSS generato.
- Consentire copia/incolla di testo ordinario e import di frammenti; non perdere l'input non ancora interpretabile. Un percorso testuale parallelo è una possibilità utile, non una decisione vincolante sul modello principale.

Confrontare con l'editor esistente su attività identiche: creare una funzione, costruire un'espressione annidata, inserire un match esaustivo, cambiare operatore, riordinare argomenti e dichiarazioni, rinominare un simbolo, incollare codice e correggere un errore. Misurare tempo effettivo, numero di azioni/pressioni, passaggi nei menu, correzioni e annullamenti, latenza input-render e analisi, stabilità del focus, consumo di memoria. Distinguere uso iniziale e dopo familiarizzazione, desktop e iPhone/iPad. Nessuna soglia quantitativa definitiva prima della baseline; niente dichiarazioni di superiorità senza misure. Una regressione ergonomica richiede revisione dell'interazione, non un nuovo menu.

## Snippet semantici, typed holes e IntelliSense

Lo snippet non è una stringa da inserire: è un costrutto editabile con slot e vincoli. Se il tipo di uno scrutinee è noto, selezionare match deve poter generare tutti i casi possibili, inclusi binding del payload quando necessario. Keyword, delimitatori e nomi dei costruttori risolti non sono liberamente alterabili carattere per carattere; espressioni e nomi dichiarati restano modificabili attraverso le azioni appropriate. Un cambiamento al tipo somma rende individuabili i match da aggiornare: non eliminare automaticamente i rami con codice utente.

Un buco indica esplicitamente una parte mancante, con tipo atteso se noto, scope e posizione. Struttura editabile valida non significa programma completo o verificato. Il compilatore di produzione deve rifiutare buchi irrisolti; l'analisi interattiva può restituire informazioni parziali senza fingere prove. Un match con tutti i rami vuoti è strutturalmente esaustivo, non ancora eseguibile o corretto.

Completamento di variabili, selettori multiword, moduli, tipi, campi e costrutti in base al contesto; dopo >> suggerire funzioni applicabili al valore; dopo ~ campi disponibili. Generare strutture per record con campi richiesti, chiamate con slot per gli argomenti e implementazioni di contratti. Hint dei tipi inferiti, intervalli, cardinalità, presenza campi, esito Proven/Violated/Unknown, firma e documentazione; navigazione alla definizione, riferimenti, rinomina, diagnostica live, quick fixes e outline. Non escludere un candidato soltanto perché il checker non ha ancora informazioni sufficienti: distinguere compatibilità provata, possibile e incompatibilità nota.

Il servizio semantico dovrebbe riusare parser, resolver, checker e report reali, con API comuni a Projection Lab, editor testuale e futuro LSP. Analisi delle revisioni non salvate, risultati associati alla revisione, cancellazione/ignorare risultati obsoleti, cache incrementale solo dove corretta e misurata. Non costruire un secondo type checker o parser dimostrativo. Documentazione, firme, esempi verificati e snippet devono condividere la stessa fonte per quanto possibile.

## Proiezione HTML e preferenze visive

Una proiezione traduce nodi e relazioni in una rappresentazione leggibile. Classi CSS semantiche, ad esempio var, terminator e operator, consentono preferenze visuali: mostrare o nascondere i punti e virgola, prefisso $ davanti ai riferimenti, simbolo × invece di *, hint dei tipi, colori e layout. Un cambio di preferenza non modifica il programma o il suo significato. Non confondere una proiezione PHP-like con sintassi PHP valida o un cambio di grammatica. CSS basta per presentazione semplice; proiezioni complesse possono essere funzioni Mira. Copia/export devono produrre testo valido e significativo indipendentemente dai pseudo-elementi CSS. La proiezione non deve nascondere informazioni indispensabili o rendere ambiguo il raggruppamento delle espressioni.

## Identità, rappresentazioni e persistenza

Direzione: riferimenti a identità stabili dei simboli e dei nodi, quando risolti, rendono navigazione, rinomina e aggiornamento della proiezione più diretti. Riferimenti non risolti, collisioni, cambi di scope e import richiedono diagnostica; una rinomina non può alterare silenziosamente il significato o produrre catture. Non trattare tutti i campi strutturali come simboli nominali globali.

Distinguere modello editabile (buchi, identità, commenti e documentazione, metadati necessari all'editing), AST canonico del compilatore e eventuale IR ottimizzata. La distinzione è di responsabilità, non un obbligo di tre alberi indipendenti; riutilizzare il modello esistente e introdurre estensioni o adattatori minimi. Il parser testuale resta per import, export/round-trip, CLI ed editor tradizionali. La produzione del codice e le verifiche semantiche continuano ad avere una sola autorità.

Scelta aperta, non presa: persistenza primaria del testo, del modello strutturale in JSON/database o combinazione dei due. Si può sperimentare prima in memoria. Se il modello diventa persistente, definire schema versionato, migrazioni, integrità dei riferimenti, diff/merge, backup, recupero di progetti incompleti e interoperabilità Git. Non serializzare direttamente l'enum interno Haxe come formato pubblico stabile. Il testo può diventare un formato di import/export; preservare commenti e semantica nei round-trip e chiarire come vengono conservate le identità. Nessun database o formato definitivo è approvato.

## Toolkit grafico e visualizzazione

Direzione: Mira UI come toolkit modulare, tipizzato, dichiarativo e reattivo; Mira Visualization per dati dinamici, tabelle, liste, alberi, grafici, SVG e grafi. Layout, controlli, navigazione, feedback, temi e componenti data-driven riusabili. Accessor tipizzati per mappare dati a colonne, coordinate, label e stili. Una collezione alimenta più rappresentazioni senza duplicare logica; aggiornamenti granulari e identità stabile.

Riutilizzare il renderer e le primitive native quando appropriato; non riscrivere DOM, editor di input o algoritmi grafici complessi per principio. SVG è un candidato iniziale, non un obbligo universale. Conservare prestazioni, accessibilità e comportamento mobile. Projection Lab deve diventare esso stesso un utilizzatore del toolkit.

## Dogfooding e sistema di tipi

Direzione condivisa: migrare Studio progressivamente, per sezioni e moduli effettivamente utilizzati (Atlas, Inspector, Reference, Benchmark, Module Explorer, laboratori, Workbench). Iniziare ora, aggiungendo primitive soltanto in presenza di esigenze reali: testo, collezioni, dizionari, accesso indicizzato, iterazione efficiente, contratti host. Riutilizzare adapter nativi senza obbligo di portabilità o self-hosting immediato. Sperimentare singole fasi algoritmiche del compilatore in Mira quando il caso è adatto; Haxe rimane bootstrap e riferimento di correttezza.

Checked per default come direzione concordata; eccezioni circoscritte al modulo mediante proposta unsafe module Mia Nonna; da specificare. Non mantenere una modalità unchecked globale destinata agli utenti per inerzia storica; migrare prima i consumatori esistenti, mantenere API di test e diagnostica delle fasi. Unsafe non deve diventare un dialetto: stessa semantica, garanzie ridotte esplicite, confini pubblici tipizzati con validazione o assunzione dichiarata, niente propagazione implicita della fiducia. Le scelte esatte dei contratti unsafe e la rimozione dei flag richiedono implementazione e verifica separate.

Mira on Mira: misurare codice applicativo reale, librerie riutilizzabili e compilatore separatamente; escludere esempi, fixture, test e codice generato. Registrare build checked, superficie unsafe, componenti migrati, codice host eliminato, dimensioni e prestazioni generate. Non massimizzare una percentuale a discapito di UX, prestazioni o semplicità.

## Incrementi sperimentali proposti

1. Projection Lab autonomo: proiettare un AST piccolo in HTML senza textarea globale, con selezione stabile e proiezioni CSS alternative.
2. Azioni strutturali minime e input contestuali: navigazione, literal, simboli, wrap/replace/remove, undo/redo; misurare i flussi rispetto all'editor testuale.
3. Buchi tipizzati e suggerimenti contestuali; costruzione completa di match, chiamate e record; analisi e diagnostica della revisione.
4. Import/export di frammenti e moduli; riferimenti, rinomina, riordino; preservare commenti e metadati richiesti.
5. Estendere il toolkit grafico usando Studio come applicazione reale; misurare reattività e accessibilità; migrare sezioni per incrementi autonomi.
6. Valutare persistenza strutturale, formati di scambio, workspace, diff e versionamento dopo evidenza di utilità.

Ordine indicativo, non assegnazione di release. Non sostituire l'editor attuale prima di verificare i flussi reali. MPS (projectional editing), Hazel (typed holes), Blockly (composizione), Pharo/Roassal (esplorazione) sono riferimenti da studiare, non dipendenze o architetture da importare integralmente. CodeMirror rimane un'opzione per editing testuale, non un prerequisito del laboratorio strutturale.

Prima di integrare ogni incremento: test di transizioni, invarianti, scope, import/export, diagnosi e compatibilità del compilatore JS/PHP dove applicabile; test browser, verifiche mobile reali, misure riproducibili e CI verde. Distinguere prototipo, funzionalità implementata e garanzia effettivamente verificata. La UX, non la quantità di nuove feature, decide se un esperimento ha successo.

## Primo incremento — Projection Lab (candidato)

Pagina autonoma `projection-lab.html`, indicizzata in Studio e inclusa nella cache PWA. Usa il vero Bridge AST per il programma iniziale, con adattatore limitato a dichiarazioni numeriche, riferimenti e operatori binari +, -, *, /. La tabella immutabile dei nodi con ID locali resta in memoria; `studio/projection-model.mira` implementa sostituzione e composizione, compilate Checked per JS e PHP. Il DOM, l'allocazione degli ID, la navigazione, la storia e l'adattatore sono JavaScript; nessuna textarea globale. Selezione per touch/click e frecce, wrap, cancellazione a buco, sostituzione con numero o riferimento precedente, undo/redo e preferenze CSS (Mira, PHP-like, matematica, terminatori). L'export serializza il sottoinsieme e passa dal vero checker prima di abilitare copia; i buchi non sono esportabili. Non è un secondo parser. Test automatici per transizioni, immutabilità, identità, export, verifica JS/PHP e asset offline. Nessun formato di persistenza scelto, nessun import generale, nessun match o inferenza semantica dei buchi; il prototipo limita i riferimenti ai nomi delle dichiarazioni precedenti. La fluidità su iPhone/iPad e le misure UX restano da verificare realmente; la CI non prova l'ergonomia.

## Secondo incremento — editing in situ e match (candidato)

L'input deve comparire al posto dell'espressione selezionata, non in un pannello lontano. Toccare un literal/riferimento/buco apre l'input direttamente nella proiezione HTML; Invio o digitazione diretta da tastiera apre l'editing, Esc annulla, i suggerimenti sono adiacenti al campo. Il nodo non cambia prima della conferma; navigare altrove annulla la bozza. La proiezione completa è ancora ricostruita dopo una transazione; focus e comportamento IME richiedono test su dispositivi fisici. Il sottoinsieme del laboratorio è numerico: Number è il tipo atteso dei buchi per costruzione, non inferenza generale. I riferimenti suggeriti sono filtrati tramite il report checked reale delle dichiarazioni precedenti; contesti incompleti non producono garanzie inventate. L'esempio Match aggiunge un prefisso fisso con un tipo somma e un valore: le alternative e le arità dei payload derivano dallo schema del checker, non da una lista di casi cablata. I rami nascono come buchi numerici; i payload numerici sono suggeriti nel ramo, gli altri non lo sono. Keyword e tag restano atomici. L'export completo passa sempre dal checker. Nessun import generico, servizio semantico incrementale o generalizzazione dei typed holes in questo incremento. Non sono ancora misurati latenza e UX mobile.

## Terzo incremento — viewport mobile (candidato)

Feedback reale su iPhone: l'editing in situ non basta se la tastiera virtuale nasconde campo o suggerimenti e costringe a scrollare. Il campo rimane nel nodo; l'adapter DOM usa VisualViewport.offsetTop/height, resize e verifiche limitate durante l'animazione di focus per effettuare solo lo scroll necessario. Se l'intero editor non entra nel viewport, precedenza al campo di input. Nessun listener sullo scroll ordinario: l'utente deve poter navigare liberamente. I suggerimenti sono una sola striscia orizzontale compatta, con scorrimento del candidato attivo; la lista non ricalcola il report a ogni carattere (contesto fissato durante la bozza). Su schermi stretti si riducono margini e spaziatura, mantenendo input a 16 px e controlli touch da 44 px. Test di geometria e regressione in Chromium con viewport 390×300, ridotto mentre un buco del match è in editing; questa simulazione non equivale alla tastiera iOS. La verifica finale su iPhone reale resta necessaria. Nessuna modifica alla semantica del linguaggio o alla persistenza.

## Quarto incremento — continuità tra i buchi (candidato)

Dopo conferma dell'autore sul viewport iPhone, il laboratorio avanza automaticamente al prossimo buco in ordine visuale dopo l'inserimento di un numero/riferimento in un buco; se necessario riparte da quelli precedenti, e termina quando sono tutti completi. Undo/redo conserva la selezione nella stessa transazione. Tab/Maiusc+Tab consentono navigazione esplicita tra i buchi (la bozza non confermata viene abbandonata). Un solo input nativo rimane connesso nel DOM per tutta la sequenza: un segnaposto nel nodo riserva spazio e l'editor sovrapposto coincide con la sua posizione, senza spostare fisicamente l'input tra genitori DOM. Le conferme sostituiscono solo il sottoalbero modificato; undo/redo e cambio esempio mantengono il ridisegno completo. I test verificano continuità del focus e identità effettiva dell'input e di una dichiarazione non modificata in Chromium con viewport ridotto. La tastiera iOS reale rimane da verificare; non è stata introdotta inferenza generale dei buchi o persistenza. Le transizioni strutturali Mira Checked restano invariate; il coordinamento del browser e la navigazione sono ancora JS.
