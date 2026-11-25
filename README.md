# Playbook

App web per allenatori di football americano: crea il tuo playbook di attacco e di difesa.
Pensata prima di tutto per il computer (mouse e tastiera); la versione per telefono e tablet arriverà dopo.

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
