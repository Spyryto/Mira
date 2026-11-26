# Provenienza della documentazione di Mira

> **Documento generato automaticamente** da `scripts/generate-documentation-origin.mjs`.
> Fonte delle attribuzioni: `catalog/documentation-origin.json`.

## Quanto è generato da IA e quanto dal tooling?

| Categoria | Parole | Quota | Documenti coinvolti |
| --- | ---: | ---: | ---: |
| Generata automaticamente dal tooling | 25.206 | 35,5% | 4 |
| Redatta con assistenza IA (dichiarata) | 37.193 | 52,3% | 13 |
| Redazione umana dichiarata | 0 | 0,0% | 0 |
| Provenienza non verificata | 8660 | 12,2% | 3 |
| **Totale** | **71.059** | **100%** | **19** |

I documenti coinvolti **non sono sommabili**: per esempio il README contiene
una sezione generata dal tooling e altre sezioni editoriali. Le percentuali
invece sono calcolate su segmenti disgiunti e sommano al 100% (salvo
arrotondamenti).

## Dettaglio per file e sezione

| Documento | Parte | Categoria | Parole | Generatore |
| --- | --- | --- | ---: | --- |
| [`docs/atlas.md`](../docs/atlas.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 921 | — |
| [`docs/browser-interop.md`](../docs/browser-interop.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 5295 | — |
| [`docs/decisions.md`](../docs/decisions.md) | Intero documento | Provenienza non verificata | 938 | — |
| [`docs/design-notes.md`](../docs/design-notes.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 5849 | — |
| [`docs/dogfooding.md`](../docs/dogfooding.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 652 | — |
| [`docs/grammar.md`](../docs/grammar.md) | Intero documento | Provenienza non verificata | 5884 | — |
| [`docs/gui-rendering.md`](../docs/gui-rendering.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 2154 | — |
| [`docs/mira04.md`](../docs/mira04.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 699 | — |
| [`docs/module-design.md`](../docs/module-design.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 2233 | — |
| [`docs/performance.md`](../docs/performance.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 1030 | — |
| [`docs/reference/api.md`](../docs/reference/api.md) | Intero documento | Generata automaticamente dal tooling | 11.850 | `scripts/generate-reference.mjs` |
| [`docs/reference/examples.md`](../docs/reference/examples.md) | Intero documento | Generata automaticamente dal tooling | 8163 | `scripts/generate-reference.mjs` |
| [`docs/reference/language.md`](../docs/reference/language.md) | Intero documento | Generata automaticamente dal tooling | 3842 | `scripts/generate-reference.mjs` |
| [`docs/reference/README.md`](../docs/reference/README.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 161 | — |
| [`docs/structured-data.md`](../docs/structured-data.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 1617 | — |
| [`docs/studio.md`](../docs/studio.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 4194 | — |
| [`docs/syntax.md`](../docs/syntax.md) | Intero documento | Provenienza non verificata | 1838 | — |
| [`docs/type-checker.md`](../docs/type-checker.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 7938 | — |
| [`README.md`](../README.md) | Resto del documento | Redatta con assistenza IA (dichiarata) | 4450 | — |
| [`README.md`](../README.md) | Sezione generata | Generata automaticamente dal tooling | 1351 | `scripts/generate-reference.mjs` |

## Come interpretare le cifre

- **Tooling** significa che uno script compone materialmente il Markdown
  pubblicato: guide, esempi, API e la tabella delle feature nel README.
  Le fonti che alimentano questi documenti possono essere state scritte
  con l’aiuto dell’IA: le due dimensioni quindi non sono equivalenti.
- **IA assistita/dichiarata** significa testo editoriale preparato o
  rielaborato durante lo sviluppo con un assistente IA. Non stima quanti
  singoli token siano stati digitati da una persona o generati dal modello.
- **Umana dichiarata** è una classificazione esplicita, non dedotta
  automaticamente dal nome dell’autore del commit.
- **Non verificata** è la documentazione storica di cui non si può
  attribuire responsabilmente la redazione. Git non rivela se un testo
  sia stato scritto con l’aiuto dell’IA.

Questa è una **misura riproducibile dei meccanismi di produzione**, non
una prova forense della paternità delle frasi. Include il testo dei blocchi
di codice nei Markdown. Per contare le parole si usano gruppi Unicode di
lettere/numeri, inclusi identificatori di codice.

**Ambito:** README.md e tutti i file Markdown in `docs/`, eccetto
questo stesso report (per evitare un conteggio ricorsivo). Sono esclusi
i file sorgente `catalog/*.json` e `catalog/examples/*.mira`,
il codice e gli asset generati in `dist/`. Possono essere fonti
della documentazione, ma non vengono ricontati come pagine pubblicate.

## Mantenimento automatico

Quando si aggiunge un documento occorre dichiararne l’origine in
[`catalog/documentation-origin.json`](../catalog/documentation-origin.json).
In caso contrario la generazione fallisce invece di inventare un’origine.
La workflow `reference.yml` rigenera questo report e lo salva in
`main` insieme al resto della documentazione.

```sh
npm run docs
node scripts/generate-documentation-origin.mjs --check
```

Dimensione totale classificata: **531.676 byte UTF-8**,
in **19 documenti** e **20 sezioni attribuite**.
