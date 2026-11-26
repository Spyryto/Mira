# Importa una lezione (Mira 0.89)

Esempio verticale checked che usa Text, Date, Storage, Http e il generatore
di decoder JSON. App.mira contiene validazione di dominio, classificazione
HTTP, compenso e decisione di salvataggio. Il JSON include la data civile;
il contratto applicativo genera lo schema (nessuna duplicazione nel manifest).

npm run build:studio produce la pagina lesson-import.html, il programma JS
fisso compilato, lo schema e il PHP compilato ispezionabile in Studio.
Il provider Browser usa localStorage con namespace separato, Files usa
una directory privata preesistente. I test eseguono entrambe le emissioni.
La pagina recupera un esempio versionato HTTP same-origin (anche offline
con cache installata), permette di modificarlo, validarlo, salvarlo e
recuperarlo. Non usa dati personali reali, non modifica il registro storico.

Limiti: un solo slot, tariffa fissa dimostrativa 30 €/ora, niente arrotondamento
monetario di produzione, tag non visualizzati, nessuna autenticazione,
sincronizzazione o backup. HTML/JS controlla la UI e l'effetto asincrono;
Mira non accede direttamente a DOM o rete. PHP è un test CLI, non un deploy.
