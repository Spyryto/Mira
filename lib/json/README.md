# JSON tipizzato (0.84)

Dal root: npm run build:json genera dist/json-service/{decoder,host,bindings}.json
a partire dal contratto Mira non collegato e dalla mappa decoder.json.
Quest'ultima contiene soltanto nomi di modulo, selector, provider e capability,
non il tipo del risultato. La build Studio usa lo stesso generatore.

```sh
node dist/mira.cjs lib/json/App.mira js --module-root lib/common --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
node dist/mira.cjs lib/json/App.mira php --module-root lib/common --checked --tree-shake --host dist/json-service/host.json --bindings dist/json-service/bindings.json
```

JS: caricare runtime/js/typed-data.js e json-host.js; passare
MiraJsonDecoder.host(binding) come __miraHost, dove binding è il contenuto
JSON di decoder.json generato in dist/json-service. PHP: require json-host.php
e assegnare a $GLOBALS["__miraHost"] il risultato di Mira\Json\host(binding)
con lo stesso file decodificato in array associativo. L'adapter PHP riusa
runtime/php/TypedData.php, mantenere il percorso relativo o adattare il require.

Schema chiuso, dati concreti, niente coercizione. 16 KiB, profondità schema
30, Unicode valido, numeri finiti e interi sicuri. Errori invalid_json_data.
Niente Result, null tipizzato, nominali o refinement in questa versione;
chiavi duplicate seguono la politica nativa last-key-wins. Il tipo è derivato
dal contratto, non dal JSON ricevuto. Il contratto può cambiare a build time;
non è possibile richiedere uno schema arbitrario a runtime.

## 0.85: variante fallibile

try decode lesson: restituisce Result (record della lezione, Text), definito nel contratto.
Il decoder diretto rimane disponibile. Dopo build:json si può compilare
lib/json/Fallible.mira con gli stessi manifest generati (sostituire il
percorso App.mira negli esempi). Il provider converte il risultato strutturale
privato del decoder in Ok/Err con fold; niente eccezioni per input non valido.
Gli errori inattesi dell'host restano eccezioni. Nessun nuovo costrutto.

## 0.89.7: Result condiviso

Il Result locale di Services / Json viene sostituito con Data / Outcome / Result: identità nominale diversa (migrazione pre-1.0), medesimo valore tag/value e payload Text. Importare i tipi/costruttori da Data / Outcome. Entrambi i provider JSON usano decoded result: di Data / Decoder Outcome, funzione parametrica che converte il privato envelope zero/uno in Result con fold. È una convenzione di adapter fidati, non un validatore generico per envelope arbitrari; più elementi darebbero l'ultimo. Il generatore controlla ancora identità e payload, usa per default Result comune, mantiene resultType esplicito per vecchi contratti. Il CLI usa --module-root lib/common, ripetibile, senza copiare sorgenti. Nessun cambio alla struttura JSON, alla validazione wire o agli adapter. Estrazione del validatore puro, encoder, errori JSON più granulari e codec nominali restano aperti.

## 0.91: codec host indipendenti

MiraTypedData.matchesType(value, schema), MiraTypedData.decodeJson(text, schema), MiraTypedData.encodeJson(value, schema) in JS; corrispondenti funzioni Mira\\TypedData in PHP. Usare lo schema del binding decoder generato, non un tipo ricavato dal dato ricevuto. Limite 16 KiB UTF-8 e profondità 30, errori invalid_json_data per dati invalidi, senza dipendenze da RPC/effects. Gli encoder producono JSON semanticamente equivalente, non necessariamente identico in byte tra i target. Il controllo size riguarda il testo effettivamente prodotto. Il decoder Mira originale conserva API e schema. L'encoder non è ancora esposto da un contratto Mira; nuovi codec nominali e refinement restano aperti. Il runtime RPC richiede lo stesso asset/modulo dati; nei bundle ufficiali è incluso automaticamente.
