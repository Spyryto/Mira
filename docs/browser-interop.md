# Interoperabilità browser: alert, view e contatore

Questa iterazione **non aggiunge keyword o sintassi speciale al linguaggio**.
I programmi Mira usano normali funzioni dell'ambiente host, come `alert` e
`render`, risolte attraverso `studio/host.json`.

Tre programmi completi e modificabili sono nel catalogo, alla feature
**UI web e interoperabilità**. Apri un esempio in Mira Studio, seleziona
**JS** e premi **Esegui** oppure **Anteprima UI**.

## 1. Alert

```mira
render {type: "text", text: "Un messaggio generato da Mira"};
alert "Ciao dal linguaggio Mira!";
```

`alert` è una callable host: nell'anteprima la implementiamo con un
`<dialog>` HTML, così il messaggio rimane nell'iframe isolato e non blocca
la pagina di Studio. Non è un'istruzione speciale del compilatore.

## 2. Una view e un pulsante

```mira
say hello: ignored = alert "Ciao dal pulsante!";

render {
  type: "column",
  children: [
    {type: "title", text: "Interfaccia Mira"},
    {type: "text", text: "Una view costruita con record"},
    {type: "button", label: "Salutami", onClick: (say hello: _)}
  ]
};
```

`render` interpreta un **record**. I tipi di view riconosciuti dal piccolo
host iniziale sono `column`, `title`, `text`, `button` e `state`.
Le proprietà testuali vengono assegnate con `textContent`, non con
`innerHTML`. Una view non è una componente JavaScript arbitraria.

## 3. Un contatore con stato e transizioni Mira

```mira
increment: value = value + 1;
decrement: value = value - 1;

counter view: value = {
  type: "column",
  children: [
    {type: "title", text: "Contatore"},
    {type: "text", text: value},
    {type: "button", label: "+1", update: (increment: _)},
    {type: "button", label: "-1", update: (decrement: _)}
  ]
};

render {type: "state", initial: 0, view: (counter view: _)};
```

Il browser **conserva** il valore corrente e collega gli eventi;
`increment:`, `decrement:` e `counter view:` sono funzioni **Mira**
compilate realmente in JavaScript. Quando arriva il clic, il renderer
chiama `update(oldValue)` e rigenera il sottoalbero con `view(newValue)`.
Il ciclo è un embrione di MVU, ma senza aggiungere ancora una sintassi
dedicata al linguaggio.

## Host Environment e backend

`studio/host.json` registra `render` e `alert` sotto `callables`.
Il compilatore non conosce DOM, eventi o finestre: produce chiamate come
`__miraHost["render"](...)` e `__miraHost["alert"](...)`.

I tre sorgenti sono **traspilabili sia in JS sia in PHP**. L'esecuzione
interattiva, però, richiede un ambiente DOM e viene verificata soltanto
sul browser host JavaScript. PHP non può mostrare la view da solo:
richiederebbe un host PHP specifico, per esempio un renderer server-side.

## Anteprima e limiti

L'anteprima viene eseguita in `studio/ui-preview.html`, inserita come
`iframe sandbox="allow-scripts"` **senza** `allow-same-origin`.
In questo modo il codice non ha accesso alla DOM o allo storage
same-origin della pagina madre. La preview non è un sistema di esecuzione
sicuro per codice sconosciuto, perché uno script nel sandbox mantiene
altre capacità del browser, per esempio richieste di rete consentite
dalle policy applicabili.

L'host usa una whitelist di nodi UI e limiti di dimensione/profondità.
Non sono supportati ancora CSS arbitrario, HTML raw, form completi, diffing,
lifecycle delle componenti, un framework MVU o tipi statici delle view.

Per consultare il codice: `studio/ui-host.js` (capability e renderer),
`studio/ui-preview.js` (avvio isolato), `test/ui-host.test.mjs` (test dei
clic e delle transizioni), `catalog/examples/browser-*.mira` (sorgenti Mira).

## Mira 0.15: libreria GUI e binding

La libreria [lib/gui.mira](../lib/gui.mira) costruisce i record mediante
normali selettori, senza accesso al DOM. Gli esempi nel catalogo dichiarano
esplicitamente la dipendenza `library: "lib/gui.mira"`; il generatore
concatena i due sorgenti prima della compilazione. Non è un sistema di
moduli né un prelude implicito.

| Costruttore Mira | Comportamento |
| --- | --- |
| `column: items` / `row: items` | Layout verticale/orizzontale |
| `title: caption` / `text: content` | Titoli e testi |
| `button: caption, on click: action` | Evento, anche closure nullaria |
| `button: caption, update: transition` | Transizione unaria di stato |
| `text input: caption, value: current, update: transition` | Testo controllato |
| `checkbox: caption, checked: current, update: transition` | Booleano controllato |
| `choose: caption, value: current, options: choices, update: transition` | Scelta tra stringhe |
| `state: initial, view: factory` | Stato e funzione che produce la view |

I controlli richiedono un antenato state e una funzione binaria
`{old, entered | nextState}`. L'host conserva lo stato, legge unicamente
il valore nativo dell'evento e chiama la funzione Mira. La view viene
ricostruita; se la nuova view non è valida, lo stato precedente rimane.
Il testo usa l'evento input e attende la fine della composizione IME.
Focus e selezione sono ripristinati quando il controllo corrispondente
mantiene posizione strutturale, tipo ed etichetta. Non è un diff DOM:
comportamento della tastiera mobile e cambi strutturali richiedono
ulteriore verifica su browser reali. Uno state annidato può essere
ricreato durante un refresh del genitore.

Le funzioni costruttrici funzionano su JS/PHP, ma gli eventi e il
renderer DOM richiedono JS browser. Niente CSS arbitrario, component
lifecycle, moduli, validazione statica delle view o binding mutabile.
La Scheda lezione è un esempio reale nel catalogo; non sostituisce
ancora il controller di Studio.

## Mira 0.16: DOM incrementale

La view è ancora un record Mira. L'host conserva istanze con il nodo DOM
nativo, le callback correnti e, per state, il valore locale. Valida la
nuova descrizione (incluse le view annidate) prima di applicare modifiche.
Il confronto avviene per posizione fra fratelli e tipo: mantiene nodi
compatibili, aggiorna testo e proprietà se diversi, sostituisce i nodi
incompatibili e rimuove quelli in eccesso. Gli input compatibili non
vengono scollegati dal DOM: non serve ripristinare artificialmente focus
e selezione. Non scrive value se è già corretto; protegge la composizione
IME e ignora il secondo evento con un valore identico. Le callback
leggono la descrizione corrente, non quella della creazione.

Lo state figlio conserva il proprio valore durante gli aggiornamenti
del genitore. La sua funzione view viene aggiornata, quindi può catturare
i nuovi valori del genitore. initial vale solo al primo montaggio.
Per forzare un reset si può usare `state: initial, key: identity, view: factory`:
identity è una stringa, e una chiave diversa nella stessa posizione
rimonta quel sottoalbero. Le callback dei nodi rimossi vengono disattivate.
Una chiamata esplicita a render rimonta l'intera view.

Limiti: niente riordino per chiavi, niente lifecycle, niente ottimizzazione
della valutazione delle view Mira. L'identità è posizionale, quindi un
inserimento di fratelli dello stesso tipo può riutilizzare lo stato nella
stessa posizione; usare una chiave per forzare il reset. La validazione
precede le scritture DOM ma non annulla eventuali effetti host durante
la valutazione di view. I test verificano identità, eventi, IME e stato su
DOM simulato; il comportamento della tastiera iPhone resta da verificare.
