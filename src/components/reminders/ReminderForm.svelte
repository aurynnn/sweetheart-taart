<script lang="ts">
  // ReminderForm.svelte — "Herinner me een maand op voorhand".
  // The e-mail address is pre-filled (and verified) when the visitor came from a
  // personal link in one of our mails; changing it switches to double opt-in.
  import { fade, scale, slide } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  let { email: initialEmail = '', customerId = '', token = '', firstname = '', occasions }: {
    email?: string; customerId?: string; token?: string; firstname?: string;
    occasions: Array<{ value: string; label: string }>;
  } = $props();

  let email = $state(initialEmail);
  let editingEmail = $state(!initialEmail);
  let name = $state('');
  let occasion = $state('verjaardag');
  let date = $state('');
  let yearly = $state(true);
  let consent = $state(false);
  let sending = $state(false);
  let error = $state('');
  let result = $state<'active' | 'pending' | null>(null);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const today = new Date().toISOString().slice(0, 10);
  let verifiedEmail = $derived(!!initialEmail && email.trim().toLowerCase() === initialEmail.toLowerCase());

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!EMAIL_RE.test(email.trim())) { error = 'Vul een geldig e-mailadres in.'; return; }
    if (!date) { error = 'Kies de datum van het feest.'; return; }
    if (!consent) { error = 'Vink aan dat we je hiervoor mogen mailen.'; return; }
    sending = true;
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name, occasion, date, yearly, consent, c: customerId, t: token }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      result = data.status;
    } catch (err: any) {
      error = err?.message || 'Er ging iets mis. Probeer het opnieuw.';
    } finally {
      sending = false;
    }
  }
</script>

{#if result}
  <div class="done" in:scale={{ start: 0.9, duration: 500, easing: backOut }}>
    <div class="done-icon" aria-hidden="true"><i class="fa-solid {result === 'active' ? 'fa-bell' : 'fa-envelope-open-text'}"></i></div>
    {#if result === 'active'}
      <h3>Afgesproken!</h3>
      <p>We sturen je een mailtje een maand voor het feest. Je ontvangt zo meteen een bevestiging.</p>
    {:else}
      <h3>Check je mailbox 📬</h3>
      <p>We stuurden een bevestigingslink naar <strong>{email}</strong>. Klik erop om je herinnering te activeren.</p>
    {/if}
    <button type="button" class="again" onclick={() => { result = null; name = ''; date = ''; consent = false; }}>+ Nog een herinnering</button>
  </div>
{:else}
  <form onsubmit={submit} novalidate>
    <label class="field">
      <span class="legend">Jouw e-mailadres</span>
      {#if !editingEmail}
        <span class="email-locked" transition:fade>
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i> {email}
          <button type="button" onclick={() => (editingEmail = true)}>Wijzig</button>
        </span>
      {:else}
        <input type="email" autocomplete="email" bind:value={email} placeholder="jij@voorbeeld.be" required />
        {#if initialEmail && !verifiedEmail}<small transition:slide>Je krijgt eerst een mail om dit adres te bevestigen.</small>{/if}
      {/if}
    </label>

    <fieldset class="field">
      <legend class="legend">Welk feest?</legend>
      <div class="chips">
        {#each occasions as o}
          <button type="button" class="chip" class:is-on={occasion === o.value} aria-pressed={occasion === o.value} onclick={() => (occasion = o.value)}>{o.label}</button>
        {/each}
      </div>
    </fieldset>

    <div class="grid-2">
      <label class="field">
        <span class="legend">Voor wie? <small>(optioneel)</small></span>
        <input type="text" maxlength="60" bind:value={name} placeholder="bv. Emma" />
      </label>
      <label class="field">
        <span class="legend">Datum van het feest</span>
        <input type="date" bind:value={date} min={yearly ? undefined : today} required />
      </label>
    </div>

    <label class="check">
      <input type="checkbox" bind:checked={yearly} />
      <span><strong>Elk jaar herinneren</strong> — handig voor verjaardagen</span>
    </label>

    <label class="check consent">
      <input type="checkbox" bind:checked={consent} />
      <span>Ik wil een herinneringsmail ontvangen, een maand voor deze datum. Uitschrijven kan altijd met één klik. Lees onze <a href="/privacy" target="_blank" rel="noopener">privacyverklaring</a>.</span>
    </label>

    {#if error}<p class="error" role="alert" transition:slide>{error}</p>{/if}

    <button type="submit" class="btn btn-primary submit" disabled={sending}>
      {#if sending}<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Even geduld…{:else}<i class="fa-solid fa-bell" aria-hidden="true"></i> Herinner me{/if}
    </button>
  </form>
{/if}

<style>
  form { display: grid; gap: 1.1rem; }
  .field { display: grid; gap: 0.45rem; border: 0; padding: 0; margin: 0; min-width: 0; }
  .legend { font-weight: 700; font-size: 0.92rem; padding: 0; }
  .legend small { font-weight: 400; color: var(--color-text-muted); }
  input[type='email'], input[type='text'], input[type='date'] { font: inherit; padding: 0.8rem 1rem; border-radius: 0.9rem; border: 1.5px solid var(--color-border); background: #fff; color: var(--color-text); width: 100%; }
  input:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(232, 120, 138, 0.15); }
  .field small { color: var(--color-text-muted); font-size: 0.8rem; }
  .email-locked { display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1rem; border-radius: 0.9rem; background: #F0FDF4; color: #166534; font-weight: 600; overflow-wrap: anywhere; }
  .email-locked button { margin-left: auto; border: 0; background: none; color: var(--color-primary-dark); font-weight: 700; cursor: pointer; text-decoration: underline; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .chip { padding: 0.5rem 0.95rem; border-radius: 999px; border: 1.5px solid var(--color-border); background: #fff; font: inherit; font-size: 0.88rem; font-weight: 600; color: var(--color-text); cursor: pointer; transition: all 250ms var(--ease-spring); }
  .chip:hover { border-color: var(--color-primary); }
  .chip.is-on { background: var(--color-primary); border-color: var(--color-primary); color: #fff; transform: scale(1.04); }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .check { display: flex; gap: 0.65rem; align-items: flex-start; font-size: 0.9rem; color: var(--color-text-muted); cursor: pointer; }
  .check input { width: 1.15rem; height: 1.15rem; margin-top: 0.15rem; accent-color: var(--color-primary); flex-shrink: 0; }
  .check strong { color: var(--color-text); }
  .consent { padding: 0.9rem 1rem; border-radius: 0.9rem; background: var(--color-secondary); }
  .error { margin: 0; color: #DC2626; font-weight: 600; font-size: 0.9rem; }
  .submit { justify-self: start; border-radius: 999px; padding: 0.9rem 1.7rem; }
  .done { text-align: center; display: grid; gap: 0.75rem; justify-items: center; padding: 1rem 0; }
  .done h3 { font-family: var(--font-heading); font-size: 2rem; margin: 0; color: var(--color-text) !important; text-shadow: none !important; }
  .done p { margin: 0; color: var(--color-text-muted); max-width: 26rem; }
  .done-icon { width: 4.2rem; height: 4.2rem; border-radius: 50%; display: grid; place-items: center; background: var(--color-secondary); color: var(--color-primary); font-size: 1.6rem; animation: ring 2.4s ease-in-out infinite; }
  @keyframes ring { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(14deg); } 85% { transform: rotate(-12deg); } 95% { transform: rotate(6deg); } }
  .again { border: 0; background: none; color: var(--color-primary-dark); font-weight: 700; cursor: pointer; }
  @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { .done-icon { animation: none; } }
</style>
