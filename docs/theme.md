# Mira Theme — Cozy Balanced

La fonte canonica del design è `studio/theme-lab.html`: il codice della demo Mira Soft Touch — Cozy Edition approvato nella conversazione, non una ricostruzione dalle fotografie. Le sole modifiche interne sono i default tipografici (16 px, 0.05em; slider e ripristino coerenti). La pagina principale Theme Lab è pubblicata e precacheata da Studio. Le dodici palette (Prisma, Acqua, Cristallo, Ambra, Salvia, Corallo, Avorio, Laguna, Orchidea, Notturno, Grafite, Bosco), i cinque colori modificabili, le modalità font, le formule cromatiche e il contrasto indicativo restano quelli della demo. Il materiale Balanced resta 74/0/29/64/0. Nessun font esterno, texture raster o dipendenza aggiunta.

La demo usa direttamente il DOM e JavaScript; non è una view compilata da Mira. Il salvataggio resta in memoria. Non è una certificazione WCAG, né una garanzia di identità fra browser con font locali diversi.

## Renderer nativo: esperimento precedente

`studio/theme-native-lab.html` conserva la precedente view Mira compilata e i test della sua semantica, accessibile dal laboratorio principale. Il suo CSS sperimentale (`studio/mira-theme.css`) non è il riferimento visivo e non è ancora equivalente alla Cozy Edition. Non è il tema predefinito del laboratorio principale. Prima del porting, confrontare il DOM e gli stili effettivi con il riferimento canonico senza reinterpretare il design; estendere il contratto GUI solo quando necessario (slider, toggle, tab e ruoli semantici). Lo stato dell'app deve restare indipendente dal tema. Il browser deve comunque ricalcolare stili e, se necessario, layout e paint. Nessuna modifica al compilatore o ai renderer in questa iterazione.
