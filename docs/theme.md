# Mira Theme — fondazione sperimentale

Il tema approvato è tradotto in CSS nativo, non in un nuovo renderer. I cinque assi sono indipendenti: palette (Notturno, Grafite, Prisma, Bosco, Ambra), superfici (Balanced/Flat), tipografia (Cozy/System), geometria e densità. I valori sono approssimazioni dei riferimenti visivi, non campioni pixel-perfect. La tipografia usa font di sistema.

`studio/mira-theme.css` è riutilizzabile su un contenitore `.mira-theme` che ospita i nodi esistenti del renderer. Gli attributi data-* scelgono i preset; senza JS il tema predefinito è Notturno. Nessuna dipendenza, nessun nuovo nodo per widget, nessun cambiamento all'ABI o al compilatore, nessun accesso alla rete. Gli stili espliciti della view mantengono precedenza grazie agli stili inline.

Il Theme Lab compila una vera view Mira, usa l'host generico e cambia solo gli attributi del contenitore. Lo stato dell'app resta indipendente dal tema. Il browser deve comunque ricalcolare stili e, per font/densità/geometria, eventualmente layout e paint: non sono operazioni a costo zero. Il tema precedente delle anteprime e delle altre pagine resta invariato.

Prima di promuoverlo a default: test su iPhone e TV, contrasto e accessibilità, confronto Flat/Balanced per paint e frame time, verifica con renderer specializzato, design dei ruoli semantici dei pulsanti e implementazione di slider, toggle e tab nel contratto GUI. Nessun nuovo widget è dichiarato implementato qui.

## Widget Kit — primo incremento

I selettori `switch:checked:update:` e `slider:value:update:` sono funzioni della libreria GUI ordinaria; il checker riconosce le firme Boolean e Number. Lo switch usa un checkbox nativo con role=switch, lo slider un input range nativo con min=0, max=100, step=1. Il valore dello slider è un intero percentuale; il limite è validato dal DOM host, non ancora dimostrato dal type checker. Entrambi condividono la gestione del binding e sono ammessi dal pass specializzato; il percorso ibrido usa la stessa validazione. Nessun nuovo nodo o listener aggiuntivo rispetto al controllo nativo. I tab e la progress bar restano da fare. Il precedente paragrafo di roadmap descrive lo stato prima di questo incremento.
