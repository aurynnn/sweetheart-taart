<script lang="ts">
  // EmailSettings.svelte — Admin → Instellingen: who gets alerts and which mails go out.
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';

  interface Settings { notifyEmails: string[]; notifyOnNew: boolean; customerMails: boolean; reviewRequests: boolean }

  let settings = $state<Settings>({ notifyEmails: [], notifyOnNew: true, customerMails: true, reviewRequests: true });
  let saved = $state('');
  let configured = $state(true);
  let sender = $state<string | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let draft = $state('');
  let message = $state<{ ok: boolean; text: string } | null>(null);
  let testing = $state(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let dirty = $derived(!loading && JSON.stringify(settings) !== saved);

  onMount(async () => {
    try {
      const data = await (await fetch('/admin/api/email-settings')).json();
      settings = data.settings;
      configured = data.configured;
      sender = data.sender;
      saved = JSON.stringify(settings);
    } catch {
      message = { ok: false, text: 'Instellingen konden niet geladen worden.' };
    } finally {
      loading = false;
    }
  });

  function addEmail() {
    const email = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { message = { ok: false, text: 'Dat e-mailadres lijkt niet te kloppen.' }; return; }
    if (!settings.notifyEmails.includes(email)) settings.notifyEmails = [...settings.notifyEmails, email];
    draft = '';
    message = null;
  }

  async function save() {
    saving = true;
    message = null;
    try {
      const res = await fetch('/admin/api/email-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      settings = data.settings;
      saved = JSON.stringify(settings);
      message = { ok: true, text: 'Opgeslagen ✓' };
    } catch (e: any) {
      message = { ok: false, text: e?.message || 'Opslaan mislukt' };
    } finally {
      saving = false;
    }
  }

  async function sendTest() {
    const to = settings.notifyEmails[0];
    if (!to) return;
    testing = true;
    message = null;
    try {
      const res = await fetch('/admin/api/email-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, template: 'nieuweAanvraag' }) });
      const data = await res.json();
      message = data.success ? { ok: true, text: `Testmail verstuurd naar ${to} — kijk ook in je spam.` } : { ok: false, text: data.error || 'Versturen mislukt' };
    } finally {
      testing = false;
    }
  }

  const TOGGLES: Array<{ key: keyof Omit<Settings, 'notifyEmails'>; title: string; text: string }> = [
    { key: 'notifyOnNew', title: 'Melding bij een nieuwe aanvraag', text: 'Je krijgt meteen een mail met alle details en de voorbeeldfoto.' },
    { key: 'customerMails', title: 'Mails naar klanten', text: '“Aanvraag ontvangen”, “bevestigd” en “niet mogelijk”.' },
    { key: 'reviewRequests', title: 'Review vragen na het ophalen', text: 'De dag na het ophalen (of bij “voltooid”) vragen we de klant om een score.' },
  ];
</script>

{#if loading}
  <p class="muted">Laden…</p>
{:else}
  <div class="email-settings">
    {#if !configured}
      <p class="warn" transition:slide><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> E-mail is nog niet ingesteld (MAILERSEND_API_KEY ontbreekt). Er worden geen mails verstuurd.</p>
    {:else if sender}
      <p class="info"><i class="fa-regular fa-paper-plane" aria-hidden="true"></i> Mails worden verstuurd vanaf <strong>{sender}</strong>.</p>
    {/if}

    <div class="row block">
      <div class="info-col">
        <strong>Meldingen sturen naar</strong>
        <span>Deze adressen krijgen een mail bij elke nieuwe aanvraag.</span>
      </div>
      <div class="recipients">
        {#each settings.notifyEmails as email (email)}
          <span class="chip" transition:fade={{ duration: 150 }}>
            {email}
            <button type="button" aria-label="Verwijder {email}" onclick={() => (settings.notifyEmails = settings.notifyEmails.filter((e) => e !== email))}>×</button>
          </span>
        {/each}
        <form class="add" onsubmit={(e) => { e.preventDefault(); addEmail(); }}>
          <input type="email" placeholder="naam@voorbeeld.be" bind:value={draft} aria-label="E-mailadres toevoegen" />
          <button type="submit" disabled={!draft}>+ Toevoegen</button>
        </form>
      </div>
    </div>

    {#each TOGGLES as t}
      <label class="row">
        <span class="info-col"><strong>{t.title}</strong><span>{t.text}</span></span>
        <span class="switch"><input type="checkbox" bind:checked={settings[t.key]} /><span></span></span>
      </label>
    {/each}

    <div class="actions">
      <a href="/admin/email-preview" target="_blank" class="ghost"><i class="fa-regular fa-eye" aria-hidden="true"></i> Bekijk de mails</a>
      <button type="button" class="ghost" onclick={sendTest} disabled={testing || !settings.notifyEmails.length || !configured}>
        <i class="fa-regular fa-envelope" aria-hidden="true"></i> {testing ? 'Versturen…' : 'Stuur testmail'}
      </button>
      <button type="button" class="save" onclick={save} disabled={!dirty || saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
    </div>
    {#if message}<p class="msg" class:ok={message.ok} role="status" transition:fade>{message.text}</p>{/if}
  </div>
{/if}

<style>
  .email-settings { display: grid; gap: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; overflow: hidden; }
  .warn, .info { margin: 0; padding: 0.8rem 1.25rem; font-size: 0.875rem; }
  .warn { background: #fffbeb; color: #92400e; }
  .info { background: #f8fafc; color: #475569; border-bottom: 1px solid #f1f5f9; }
  .row { display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; padding: 1.1rem 1.25rem; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
  .row.block { align-items: flex-start; flex-wrap: wrap; cursor: default; }
  .info-col { display: grid; gap: 0.2rem; }
  .info-col strong { color: #0f172a; font-size: 0.95rem; }
  .info-col span { color: #64748b; font-size: 0.85rem; }
  .recipients { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; justify-content: flex-end; max-width: 30rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.35rem 0.3rem 0.75rem; border-radius: 999px; background: #fdf2f4; color: #be3455; font-weight: 600; font-size: 0.85rem; }
  .chip button { width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 0; background: rgba(190, 52, 85, 0.12); color: inherit; cursor: pointer; }
  .add { display: flex; gap: 0.35rem; }
  .add input { padding: 0.45rem 0.7rem; border: 1px solid #e2e8f0; border-radius: 0.6rem; font: inherit; min-width: 13rem; }
  .add button { padding: 0.45rem 0.8rem; border-radius: 0.6rem; border: 0; background: #e8788a; color: #fff; font-weight: 600; cursor: pointer; }
  .add button:disabled { opacity: 0.4; }
  .switch { position: relative; flex-shrink: 0; }
  .switch input { position: absolute; opacity: 0; }
  .switch span { display: block; width: 2.6rem; height: 1.5rem; border-radius: 999px; background: #e2e8f0; position: relative; transition: background 200ms; }
  .switch span::after { content: ''; position: absolute; top: 0.18rem; left: 0.18rem; width: 1.14rem; height: 1.14rem; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1); }
  .switch input:checked + span { background: #e8788a; }
  .switch input:checked + span::after { transform: translateX(1.1rem); }
  .switch input:focus-visible + span { outline: 2px solid #e8788a; outline-offset: 2px; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; padding: 1rem 1.25rem; }
  .ghost { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1rem; border-radius: 0.6rem; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-weight: 600; font-size: 0.875rem; cursor: pointer; text-decoration: none; }
  .ghost:disabled { opacity: 0.5; cursor: default; }
  .save { padding: 0.55rem 1.3rem; border-radius: 0.6rem; border: 0; background: #e8788a; color: #fff; font-weight: 700; cursor: pointer; }
  .save:disabled { opacity: 0.45; cursor: default; }
  .msg { margin: 0; padding: 0 1.25rem 1rem; text-align: right; font-size: 0.875rem; color: #b91c1c; }
  .msg.ok { color: #15803d; }
  .muted { color: #94a3b8; }
  @media (max-width: 640px) {
    .recipients { justify-content: flex-start; }
    .add input { min-width: 0; flex: 1; }
  }
</style>
