/* ==========================================================================
   PROPOSTE DELLO STAFF (versione telefono)
   --------------------------------------------------------------------------
   I co-allenatori con il permesso «Solo proposte» mandano modifiche,
   schemi nuovi o eliminazioni. Il proprietario del playbook le vede qui,
   con il disegno di adesso e quello proposto, e le accetta o le rifiuta.
   Funziona come la finestra «📥 Proposte» del computer (stessi dati).
   ========================================================================== */

Stato.proposte = [];

const NOMI_TIPO = { modifica: "Modifica", nuovo: "Schema nuovo", elimina: "Eliminazione" };

// Scarica le proposte da decidere (solo quelle sui miei playbook)
async function controllaProposte() {
  if (!Cloud.attivo || Stato.vista || !Cloud.utente) return;
  try { Stato.proposte = await Cloud.proposteDaDecidere(); } catch { Stato.proposte = []; }
  mostraContoProposte();
}

// Il pulsante "📥 Proposte" compare solo se ce n'è almeno una
function mostraContoProposte() {
  const n = Stato.proposte.length;
  $("#riga-proposte").hidden = !n;
  $("#conto-proposte").textContent = n;
  const qui = Stato.pb ? Stato.proposte.filter((p) => p.playbook === Stato.pb.id).length : 0;
  $("#riga-proposte-pb").hidden = !qui;
  $("#conto-proposte-pb").textContent = qui;
}

function apriProposte() {
  mostraProposte();
  vai("schermata-proposte");
}
$("#btn-proposte").addEventListener("click", apriProposte);
$("#btn-proposte-pb").addEventListener("click", apriProposte);

function mostraProposte() {
  const box = $("#lista-proposte");
  box.innerHTML = "";
  $("#proposte-vuote").hidden = Stato.proposte.length > 0;
  for (const p of Stato.proposte) {
    const pb = Stato.playbook.find((x) => x.id === p.playbook);
    const attuale = Stato.schemi.find((s) => s.id === p.schema_id);
    const card = el("article", "proposta appare");
    const testa = el("div", "proposta-testa");
    testa.appendChild(el("span", "etichetta-pill tipo-" + p.tipo, NOMI_TIPO[p.tipo]));
    testa.appendChild(el("strong", "", (p.dati && p.dati.nome) || (attuale && attuale.nome) || "Senza nome"));
    card.appendChild(testa);
    const quando = new Date(p.creato).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    card.appendChild(el("p", "proposta-info", `Da ${p.autore_email || "un co-allenatore"}${pb ? ` · «${pb.nome}»` : ""} · ${quando}`));

    // Il disegno di adesso e quello proposto, affiancati
    const campi = el("div", "proposta-campi");
    const figura = (schema, testo, classe = "") => {
      const f = el("figure", "proposta-campo " + classe);
      f.appendChild(svgCampo(schema, "miniatura-proposta", { miniatura: true, ritaglio: true }));
      f.appendChild(el("figcaption", "", testo));
      campi.appendChild(f);
    };
    if (p.tipo === "modifica") {
      if (attuale) figura(attuale, "Adesso");
      figura(p.dati, "Proposta", "nuova");
    } else if (p.tipo === "nuovo") {
      figura(p.dati, "Schema proposto", "nuova");
    } else if (attuale) {
      figura(attuale, "Da eliminare", "da-eliminare");
    }
    card.appendChild(campi);
    if (p.tipo === "modifica" && attuale && attuale.modificato > new Date(p.creato).getTime()) {
      card.appendChild(el("p", "proposta-avviso", "Lo schema è cambiato dopo questa proposta: se accetti, vince la proposta."));
    }

    const azioni = el("div", "proposta-azioni");
    const no = el("button", "btn-secondario-m toccabile", "Rifiuta");
    const si = el("button", "btn-pieno toccabile", "Accetta");
    no.addEventListener("click", () => decidi(p, false, card));
    si.addEventListener("click", () => decidi(p, true, card));
    azioni.append(no, si);
    card.appendChild(azioni);
    box.appendChild(card);
  }
}

async function decidi(p, accetta, card) {
  card.classList.add("in-uscita");
  card.querySelectorAll("button").forEach((b) => { b.disabled = true; });
  try {
    if (accetta) {
      if (p.tipo === "elimina") {
        await Cloud.eliminaSchema(p.schema_id);
        Stato.schemi = Stato.schemi.filter((s) => s.id !== p.schema_id);
      } else {
        const s = { ...p.dati, playbook: p.playbook, modificato: Date.now() };
        delete s.bozza;
        delete s.nuovo;
        await Cloud.salvaSchemi([s]);
        const i = Stato.schemi.findIndex((x) => x.id === s.id);
        if (i >= 0) Stato.schemi[i] = s; else Stato.schemi.push(s);
      }
      salvaCopia();
    }
    await Cloud.decidiProposta(p.id, accetta ? "accettata" : "rifiutata");
    Stato.proposte = Stato.proposte.filter((x) => x.id !== p.id);
    mostraContoProposte();
    avviso(accetta ? "Proposta accettata" : "Proposta rifiutata");
    setTimeout(mostraProposte, 250);
  } catch {
    card.classList.remove("in-uscita");
    card.querySelectorAll("button").forEach((b) => { b.disabled = false; });
    avviso("Serve la rete per decidere le proposte");
  }
}
