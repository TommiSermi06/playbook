/* ==========================================================================
   CONFIGURAZIONE DEL SERVIZIO ONLINE (Supabase)
   --------------------------------------------------------------------------
   Qui vanno i due dati del progetto Supabase dell'app:
   Supabase → il progetto → Project Settings → API (o "Data API").

   - URL:  "Project URL", tipo https://abcdefgh.supabase.co
   - KEY:  la chiave "anon" / "publishable". È FATTA per stare nel codice
           di un'app web: i dati restano protetti dalle regole di sicurezza
           (Row Level Security) definite in supabase/setup.sql.
           NON mettere mai qui la chiave "service_role" / "secret".

   Se i due campi sono vuoti, l'app funziona in "modalità locale":
   niente account, i dati restano solo su questo computer.
   ========================================================================== */

const CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_KEY: "",
};
