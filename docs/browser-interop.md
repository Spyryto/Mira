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
