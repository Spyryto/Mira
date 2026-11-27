# Mira 0.96 — Dati dichiarativi a compile time

Stato: implementazione candidata, da verificare in CI.

## Obiettivo

Il compilatore deve conoscere i meccanismi di controllo, non il dominio. La GUI è il primo caso concreto, non un nuovo linguaggio. Si riutilizzano sintassi, AST, somme algebriche ricorsive, record, liste e inferenza già presenti. Nessun nuovo token, parser o wrapper applicativo.

## Contratto effettivo

La fonte delle proprietà e dei domini di stile è [lib/gui-style-contract.mira](../lib/gui-style-contract.mira):

```mira
Scalar Rule ::
    Range ({min: Number, max: Number})
  | Whole ({min: Number, max: Number})
  | Choices ([Text])
  | Pattern (Text)
  | Either ([Scalar Rule]);

length = Range: {min: 0, max: 4096};
size = Either: [length, (Choices: ["fill", "auto"])];

style rules = {
  padding: length,
  width: size,
  fontWeight: (Whole: {min: 100, max: 900})
};
```

I costruttori delle somme descrivono **regole**, non la rappresentazione dei valori applicativi. Un width resta numero o testo nativo, non un valore tagged. Il file reale include tutti gli stili supportati.

## Pipeline

1. Haxe incorpora il sorgente Mira come risorsa del compilatore CLI e Studio.
2. Compiler.parse utilizza lexer, parser e risoluzione esistenti.
3. TypeChecker verifica le dichiarazioni con ambiente host vuoto.
4. ConstantData legge dall'AST canonico record, liste, scalari, riferimenti e costruttori sintetizzati. Non esegue JS, PHP, funzioni arbitrarie o chiamate host. Limiti: 65 536 caratteri, profondità di valutazione 64 e budget di 10 000 nodi valutati.
5. ScalarRules interpreta il vocabolario generico di vincoli scalari (intervalli, interi, scelte testuali, espressioni regolari a corrispondenza completa, alternative). GuiStyleRules associa temporaneamente la risorsa standard al controllo della GUI già presente e la carica pigramente una volta per istanza del compilatore.
6. Il checker usa i vincoli per verificare tipi noti e valori conoscibili a compile time, mantenendo invariati AST applicativo ed emitter.

Le regole sono dati del compilatore: non sono inserite nell'output JS/PHP delle applicazioni. Nessun costo aggiuntivo nel programma generato. Il costo di caricamento e controllo del contratto riguarda invece la compilazione e non è ancora misurato separatamente.

## Laboratorio

In Mira Studio → Laboratorio tipi, **Contratto stili Mira** apre il sorgente effettivamente incorporato nel compilatore. **Valuta dati costanti** mostra il dato canonico relativo al nome scelto (inizialmente `style rules`). Il laboratorio può leggere anche record di altri domini. Modificare il testo nel laboratorio non sostituisce il contratto GUI fidato.

## Limiti e direzione

- ConstantData non è una VM o un interprete completo, non espande macro e non esegue espressioni aritmetiche, blocchi o funzioni arbitrarie. È deliberatamente limitato ai dati. L'ispettore mostra un valore, non autorizza contratti arbitrari.
- Il vocabolario ScalarRules è ancora implementato in Haxe, ma non contiene nomi di proprietà GUI. Le espressioni regolari sono applicate solo dal contratto standard fidato; un eventuale meccanismo per contratti utente deve definire limiti anche sul costo delle regex.
- Il collegamento al costruttore, le firme View e i vincoli di altri widget sono ancora specifici della GUI. La validazione runtime esistente resta invariata: checker e renderer hanno ancora due fonti per le regole, coperte da test di concordanza. Nessuna affermazione di prova per i valori dinamici sconosciuti.
- Passi successivi: associare esplicitamente un contratto ai parametri di una funzione; generalizzare regole di record/liste e vincoli relazionali; eliminare progressivamente le firme speciali, evitando nuovi meccanismi se i tipi esistenti bastano. Valutare un'unica fonte anche per la validazione host, senza imporre runtime generico al codice generato.

La scelta di un piccolo lettore di dati anziché della valutazione arbitraria a compile time limita la complessità e rende verificabile il confine fra compile time e runtime.

## Approfondimento: enumerazioni e rappresentazione

Vedi [Tipi semantici, enumerazioni e rappresentazione nativa](type-representation.md) per i limiti effettivi del checker, la distinzione fra somme e codifica ABI, il confronto con Dart/Flutter, F#, Elm e ReScript/Reason, e le proposte di evoluzione.
