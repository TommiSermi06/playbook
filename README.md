# Playbook

App web per allenatori di football americano: crea il tuo playbook di attacco e di difesa.
Pensata prima di tutto per il computer (mouse e tastiera); la versione per telefono e tablet arriverà dopo.

## Versione 0.44 — riquadro delle tracce: solo sul campo, anche orizzontale

- Il riquadro delle tracce si muove (e si apre) solo nella colonna centrale, sotto la barra del titolo: non copre più l'elenco degli schemi né il pannello di destra
- Pulsante ⇆ nella sua barra: riquadro orizzontale (route su due righe, azioni accanto) o verticale; la scelta resta ricordata

## Versione 0.43 — riquadro delle tracce trascinabile

- Il riquadro che si apre cliccando un giocatore (albero delle route, blocco, copia/incolla…) si sposta trascinandolo dalla barra in alto e resta dove lo lasci, anche per gli altri giocatori; doppio clic sulla barra: torna accanto al giocatore. Resta sempre dentro la finestra

## Versione 0.42 — nomi al limite: margine di sicurezza

- Stampa: un nome viene rimpicciolito anche quando entra «al pelo» (prova con il carattere +7%): la stampante disegna le lettere un filo più larghe dello schermo, e prima alcuni nomi accanto a bollini larghi (PLAY ACT.) finivano con i «…»

## Versione 0.41 — nomi lunghi che entrano e colori delle formazioni scelti dal coach

- Stampa: se il nome di uno schema è troppo lungo, il carattere si rimpicciolisce da solo finché entra tutto (call sheet, wristband, scout cards, schede del playbook), fino a metà grandezza; niente più «…» sui nomi normali, anche in A3
- Colori delle formazioni scelti dal coach (`colori-formazioni.js`): pallino accanto a ogni formazione nell'elenco «Formazione» e nelle opzioni del call sheet, tavolozza di 14 colori + «Altro…» + «Automatico». Salvati nel playbook (`coloriFormazioni`), li sceglie il proprietario
- I colori automatici restano fissi: scegliere il colore di una formazione non cambia quello delle altre

## Versione 0.40 — call sheet con corsa / pass e colore della formazione

- Call sheet: accanto a ogni schema la categoria in breve (CORSA, PASS, PLAY ACT., SCREEN…) col suo colore, e la riga col colore della formazione (GOLD → oro, RED → rosso…; le altre un colore fisso ciascuna). Si può togliere dalle opzioni
- Galleria di stampa: i fogli mostrano la parte alta della pagina ingrandita (niente più pagine che sembrano vuote) e le misure si calcolano dai millimetri veri (A4/A3), non dal browser

## Versione 0.39 — stampa: galleria dei tipi, stili e anteprima

- La finestra «Stampa» parte da una galleria di 6 tipi, ognuno con l'anteprima vera della prima pagina (fatta con i propri schemi): Wristband · Schemi, Wristband · Lista, Call sheet · Schemi, Call sheet · Lista, Playbook, Scout cards (`stampa-scelta.js`)
- Ogni tipo ha i suoi stili, con miniatura: wristband 12 / 8 / 6 / 4 schemi; liste 24 / 36 / 12 grandi / a colori; call sheet per situazione, per categoria, per formazione e griglia di schemi (con titoli a colori); playbook 1 / 2 / 4 / 6 per pagina e «con appunti»; scout cards 1 o 2 per foglio e «vista dall'altra parte»
- Anteprima grande da sfogliare pagina per pagina, che cambia con le opzioni: è esattamente quello che esce in stampa
- Nuove **Scout cards**: una carta per schema con numero e nome grandi e il campo grandissimo
- Corretto: nella stampa l'ordine delle formazioni (trascina / frecce) non si salvava più dopo l'arrivo del riordino degli schemi

## Versione 0.38 — Special teams

- Terza sezione **Special** accanto ad Attacco e Difesa (computer e telefono; non c'è nei playbook flag) — `speciali.js`
- Unità pronte per 11, 9 e 7 giocatori: Kickoff, Kick return, Punt (spread punt), Punt return, Field goal / PAT, Blocco FG, Onside kick. L'unità è la categoria dello schema (filtri, ricerca e stampa per categoria funzionano già)
- Chi calcia sta sotto la linea, chi riceve sopra. Kickoff, Kick return e Punt return hanno il **campo lungo** (50 yarde oltre la linea, distanze vere)
- Colori: calciatori, protezione, copertura e blocchi, ritorno. Pedine per «Crea da zero» con le sigle tipiche (K, P, H, LS, GU, PP, L1…R5, KR, PR, F1…, V1…)
- Tracce pronte: copertura, contenimento, protezione, calcio lungo/corto, ritorno (centrale, destra, sinistra), blocco, rientra e blocca, rush sul calcio; tasti 1–9 e B sul computer
- Squadra avversaria in trasparenza: su un Kickoff si carica il Kick return, su un Punt il Punt return, ecc.
- ▶︎ Gioca: su Punt e Field goal la palla va dallo snapper al punter / holder
- Stampa: «Tutti gli special teams» e raggruppamento per unità

## Versione 0.37 — spazi sistemati

- Nome del giocatore più vicino alla pedina
- Ricerca e filtri per categoria non si sovrappongono più (la ricerca non si schiaccia e i filtri hanno spazio sopra)

## Versione 0.36 — pedine con numero e nome del giocatore

- Ogni pedina può avere un numero (compare «#12» dentro il cerchio al posto del ruolo) e un nome (scritto sotto); il colore resta quello del ruolo (`pedine.js`)
- Numero e nome stanno nel gruppo della pedina: si muovono con lei (trascinamento, animazione, ribalta)
- Computer: campi Numero e Nome nel pannello «Giocatore selezionato», con suggerimenti dei giocatori già usati (il numero completa il nome e viceversa) e «Usa per tutti i X del playbook» (con Annulla; gli schemi bloccati restano come sono)
- Telefono: il pulsante «Giocatore» apre Ruolo / Numero / Nome, con l'interruttore «Usa in tutti gli schemi con questo ruolo»
- In stampa si vedono; nelle miniature solo il numero

## Versione 0.35 — aggiornamento automatico e logo ancora più visibile

- All'apertura (e quando si torna sulla scheda) l'app controlla `versione.json`: se online c'è una versione nuova si ricarica da sola (una volta), senza bisogno di Ctrl+F5 (`aggiornamento.js`)
- Logo a metà campo: i colori più scuri (viola, blu notte, nero) vengono schiariti di più, e la filigrana è un po' meno trasparente

## Versione 0.34 — tema chiaro e logo più visibile

- Pulsante **☀️ Tema chiaro / 🌙 Tema scuro** nella schermata d'accesso, nella pagina dei playbook e in fondo alla barra laterale (scelta ricordata).
- Telefono: tema Automatico / Chiaro / Scuro nell'account, e un pulsante nella schermata d'accesso.
- Logo a metà campo: si usa una copia adattata al colore del campo (sul campo scuro i colori scuri vengono schiariti,
  sul campo chiaro il contrario), così si vedono anche le parti viola o blu notte. Vale anche sul telefono.

## Versione 0.33 — stampa per categoria e tag

- Finestra di stampa: **Raggruppa** per Nessuno · Formazione · Categoria · Tag (ogni gruppo da una pagina nuova, con l'indice in copertina).
- «Applica dati da file» applica anche categorie e tag, e solo i dati presenti nel file.

## Versione 0.32 — categorie e tag

- Pannello **Categoria e tag**: una categoria per schema (attacco: Corsa, Passaggio, Play action, RPO, Screen, Trick play;
  difesa: Zona, Uomo, Blitz, Contro la corsa, Speciale) e tag liberi (Invio per aggiungerli, suggerimenti da quelli già usati).
- Elenco: filtri per categoria sopra gli schemi; la ricerca trova anche tag e categorie. La categoria compare nella riga e in stampa.
- Sul telefono: categoria e tag nello schema, ricerca per tag.

## Versione 0.31 — avversari in trasparenza

- Nuova sezione **Difesa avversaria** (o **Attacco avversario** negli schemi di difesa) nel pannello: opzionale.
  Si carica una formazione (pronta o tua) o uno schema dell'altro lato del playbook, oppure si aggiungono solo alcune pedine.
- Le pedine avversarie si vedono tenui, si trascinano come le proprie e restano dalla loro parte della linea; clic + Canc per toglierne una.
- Mostra/nascondi, Togli tutti; seguono Ribalta e Annulla; si vedono anche sul telefono, nel link condiviso e in stampa.

## Versione 0.30 — più note insieme

- Note sul campo: **Maiusc+clic**, **riquadro** sul prato e **Ctrl+A** per sceglierne più d'una;
  le note scelte si spostano, si ricolorano e si eliminano insieme.
- Pulsante **🗑 Elimina** rosso e con la scritta (con il numero di note scelte), spento se non c'è niente di scelto.

## Versione 0.29 — note sul campo

- Pulsante **✎ Note** sopra il campo: **Testo**, **Freccia** libera e **Zona** colorata, in 5 colori.
  Con le note aperte il mouse lavora solo sulle note (↖ Sposta per sceglierle e trascinarle, doppio clic per riscrivere un testo, Canc per toglierle).
- Fanno parte dello schema: si vedono sul telefono, nel link condiviso e in stampa; seguono Ribalta e Annulla.

## Versione 0.28 — animazione degli schemi

- Pulsante **▶︎ Gioca** sul campo (o barra spaziatrice): i giocatori si muovono lungo le tracce.
  Prima le motion, poi lo snap (il pallone va al QB), poi tutti partono, ognuno alla velocità del suo compito.
  Le tracce restano tenui sotto. 🐢 per il rallentatore. Clic sul campo o Esc per fermare.
- Anche sul telefono (▶︎ Gioca nello schema) e nel link in sola lettura.

## Versione 0.27 — selezione multipla

- **Maiusc+clic** aggiunge o toglie un giocatore; **trascinando sul prato** un riquadro seleziona chi ci sta dentro; **Ctrl+A** tutti.
- Trascinando uno dei selezionati si sposta il gruppo (nessuno supera la linea); frecce per spostarlo, Canc per toglierlo, Esc per deselezionare.
- Pannello: stessa profondità, togli le tracce, togli dal campo. Tutto con Annulla.

## Versione 0.26 — copia e incolla delle tracce

- Clic su un giocatore → **📋 Copia traccia**; clic su un altro → **📥 Incolla traccia** o **⇋ Incolla specchiata**
  (ribaltata destra/sinistra). Funziona anche tra schemi diversi. Tasti: Ctrl+C, Ctrl+V, Ctrl+Maiusc+V. Con Annulla (Ctrl+Z).
- Regole: alla linea solo blocchi, il movimento del QB solo al QB, attacco su attacco e difesa su difesa, niente blocchi nel flag.
- Anche nell'editor del telefono (foglio «Traccia»).

## Versione 0.25 — riordino degli schemi

- Nell'elenco si cambia l'ordine degli schemi **trascinando** una riga sopra o sotto un'altra
  (linea arancione dove andrà), oppure con **Alt + ↑ / ↓** sullo schema aperto. Con «Annulla».
- L'ordine si salva nel playbook: è lo stesso su computer, telefono, stampa, link condiviso e per i co-allenatori.
- Solo il proprietario del playbook può riordinare; con la ricerca attiva il trascinamento è spento.

## Versione 0.24 — link condiviso dal telefono

- Un link in sola lettura (`?vedi=…`) aperto da un telefono porta da solo alla versione per telefono (`mobile/`).
  Sul computer e sul tablet in orizzontale non cambia niente.

## Versione 0.23 — note in orizzontale

- Il riquadro «Note» del call sheet è una fascia larga quanto il foglio, in fondo all'ultima pagina.
  Se lo spazio è poco la fascia si abbassa (fino a un minimo); se non basta, le note vanno su un foglio a parte.

## Versione 0.22 — note sul call sheet

- Call sheet: riquadro **«Note»** con le righe per scrivere a pennarello (opzione già attiva).
  Riempie lo spazio libero in fondo, o prende le colonne vuote dell'ultimo foglio.
- Call sheet A3 solo testo: 5 colonne, tutto in un foglio con la colonna delle note.

## Versione 0.21 — stampa in A3 e numeri/situazioni da file

- Nella finestra di stampa si sceglie il foglio: **A4** o **A3**. Il playbook in A3 è ingrandito;
  il call sheet in A3 usa il foglio intero (solo testo: tutto in un foglio, scritte grandi). Il wristband resta A4.
- Menu ⋯ del playbook → **Applica numeri e situazioni da file…**: riconosce gli schemi dal nome
  e assegna numero di chiamata e situazioni (con Annulla).

## Versione 0.20 — permessi dei co-allenatori e proposte

- All'invito si sceglie il permesso: **Può modificare**, **Solo proposte** o **Solo lettura**
  (si può cambiare anche dopo, dall'elenco dei co-allenatori).
- Solo proposte: ogni modifica diventa una bozza che vede solo chi la fa; con «Invia proposta» arriva al
  proprietario, che dal pulsante **📥 Proposte** vede prima/dopo e accetta o rifiuta. Anche nuovi schemi ed eliminazioni.
- Solo lettura: il co-allenatore guarda e stampa, senza modificare.
- Le regole sono anche nel database (Supabase): serve lo script `supabase/permessi.sql`.

## Versione 0.19 — invito via mail

- Corretto l'errore «infinite recursion detected in policy» dello script dei co-allenatori:
  i controlli ora stanno in funzioni `security definer` (rilanciare `supabase/coallenatori.sql`).
- Quando inviti un coach gli arriva una mail con il link per entrare; se non ha un account
  il link glielo crea e al primo accesso sceglie la password. Pulsante «Rimanda mail» per gli inviti in attesa.
- Per mandare mail a indirizzi esterni al team Supabase serve un servizio SMTP (gratuito) nelle impostazioni di Supabase.

## Versione 0.18 — co-allenatori

- Menu ⋯ del playbook → **Condividi e co-allenatori…**: il proprietario invita un coach con la sua email.
- Quando quel coach accede con la stessa email, il playbook compare tra i suoi («Condiviso da …»)
  e può creare, modificare ed eliminare gli schemi. Rinominare, eliminare, condividere il playbook
  e gestire gli inviti restano al proprietario. Il co-allenatore può lasciare il playbook.
- Ogni minuto (e quando si torna sulla finestra) l'app scarica le modifiche dello staff;
  aprire uno schema senza toccarlo non lo salva più, così non si sovrascrive il lavoro degli altri.
- Su Supabase serve lo script `supabase/coallenatori.sql`.

## Versione 0.17 — condivisione in sola lettura

- Menu ⋯ del playbook → **Condividi (sola lettura)…**: crea un link da mandare a staff e giocatori.
- Chi apre il link non ha bisogno di un account: vede gli schemi, numeri e situazioni, e può stampare
  playbook, wristband e call sheet, ma non può modificare niente.
- Il coach può copiare il link, crearne uno nuovo (il vecchio smette di funzionare) o disattivarlo.
- Su Supabase serve lo script `supabase/condivisione.sql` (tabella `condivisioni` e funzione `playbook_condiviso`).

## Versione 0.16 — wristband e call sheet

- Nuova sezione **Partita** nel pannello di ogni schema: numero di chiamata
  (con avviso se è già usato) e situazioni (1° & 10, 3° & corto, Red zone, Goal line, 2 minuti, Apertura…).
- **Numera in automatico**: dà un numero agli schemi che non ce l'hanno, nell'ordine del playbook (si può annullare).
- Il numero compare nell'elenco degli schemi (`#7 · GOLD`).
- Nella finestra di stampa si sceglie **Playbook**, **Wristband** o **Call sheet**:
  - Wristband: inserti 12 × 7 cm da ritagliare, 12 schemi con mini-disegno o 24 solo testo, da 1 a 10 copie.
  - Call sheet: A4 orizzontale con un riquadro per situazione, mini-schemi facoltativi,
    «Altri schemi» per quelli senza situazione; continua sulla pagina dopo se serve.

## Versione 0.15 — rinomina un ruolo
- Menu ⋯ del playbook → «Rinomina un ruolo…»: cambia una sigla (es. H → RB) in tutti gli schemi del playbook e nelle formazioni salvate dello stesso formato, con anteprima e Annulla

## Versione 0.14 — stampa divisa per formazioni
- «Dividi per formazioni»: gli schemi vengono raggruppati per formazione, ognuna da una pagina nuova
- Ordine delle formazioni scelto dal coach (trascina o frecce), ricordato per ogni playbook
- Opzione «Formazione vuota» come prima scheda di ogni gruppo; indice in copertina diviso per formazione

## Versione 0.13 — importa ed esporta
- Pulsante «Importa» nella pagina dei playbook; «Esporta» nel menu ⋯ di ogni playbook (file .playbook.json)
- Tracce con motion iniziale + route (come nei jet) e rami di opzione tratteggiati (es. hitch o seam)
- La stampa segue l'ordine del playbook

## Versione 0.12 — più playbook
- Pagina «I tuoi playbook» dopo il login: schede con anteprima, tipo, numero di schemi e data; filtri Tutti / Tackle / Flag
- Nuovo playbook: nome, Tackle (11, 9 o 7 giocatori) o Flag (5); il formato è del playbook e vale per tutti i suoi schemi
- Menu ⋯: rinomina, duplica (con tutti gli schemi), elimina (con Annulla)
- La stampa riguarda il playbook aperto; gli schemi di prima finiscono in automatico in un playbook
- Tabella `playbook` su Supabase

## Versione 0.11 — formati e regole
- Formato dello schema: 11, 9, 7 o Flag 5 (il nuovo schema parte dall'ultimo usato)
- Attacco obbligatorio: a 11 almeno 1 C, 2 G, 2 T; a 9 e 7 almeno 1 C e 2 G; nel flag 1 C e niente G/T; un solo centro
- Tavolozza con lista di controllo e pedine spente quando le regole non le permettono
- Nel flag il centro ha l'albero delle route e non esistono blocchi
- Formazioni pronte anche per 9, 7 e Flag 5 (attacco e difesa); «Le tue formazioni» separate per formato

## Versione 0.10 — le tue formazioni
- Con «Crea da zero» e 11 giocatori in campo si salva la formazione con un nome
- Le formazioni salvate sono solo del coach (account) e compaiono in «Le tue formazioni» in ogni nuovo schema
- Eliminabili (con Annulla); sincronizzate online nella tabella `formazioni`

## Versione 0.9.1
- Interruttore «Linea morbida» rifatto in stile iPhone: forma a pillola, pallino fino in fondo, scatto animato anche con il tasto C

## Versione 0.9 — stampa / PDF e linee morbide
- Pulsante Stampa (o Ctrl+P): schema aperto, attacco, difesa o tutto il playbook
- 1, 2, 4 o 6 schemi per pagina A4, campo chiaro (meno inchiostro) o scuro
- Copertina con logo, nome squadra e indice; logo e numero di pagina su ogni foglio; note degli schemi
- Si salva in PDF dalla finestra di stampa del browser («Salva come PDF»): campi vettoriali, nitidi
- Linea morbida (curva) per ogni traccia: tasto C, interruttore nel pannello o voce nel menu; anche durante il disegno a mano

## Versione 0.8.2
- QB: drop 3, 5, 7 passi e rollout destra/sinistra pronti (tasti 1–5), con animazione
- Il movimento del QB finisce con un puntino invece della freccia

## Versione 0.8.1
- QB: niente albero delle route, solo il movimento disegnato a mano (con la freccia)

## Versione 0.8 — regola della linea di scrimmage
- L'attacco non supera mai la linea, la difesa non la supera mai dall'altra parte (mouse, frecce, pedine, profondità)
- Se un giocatore ci prova si ferma sulla linea e la linea si illumina
- Profondità: si scrivono solo le yarde (attacco sempre dietro, difesa sempre oltre)
- Gli schemi vecchi con giocatori oltre la linea vengono rimessi in regola all'apertura

## Versione 0.7 — ritocchi da allenatore
- Profondità del giocatore modificabile: scrivi le yarde e scegli dietro/oltre la linea
- Il pallone compare solo quando c'è il centro (C), con animazione, e lo segue
- Uomini di linea (C, G, T): niente albero delle route, solo blocco dritto o disegnato a mano con la T finale

## Versione 0.6 — formazioni da zero e lucchetto
- Un nuovo schema parte dal campo vuoto: si sceglie una formazione pronta oppure «Crea da zero»
- Tavolozza con le pedine da trascinare in campo (clic = posizione tipica), massimo 11 giocatori
- Togli un giocatore dal menu, dal pannello o con Canc
- Lucchetto (tasto L) con animazione: a schema bloccato il campo non si modifica più

## Versione 0.5 — tracce
- Clic su un giocatore: menu con l'albero delle route (1-Flat … 9-Fly), disegnate in automatico con animazione
- Blocco (B), disegno a mano (T: clic per i punti, Maiusc dritto/45°, doppio clic o Invio per finire)
- Difesa: blitz e zone (flat, hook/curl, centrale, terzo profondo, metà profonda)
- Tipi di linea: route, blocco, motion (ondulata), opzione (tratteggiata), blitz, zona, uomo
- Punti correggibili trascinando le maniglie; la traccia segue il giocatore e si ribalta con lo schema
- Tasti 1–9 sul giocatore selezionato, Canc per rimuovere la traccia

## Versione 0.4 — account e squadra
- Animazione iniziale e accesso con email e password (registrazione, password dimenticata)
- Ogni allenatore ha il suo account: gli schemi si salvano online (Supabase) e sul computer, anche offline
- Nome e logo della squadra (PNG, JPG o PDF: bordi e sfondo bianco tolti in automatico)
- Logo sempre visibile in alto a sinistra e come filigrana sul campo (servirà per le stampe)
- Animazioni: lo stemma "saluta" a ogni salvataggio, anello durante la sincronizzazione, giocatori che entrano in campo

## Attivare gli account (Supabase)
1. Crea un progetto gratuito su supabase.com
2. SQL Editor → incolla `supabase/setup.sql` → Run
3. Authentication → URL Configuration → Site URL: `https://tommisermi06.github.io/playbook/`
4. Copia Project URL e chiave anon/publishable in `config.js`
Senza questi dati l'app funziona in "modalità locale" (solo su questo computer).

## Versione 0.3 — nuovo aspetto
- Tema scuro «campo di notte» con accento ambra e icona nuova
- Giocatori colorati per ruolo (linea, QB, back, ricevitori / linea difensiva, linebacker, secondaria) con legenda
- Campo con strisce, distanze dalla linea su entrambi i lati, primo down tratteggiato
- Barra degli strumenti con Ribalta (tasto R), Annulla e Ripeti

## Versione 0.2 — per computer
- Layout a tre colonne: elenco schemi con ricerca, campo grande, pannello dettagli
- Clic per selezionare un giocatore, trascina per spostarlo (Maiusc = aggancio alla mezza yarda)
- Frecce per spostare il selezionato di mezza yarda (Maiusc = 2 yarde)
- Annulla / Ripeti (Ctrl/⌘+Z, Ctrl/⌘+Maiusc+Z), N = nuovo schema, Ctrl/⌘+D = duplica
- Ruolo del giocatore modificabile e profondità rispetto alla linea
- Distanze dalla linea scritte a bordo campo

## Versione 0.1
- Campo con yarde, hash mark, linea di scrimmage e primo down
- Giocatori trascinabili col dito (iPhone/iPad) o col mouse
- Formazioni di partenza: Pro I, Shotgun 2x2, Trips, Pistol / 4-3, 3-4, Nickel
- Schemi salvati sul dispositivo, divisi tra Attacco e Difesa, con note
- Duplica ed elimina (con Annulla), modalità chiara e scura

## File
- `index.html` — struttura delle due schermate
- `style.css` — stile iOS
- `formazioni.js` — posizioni di partenza (in yarde)
- `regole.js` — formati (11, 9, 7, Flag 5), giocatori obbligatori, formazioni pronte per 9/7/flag
- `config.js` — dati del progetto Supabase
- `cloud.js` — account, profilo squadra e schemi online
- `dati.js` — copia locale degli schemi e sincronizzazione
- `squadra.js` — nome e logo della squadra (anche da PDF)
- `accesso.js` — animazione iniziale e login
- `tracce.js` — albero delle route, disegno e animazione delle tracce
- `costruttore.js` — «Crea da zero»: tavolozza delle pedine
- `lucchetto.js` — blocco e sblocco dello schema
- `stampa.js` — stampa e PDF del playbook
- `playbook.js` — più playbook (Tackle/Flag), pagina «I tuoi playbook»
- `supabase/setup.sql` — tabelle e regole di sicurezza
- `lib/` — librerie Supabase e pdf.js (incluse, senza CDN)
- `app.js` — disegno del campo, trascinamento, schermate
