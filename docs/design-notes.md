# Mira — Quaderno di progettazione

Questo quaderno raccoglie decisioni e proposte delle discussioni fino alla 0.52. Non è una specifica eseguibile. Le indicazioni di stato distinguono ciò che è verificato dalla direzione concordata e dagli aspetti ancora aperti.

## Principi — direzione concordata

Un linguaggio ricco con un runtime povero. Spostare a compile time le decisioni che possono essere prese correttamente, senza aumentare inutilmente la complessità del compilatore. La ricchezza sintattica, la tipizzazione e l'analisi statica non devono obbligare a portare nel programma generato parser, tabelle grammaticali, wrapper nominali o dispatch dinamico evitabile.

Preferire primitive componibili, rappresentazioni canoniche, API piccole, disaccoppiamento e rappresentazioni native dei target JS/PHP. Eleganza non significa minimalismo assoluto: introdurre complessità quando utile e motivarla. Verificare correttezza e costo con CI e benchmark (compilazione, throughput, esecuzione, dimensioni del codice e del runtime, memoria e DOM). Non promettere costo zero senza misure. Prima della 1.0 documentare eventuali incompatibilità senza sacrificare buone scelte architetturali.

## Operatori logici e valori funzione — implementato in 0.51

AND, OR, NOT sono parole riservate case-sensitive. La proposta precedente di & è stata superata prima dell'integrazione. AND e OR infissi sono short-circuit; NOT si abbassa alla condizionale canonica. Nel codice controllato gli operandi devono essere Boolean, non Number convertiti implicitamente.

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
invert = (NOT);
sum = fold: [1, 2, 3], with: (+), from: 0;
```

Le forme (+), (*), (AND), (OR), (NOT) sono funzioni di prima classe; le sezioni con placeholder come (_ * 2) rimangono disponibili. Gli argomenti di una normale funzione sono valutati prima della chiamata, anche quando la funzione rappresenta AND o OR. Questa differenza rispetto agli operatori infissi è intenzionale. Nessun nuovo dispatch.

## Precedenze — implementazione attuale e direzione concordata

In 0.52 accesso ~ e applicazione per giustapposizione precedono gli operatori binari preesistenti; aritmetica, confronti e >> condividono ancora il livello sinistro-associativo. Seguono NOT, AND, OR. Non confondere questa grammatica verificata con la proposta seguente.

Direzione: poche famiglie, precedenze e associatività configurabili. La configurazione iniziale proposta, dalla precedenza più alta alla più bassa, è accesso ~, aritmetica + - * / %, confronto == != < > <= >=, NOT, AND, OR, pipeline >>. L'aritmetica conserva l'ordine sinistro di Smalltalk (2 + 3 * 4 vale 20). Il posizionamento preciso del pipeline, le interazioni con selettori e il comportamento dei confronti concatenati vanno sperimentati prima di fissarli. Un confronto non associativo potrebbe richiedere parentesi o AND esplicito. Le parentesi conservano sempre la possibilità di disambiguare.

## Operatori personalizzati — sintassi proposta, non implementata

```mira
(**) :: {
  precedence: above arithmetic,
  associativity: right
};

a (Number) ** b (Number) -> Number =
  power: a, to: b;

exponentiation = (**);
```

La parte sinistra parentetica distingue le proprietà sintattiche di un operatore da una dichiarazione nominale ::. Le proprietà vengono raccolte prima del parsing dei corpi; l'implementazione usa = e le annotazioni ordinarie, senza duplicare la firma. La risoluzione produce AST canonico e chiamate statiche, senza tabelle a runtime. Con associazione destra 2 ** 3 ** 2 significa 2 ** (3 ** 2).

Preferire relazioni above, below, same as rispetto a numeri arbitrari. Possibile modello: grafo di precedenze con verifica di cicli; operatori non confrontabili richiedono parentesi, non una scelta arbitraria. Associatività left, right, none. Occorre ancora definire lessico dei simboli, regole di collisione, operatori prefissi/postfissi, scope e import espliciti: una libreria non deve cambiare silenziosamente il parsing del chiamante. Overloading basato sui tipi è un problema separato, da rinviare fino alla stabilizzazione del checker.

## Grammar Lab — direzione concordata, non implementata

Parametrizzare gradualmente il lexer e parser effettivi, senza scrivere un parser parallelo dimostrativo. Una tabella di operatori e un Pratt parser o precedence climbing sono candidati, non ancora scelte implementate. Profilo grammaticale serializzabile: caratteri degli identificatori, keyword, operatori, precedenze e associatività. L'AST semantico deve essere canonico e indipendente dal profilo.

Sperimentare identificatori Unicode (quantità, façade, etc.), con regole esplicite di caratteri ammessi, normalizzazione NFC, collisioni e mangling portabile JS/PHP. Non limitarsi ad accettare indiscriminatamente ogni carattere.

```mira
# Esempio ipotetico di profilo italiano, non codice ufficiale
Percentuale :: Number dove _ >= 0 E _ <= 100;
sconto (Percentuale) = 15;
```

Localizzare keyword e, eventualmente, tipi primitivi e costrutti; lasciare invariati gli identificatori scelti dall'utente quando si convertono profili. Distinguere grammatica ufficiale e profili sperimentali. Per ora non è deciso come distribuire profili fra moduli né come consentire nuove produzioni grammaticali.

Il laboratorio deve mostrare token, AST, raggruppamento, diagnostica, JS/PHP generati, differenze fra profili, compatibilità sul corpus esistente, collisioni, fuzzing, benchmark ed export/import. Un corpus di test non dimostra matematicamente l'assenza di ambiguità. Il profilo non è parte del runtime generato.

## Nominalità e proiezioni — implementato in 0.49 e 0.50

```mira
Pixels :: Number;
Size :: {width: Pixels, height: Pixels};
Window Size :: Size;
Image Size :: Size;
area of: size (Size) = size ~ width * size ~ height;
area structurally: size (~ Size) = size ~ width * size ~ height;
```

:: introduce identità nominali distinte. Un sottotipo può essere passato al tipo base, non viceversa né a un fratello. Le costruzioni annotate sono esplicite; le chiamate non rietichettano automaticamente i dati. Student Id e Request Id non sono intercambiabili anche se rappresentati entrambi da Number. ~ Tipo apre il record esterno, consente campi extra e preserva le identità nominali dei campi e i vincoli applicabili; non copia né elimina campi. La sintassi alternativa Window Size... non è stata adottata. Oggi ~ riguarda soltanto record nominali; eventuali predicati di record generali sono futuri e non devono essere cancellati dalla proiezione.

## Refinement — implementato in 0.51 e 0.52

```mira
Percentage :: Number where _ >= 0 AND _ <= 100;
Small Percentage :: Percentage where _ <= 10;
half of: p (Percentage) -> Percentage = p / 2;
average of: a (Percentage), and: b (Percentage)
  -> Percentage = (a + b) / 2;
```

I vincoli ereditati si compongono per intersezione; intervalli impossibili sono rifiutati. La 0.52 tiene separati tipo nominale e fatti numerici sulle espressioni. a e b hanno tipo Percentage e intervallo [0,100]; a + b ha tipo Number e intervallo [0,200]; (a + b) / 2 ha tipo Number e intervallo [0,100]. La costruzione del risultato Percentage è provata. Non si pretende che ogni operazione intermedia preservi il tipo nominale: si verifica il vincolo nel punto in cui è richiesto. I test confrontano l'emissione JS/PHP con e senza annotazioni.

La prova iniziale tratta intervalli finiti e +, -, *, /, con limiti conservativi rispetto a floating point e magnitudine portabile; non include divisioni con zero possibile, modulo, correlazioni, propagazione generica di fatti attraverso nomi non annotati o predicati arbitrari. Il checker è opt-in. Nessuna guardia runtime è ancora generata.

## Refinement — prossime decisioni

Tre esiti: vincolo dimostrato (nessuna guardia), certamente violato (errore di compilazione), non dimostrato (oggi rifiutato dal checker, in futuro costruzione verificata o validazione esplicitamente fallibile). Non dichiarare garantito un vincolo non verificato.

```mira
# Esempio futuro: Integer non ancora implementato
Request Id :: Integer where _ > 0;
Timeout :: Integer where _ >= 100 AND _ <= 60000;
Retry Count :: Integer where _ >= 0 AND _ <= 3;
Request :: {id: Request Id, timeout: Timeout, retries: Retry Count};
```

Le guardie dovrebbero essere inserite soltanto dove necessarie, valutando il valore una volta sola. Le violazioni di invarianti sono errori del programma; i dati invalidi prevedibili provenienti da GUI, rete o DB sono risultati fallibili, da rappresentare esplicitamente senza eccezioni. La sintassi seguente è soltanto un'ipotesi, così come Result e type narrowing.

```mira
result = validate: input, as: Percentage;
# Risultato desiderato: Result (Percentage, Validation Error)
if (is valid: input, as: Percentage)
  then (set volume: input)
  else (show error "Invalid volume");
```

I predicati dovrebbero essere puri, deterministici e verificabili; niente esecuzione arbitraria di codice host a compile time. Non introdurre un secondo linguaggio generale dei predicati se l'AST Mira può essere riutilizzato. Una garanzia già ottenuta non va ricontrollata inutilmente; ai confini host/RPC/persistenza vanno verificate le premesse non fidate. I prossimi temi sono Integer, narrowing, estensione dei predicati, guardie, validazione fallibile e integrazione dei contratti con GUI/RPC/DB. Non costituiscono una promessa di numeri di versione.

## GUI — direzione concordata

Generare updater specializzati quando le dipendenze sono determinabili a compile time; preservare nodi, identità stabile e granularità. Stato immutabile, separazione stato/view/effetti. Il runtime svolge soltanto confronti, aggiornamenti effettivi del DOM e gestione realmente dinamica (liste, componenti condizionali, effetti asincroni). Non ricostruire sistematicamente rappresentazioni intermedie se la riconciliazione è eliminabile staticamente. È una direzione di ottimizzazione, non la dichiarazione che tutte le view attuali abbiano già zero overhead.

## Due filoni, una roadmap

Tipi: nominali, strutturali, refinement numerici e prove aritmetiche già integrati; completare le garanzie statiche e la validazione al confine. Grammatica: AND/OR/NOT e valori funzione già integrati; tabella di precedenze, Grammar Lab, Unicode, localizzazione, operatori custom e possibile overloading da sviluppare separatamente. Alternare i due filoni senza abbandonarne uno. Mira Studio è manuale, IDE, esploratore del compilatore, laboratorio di tipi e grammatica, benchmark e storia del progetto.

Quaderno redatto con assistenza IA a partire dalle discussioni e dalla fonte di progetto «Mira — Principi architetturali e linee guida di sviluppo». La documentazione tecnica per le versioni implementate resta in grammar.md, type-checker.md e nelle rispettive suite di test.

## 0.53 — Integer: decisione di implementazione

Integer è un sottotipo numerico portabile limitato agli interi sicuri
di JavaScript, non un wrapper né un alias del tipo int nativo PHP.
Manteniamo Number come tipo ordinario dei letterali e delle operazioni:
le prove di integrità si affiancano alle prove degli intervalli.
Una costruzione Integer verifica sia l'integrità sia la magnitudine;
una costruzione di un refinement intero verifica anche i suoi limiti.
L'aritmetica intermedia non è automaticamente Integer. Sono state
preferite prove conservative all'inferenza generalizzata dei tipi
discreti. Divisione, overflow e confronti con Number non devono
nascondere differenze fra i target. L'uguaglianza stretta numerica
JS/PHP, i confini host, la validazione dinamica e le conversioni
implicite rimangono temi aperti. Vedi type-checker.md.
