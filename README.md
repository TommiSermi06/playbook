# Playbook

App web per allenatori di football americano: crea il tuo playbook di attacco e di difesa.
Pensata prima di tutto per il computer (mouse e tastiera); la versione per telefono e tablet arriverà dopo.

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
- `dati.js` — salvataggio degli schemi (unico punto da cambiare per passare al cloud)
- `app.js` — disegno del campo, trascinamento, schermate
