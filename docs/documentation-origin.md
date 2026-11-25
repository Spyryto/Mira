# Provenienza della documentazione di Mira

> **Documento generato automaticamente** da `scripts/generate-documentation-origin.mjs`.
> Fonte delle attribuzioni: `catalog/documentation-origin.json`.

## Quanto è generato da IA e quanto dal tooling?

| Categoria | Parole | Quota | Documenti coinvolti |
| --- | ---: | ---: | ---: |
| Generata automaticamente dal tooling | 16.411 | 43,9% | 4 |
| Redatta con assistenza IA (dichiarata) | 16.644 | 44,5% | 10 |
| Redazione umana dichiarata | 0 | 0,0% | 0 |
| Provenienza non verificata | 4308 | 11,5% | 3 |
| **Totale** | **37.363** | **100%** | **16** |

I documenti coinvolti **non sono sommabili**: per esempio il README contiene
una sezione generata dal tooling e altre sezioni editoriali. Le percentuali
invece sono calcolate su segmenti disgiunti e sommano al 100% (salvo
arrotondamenti).

## Dettaglio per file e sezione

| Documento | Parte | Categoria | Parole | Generatore |
| --- | --- | --- | ---: | --- |
| [`docs/atlas.md`](../docs/atlas.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 921 | — |
| [`docs/browser-interop.md`](../docs/browser-interop.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 3790 | — |
| [`docs/decisions.md`](../docs/decisions.md) | Intero documento | Provenienza non verificata | 331 | — |
| [`docs/dogfooding.md`](../docs/dogfooding.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 652 | — |
| [`docs/grammar.md`](../docs/grammar.md) | Intero documento | Provenienza non verificata | 2139 | — |
| [`docs/gui-rendering.md`](../docs/gui-rendering.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 1810 | — |
| [`docs/mira04.md`](../docs/mira04.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 699 | — |
| [`docs/performance.md`](../docs/performance.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 698 | — |
| [`docs/reference/api.md`](../docs/reference/api.md) | Intero documento | Generata automaticamente dal tooling | 4904 | `scripts/generate-reference.mjs` |
| [`docs/reference/examples.md`](../docs/reference/examples.md) | Intero documento | Generata automaticamente dal tooling | 7186 | `scripts/generate-reference.mjs` |
| [`docs/reference/language.md`](../docs/reference/language.md) | Intero documento | Generata automaticamente dal tooling | 3711 | `scripts/generate-reference.mjs` |
| [`docs/reference/README.md`](../docs/reference/README.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 161 | — |
| [`docs/structured-data.md`](../docs/structured-data.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 1523 | — |
| [`docs/studio.md`](../docs/studio.md) | Intero documento | Redatta con assistenza IA (dichiarata) | 2941 | — |
| [`docs/syntax.md`](../docs/syntax.md) | Intero documento | Provenienza non verificata | 1838 | — |
| [`README.md`](../README.md) | Resto del documento | Redatta con assistenza IA (dichiarata) | 3449 | — |
| [`README.md`](../README.md) | Sezione generata | Generata automaticamente dal tooling | 610 | `scripts/generate-reference.mjs` |

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

Dimensione totale classificata: **281.471 byte UTF-8**,
in **16 documenti** e **17 sezioni attribuite**.
