<script lang="ts">
  // TimeList.svelte — editable list of "HH:MM" chips with quick presets.
  let { times = $bindable([]), disabled = false }: { times?: string[]; disabled?: boolean } = $props();

  let draft = $state('');

  function add() {
    if (!/^\d{2}:\d{2}$/.test(draft) || times.includes(draft)) return;
    times = [...times, draft].sort();
    draft = '';
  }

  function remove(t: string) {
    times = times.filter((x) => x !== t);
  }

  function preset(list: string[]) {
    times = [...list];
  }

  const PRESETS: Array<{ label: string; times: string[] }> = [
    { label: 'Elke 2 uur', times: ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'] },
    { label: 'Namiddag', times: ['14:00', '15:00', '16:00', '17:00'] },
    { label: 'Avond', times: ['17:00', '18:00', '19:00'] },
  ];
</script>

<div class="tl" class:disabled>
  <div class="chips">
    {#each times as t (t)}
      <span class="chip">
        {t}
        {#if !disabled}<button type="button" aria-label="Verwijder {t}" onclick={() => remove(t)}>×</button>{/if}
      </span>
    {:else}
      <span class="none">Geen ophalen</span>
    {/each}
  </div>
  {#if !disabled}
    <div class="row">
      <input type="time" step="900" bind:value={draft} aria-label="Nieuw ophaalmoment" onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
      <button type="button" class="add" onclick={add} disabled={!draft}>+ Toevoegen</button>
      <span class="sep"></span>
      {#each PRESETS as p}
        <button type="button" class="preset" onclick={() => preset(p.times)}>{p.label}</button>
      {/each}
      <button type="button" class="preset danger" onclick={() => preset([])}>Geen</button>
    </div>
  {/if}
</div>

<style>
  .tl { display: grid; gap: 0.6rem; }
  .tl.disabled { opacity: 0.55; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; min-height: 2rem; align-items: center; }
  .chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.4rem 0.3rem 0.75rem; border-radius: 999px; background: #fdf2f4; color: #be3455; font-weight: 700; font-size: 0.85rem; font-variant-numeric: tabular-nums; animation: pop 250ms cubic-bezier(0.34, 1.56, 0.64, 1); }
  .disabled .chip { padding-right: 0.75rem; background: #f1f5f9; color: #64748b; }
  .chip button { width: 1.3rem; height: 1.3rem; border-radius: 50%; border: 0; background: rgba(190, 52, 85, 0.12); color: inherit; cursor: pointer; line-height: 1; }
  .chip button:hover { background: #e8788a; color: #fff; }
  @keyframes pop { from { transform: scale(0.6); opacity: 0; } }
  .none { font-size: 0.85rem; color: #b91c1c; font-weight: 600; }
  .row { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  input { padding: 0.4rem 0.6rem; border: 1px solid #e2e8f0; border-radius: 0.5rem; font: inherit; }
  .add { padding: 0.45rem 0.8rem; border-radius: 0.5rem; border: 0; background: #e8788a; color: #fff; font-weight: 600; cursor: pointer; }
  .add:disabled { opacity: 0.4; cursor: default; }
  .sep { width: 1px; height: 1.4rem; background: #e2e8f0; margin: 0 0.2rem; }
  .preset { padding: 0.4rem 0.7rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font-size: 0.8rem; font-weight: 600; color: #475569; cursor: pointer; }
  .preset:hover { border-color: #e8788a; color: #be3455; }
  .preset.danger:hover { border-color: #ef4444; color: #b91c1c; }
</style>
