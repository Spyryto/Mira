# Date civili (Mira 0.86)

Servizio Services / Date con tipo opaco Date; il provider nativo usa
una rappresentazione privata {iso: Text}. La stringa è sempre YYYY-MM-DD,
calendario gregoriano prolettico, anni 0001–9999. UTC è un dettaglio
dell'aritmetica nativa, non parte della data. Niente tempo locale.

| Selettore | Significato |
| --- | --- |
| valid date: | Validazione senza eccezione |
| date from: | Costruzione controllata |
| iso of: | Stringa ISO canonica |
| add days:to: | Somma giorni interi, anche negativi |
| days between:and: | Seconda data meno prima |
| weekday of: | Lunedì 1, domenica 7 |

Errori di costruzione o aritmetica: invalid_date, invalid_day_count,
date_out_of_range. Non si accettano normalizzazioni automatiche,
orari, fusi o anni fuori intervallo. Il conteggio dei giorni è Number
con verifica di integrità al confine host; non è ancora Result.

Dal root, dopo npm run build:

```sh
node dist/mira.cjs lib/date/App.mira js --checked --tree-shake --host lib/date/host.json --bindings lib/date/bindings.json
node dist/mira.cjs lib/date/App.mira php --checked --tree-shake --host lib/date/host.json --bindings lib/date/bindings.json
```

JS: caricare date-host.js e passare MiraDateHost come __miraHost.
PHP: assegnare a $GLOBALS["__miraHost"] la mappa di require date-host.php
prima di eseguire il programma generato. Il servizio non accede
all'orologio né ha dipendenze esterne.
