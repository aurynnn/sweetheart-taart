<script lang="ts">
  // PickupTimesEditor.svelte — admin UI for ophaalmomenten.
  // Priority when a customer picks a date: specific date → weekday → standaard.
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import TimeList from './TimeList.svelte';

  interface Config { default: string[]; weekdays: Record<string, string[]>; dates: Record<string, string[]> }

  const DAYS = [
    { key: '1', label: 'Maandag' }, { key: '2', label: 'Dinsdag' }, { key: '3', label: 'Woensdag' },
    { key: '4', label: 'Donderdag' }, { key: '5', label: 'Vrijdag' }, { key: '6', label: 'Zaterdag' }, { key: '0', label: 'Zondag' },
  ];

  let config = $state<Config>({ default: [], weekdays: {}, dates: {} });
  let saved = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let message = $state<{ ok: boolean; text: string } | null>(null);
  let newDate = $state('');

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = iso(new Date());
  let dirty = $derived(!loading && JSON.stringify(config) !== saved);
  let sortedDates = $derived(Object.keys(config.dates).sort());

  let preview = $derived.by(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i);
      const key = iso(d);
      const dow = String(d.getDay());
      const source = config.dates[key] ? 'datum' : config.weekdays[dow] ? 'weekdag' : 'standaard';
      const times = config.dates[key] ?? config.weekdays[dow] ?? config.default;
      return { key, label: d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }), times, source };
    });
  });

  onMount(async () => {
    try {
      const res = await fetch('/admin/api/pickup-times');
      config = await res.json();
      saved = JSON.stringify(config);
    } catch {
      message = { ok: false, text: 'Kon de ophaalmomenten niet laden.' };
    } finally {
      loading = false;
    }
  });

  function toggleWeekday(key: string, on: boolean) {
    const next = { ...config.weekdays };
    if (on) next[key] = [...config.default];
    else delete next[key];
    config.weekdays = next;
  }

  function addDate() {
    if (!newDate || newDate < today || config.dates[newDate]) return;
    const dow = String(new Date(newDate + 'T00:00:00').getDay());
    config.dates = { ...config.dates, [newDate]: [...(config.weekdays[dow] ?? config.default)] };
    newDate = '';
  }

  function removeDate(key: string) {
    const next = { ...config.dates };
    delete next[key];
    config.dates = next;
  }

  async function save() {
    saving = true;
    message = null;
    try {
      const res = await fetch('/admin/api/pickup-times', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      config = data.config;
      saved = JSON.stringify(config);
      message = { ok: true, text: 'Ophaalmomenten opgeslagen ✓' };
    } catch (e: any) {
      message = { ok: false, text: e?.message || 'Opslaan mislukt' };
    } finally {
      saving = false;
    }
  }

  const fmtDate = (k: string) => new Date(k + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
</script>

{#if loading}
  <p class="muted">Laden…</p>
{:else}
  <div class="editor">
    <div class="col">
      <section class="card">
        <header><h3>Standaard</h3><p>Geldt voor alle dagen zonder eigen uren.</p></header>
        <TimeList bind:times={config.default} />
      </section>

      <section class="card">
        <header><h3>Per weekdag</h3><p>Zet “eigen uren” aan om voor een weekdag andere momenten te kiezen.</p></header>
        <ul class="days">
          {#each DAYS as d}
            {@const custom = !!config.weekdays[d.key]}
            <li>
              <div class="day-head">
                <strong>{d.label}</strong>
                <label class="switch">
                  <input type="checkbox" checked={custom} onchange={(e) => toggleWeekday(d.key, e.currentTarget.checked)} />
                  <span></span> eigen uren
                </label>
              </div>
              {#if custom}
                <div transition:slide={{ duration: 200 }}><TimeList bind:times={config.weekdays[d.key]} /></div>
              {:else}
                <TimeList times={config.default} disabled />
              {/if}
            </li>
          {/each}
        </ul>
      </section>

      <section class="card">
        <header><h3>Specifieke datum</h3><p>Uitzondering voor één dag, bv. een feestdag of drukke zaterdag.</p></header>
        <div class="add-date">
          <input type="date" min={today} bind:value={newDate} aria-label="Datum" />
          <button type="button" onclick={addDate} disabled={!newDate || !!config.dates[newDate]}>+ Datum toevoegen</button>
        </div>
        {#if sortedDates.length === 0}
          <p class="muted">Nog geen uitzonderingen.</p>
        {/if}
        <ul class="dates">
          {#each sortedDates as k (k)}
            <li transition:slide={{ duration: 200 }}>
              <div class="day-head">
                <strong>{fmtDate(k)}</strong>
                <button type="button" class="remove" onclick={() => removeDate(k)}>Verwijderen</button>
              </div>
              <TimeList bind:times={config.dates[k]} />
            </li>
          {/each}
        </ul>
      </section>
    </div>

    <aside class="card preview">
      <header><h3>Zo zien klanten het</h3><p>Komende 7 dagen</p></header>
      <ul>
        {#each preview as p (p.key)}
          <li>
            <span class="p-day">{p.label}</span>
            <span class="p-times">{p.times.length ? p.times.join(' · ') : 'geen ophalen'}</span>
            <span class="p-src {p.source}">{p.source}</span>
          </li>
        {/each}
      </ul>
      <p class="muted small">Dagen die gesloten of volzet zijn blijven sowieso onbeschikbaar.</p>
    </aside>
  </div>

  <div class="savebar" class:show={dirty || message}>
    {#if message}<span class:ok={message.ok} class="msg">{message.text}</span>{:else}<span class="msg">Je hebt niet-opgeslagen wijzigingen</span>{/if}
    <button type="button" class="save" disabled={!dirty || saving} onclick={save}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
  </div>
{/if}

<style>
  .editor { display: grid; grid-template-columns: 1fr 20rem; gap: 1.25rem; align-items: start; }
  .col { display: grid; gap: 1.25rem; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 1.25rem; }
  .card header { margin-bottom: 1rem; }
  .card h3 { margin: 0; font-size: 1rem; color: #0f172a; }
  .card header p { margin: 0.2rem 0 0; font-size: 0.85rem; color: #64748b; }
  .days, .dates { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.9rem; }
  .days li, .dates li { padding-bottom: 0.9rem; border-bottom: 1px solid #f1f5f9; display: grid; gap: 0.5rem; }
  .days li:last-child, .dates li:last-child { border-bottom: 0; padding-bottom: 0; }
  .day-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .day-head strong { font-size: 0.9rem; color: #1e293b; text-transform: capitalize; }
  .switch { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.8rem; color: #64748b; cursor: pointer; }
  .switch input { position: absolute; opacity: 0; }
  .switch span { width: 2.2rem; height: 1.25rem; border-radius: 999px; background: #e2e8f0; position: relative; transition: background 200ms; }
  .switch span::after { content: ''; position: absolute; top: 0.15rem; left: 0.15rem; width: 0.95rem; height: 0.95rem; border-radius: 50%; background: #fff; transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  .switch input:checked + span { background: #e8788a; }
  .switch input:checked + span::after { transform: translateX(0.95rem); }
  .switch input:focus-visible + span { outline: 2px solid #e8788a; outline-offset: 2px; }
  .add-date { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .add-date input { padding: 0.45rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font: inherit; }
  .add-date button { padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: 0; background: #e8788a; color: #fff; font-weight: 600; cursor: pointer; }
  .add-date button:disabled { opacity: 0.4; cursor: default; }
  .remove { border: 0; background: none; color: #b91c1c; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
  .muted { color: #94a3b8; font-size: 0.9rem; }
  .small { font-size: 0.78rem; margin: 0.75rem 0 0; }

  .preview { position: sticky; top: 6rem; }
  .preview ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
  .preview li { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem 0.5rem; align-items: center; font-size: 0.82rem; padding-bottom: 0.55rem; border-bottom: 1px solid #f1f5f9; }
  .preview li:last-child { border-bottom: 0; }
  .p-times { grid-column: 1 / -1; grid-row: 2; }
  .p-day { font-weight: 700; color: #334155; text-transform: capitalize; }
  .p-times { color: #475569; font-variant-numeric: tabular-nums; }
  .p-src { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; padding: 0.1rem 0.4rem; border-radius: 999px; background: #f1f5f9; color: #64748b; }
  .p-src.weekdag { background: #eff6ff; color: #1d4ed8; }
  .p-src.datum { background: #fdf2f4; color: #be3455; }

  .savebar { position: sticky; bottom: 1rem; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1.25rem; padding: 0.8rem 1rem 0.8rem 1.25rem; border-radius: 1rem; background: #0f172a; color: #fff; box-shadow: 0 20px 40px -12px rgba(15, 23, 42, 0.45); transform: translateY(150%); opacity: 0; transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms; }
  .savebar.show { transform: none; opacity: 1; }
  .msg { font-size: 0.9rem; }
  .msg.ok { color: #86efac; }
  .save { padding: 0.6rem 1.4rem; border-radius: 0.7rem; border: 0; background: #e8788a; color: #fff; font-weight: 700; cursor: pointer; }
  .save:disabled { opacity: 0.5; cursor: default; }

  @media (max-width: 1000px) {
    .editor { grid-template-columns: 1fr; }
    .preview { position: static; }
  }
</style>
