<!-- CSS injected by the component itself: Astro 7 (Rolldown) drops the CSS of components that are not in the server-rendered HTML -->
<svelte:options css="injected" />
<script lang="ts">
  // AanvraagCalendar.svelte — inline month calendar that shows live availability
  // from /api/availability. Unavailable days explain *why* on hover/focus.
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  import { PICKUP_TIMES } from '../../lib/catalog';

  interface DayInfo { available: boolean; remaining: number; reason?: string; times: string[] }
  let { value = $bindable(''), times = $bindable<string[]>([]) }: { value?: string; times?: string[] } = $props();

  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const DAYS = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
  const RANGE_DAYS = 180;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(today);
  lastDay.setDate(lastDay.getDate() + RANGE_DAYS);

  let viewYear = $state(today.getFullYear());
  let viewMonth = $state(today.getMonth());
  let slideDir = $state(1);
  let availability = $state<Record<string, DayInfo>>({});
  let loading = $state(true);
  let failed = $state(false);
  let hint = $state('');

  function iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onMount(async () => {
    try {
      const res = await fetch(`/api/availability?startDate=${iso(today)}&endDate=${iso(lastDay)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const map: Record<string, DayInfo> = {};
      for (const d of data.availability ?? []) map[d.date] = { available: d.available, remaining: d.remaining, reason: d.reason, times: d.times ?? PICKUP_TIMES };
      availability = map;
      // Drop a restored draft date that is no longer free
      if (value && !map[value]?.available) value = '';
      // Open on the month of the selected date, or the first month with a free day
      const first = value || Object.keys(map).find((k) => map[k].available);
      if (first) {
        const d = new Date(first + 'T00:00:00');
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
      }
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  });

  // Ophaalmomenten for the chosen day (falls back to the defaults if availability failed to load)
  $effect(() => {
    times = value ? (availability[value]?.times ?? (failed ? PICKUP_TIMES : [])) : [];
  });

  let cells = $derived.by(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: Array<{ day: number; iso: string; status: 'past' | 'closed' | 'limited' | 'open' | 'out'; reason?: string } | null> = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let day = 1; day <= days; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const key = iso(d);
      const info = availability[key];
      let status: 'past' | 'closed' | 'limited' | 'open' | 'out' = 'open';
      if (d < today) status = 'past';
      else if (d > lastDay) status = 'out';
      else if (failed) status = 'open'; // server re-checks on submit
      else if (!info || !info.available) status = 'closed';
      else if (info.remaining <= 1) status = 'limited';
      out.push({ day, iso: key, status, reason: info?.reason });
    }
    return out;
  });

  let canPrev = $derived(viewYear > today.getFullYear() || viewMonth > today.getMonth());
  let canNext = $derived(new Date(viewYear, viewMonth + 1, 1) <= lastDay);

  function shift(delta: number) {
    slideDir = delta;
    const d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
  }

  function pick(cell: NonNullable<(typeof cells)[number]>) {
    if (cell.status === 'open' || cell.status === 'limited') {
      value = cell.iso;
      hint = '';
    } else {
      hint = cell.reason || (cell.status === 'past' ? 'Deze datum is voorbij' : 'Niet beschikbaar');
    }
  }
</script>

<div class="cal" aria-busy={loading}>
  <div class="cal-head">
    <button type="button" onclick={() => shift(-1)} disabled={!canPrev} aria-label="Vorige maand"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
    {#key `${viewYear}-${viewMonth}`}
      <span class="cal-title" in:fly={{ x: 20 * slideDir, duration: 300 }}>{MONTHS[viewMonth]} {viewYear}</span>
    {/key}
    <button type="button" onclick={() => shift(1)} disabled={!canNext} aria-label="Volgende maand"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
  </div>

  <div class="cal-grid cal-days" aria-hidden="true">
    {#each DAYS as d}<span>{d}</span>{/each}
  </div>

  <div class="cal-body">
    {#key `${viewYear}-${viewMonth}`}
      <div class="cal-grid" role="grid" aria-label="{MONTHS[viewMonth]} {viewYear}" in:fly={{ x: 40 * slideDir, duration: 380, easing: cubicOut }}>
        {#each cells as cell}
          {#if cell}
            <button
              type="button"
              class="day {cell.status}"
              class:is-selected={value === cell.iso}
              class:is-today={cell.iso === iso(today)}
              aria-pressed={value === cell.iso}
              aria-disabled={cell.status !== 'open' && cell.status !== 'limited'}
              title={cell.status === 'closed' ? cell.reason : cell.status === 'limited' ? 'Nog 1 plaats vrij' : undefined}
              aria-label="{cell.day} {MONTHS[viewMonth]}{cell.status === 'closed' ? `, niet beschikbaar${cell.reason ? ': ' + cell.reason : ''}` : cell.status === 'limited' ? ', bijna volzet' : ''}"
              onclick={() => pick(cell)}
            >
              {cell.day}
              {#if cell.status === 'limited' && value !== cell.iso}<span class="pip" aria-hidden="true"></span>{/if}
            </button>
          {:else}
            <span></span>
          {/if}
        {/each}
      </div>
    {/key}
    {#if loading}
      <div class="cal-loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Beschikbaarheid laden…</div>
    {/if}
  </div>

  <p class="cal-hint" aria-live="polite">
    {#if hint}<i class="fa-solid fa-circle-info" aria-hidden="true"></i> {hint}
    {:else if failed}Beschikbaarheid kon niet geladen worden — we controleren je datum bij het versturen.
    {:else}
      <span class="legend-item"><span class="sw open"></span>vrij</span>
      <span class="legend-item"><span class="sw limited"></span>bijna volzet</span>
      <span class="legend-item"><span class="sw closed"></span>niet beschikbaar</span>
    {/if}
  </p>
</div>

<style>
  .cal { background: white; border: 1.5px solid #F0E0E2; border-radius: 1.25rem; padding: 1rem; }
  .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
  .cal-head button { width: 2.25rem; height: 2.25rem; border-radius: 50%; border: 0; background: #FDEEF0; color: #D45A6A; cursor: pointer; transition: background 200ms, transform 200ms; }
  .cal-head button:hover:not(:disabled) { background: #E8788A; color: white; }
  .cal-head button:disabled { opacity: 0.3; cursor: not-allowed; }
  .cal-title { font-weight: 800; text-transform: capitalize; font-size: 1.05rem; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
  .cal-days span { text-align: center; font-size: 0.7rem; font-weight: 700; color: #A89A9D; text-transform: uppercase; padding: 0.3rem 0; }
  .cal-body { display: grid; position: relative; min-height: 15.5rem; }
  .cal-body > .cal-grid { grid-area: 1 / 1; align-content: start; }
  .day { position: relative; aspect-ratio: 1; border-radius: 0.75rem; border: 0; background: none; font: inherit; font-weight: 700; font-size: 0.9rem; color: #4A3A3D; cursor: pointer; transition: all 220ms var(--ease-spring); }
  .day.open, .day.limited { background: #FFF5F7; }
  .day.open:hover, .day.limited:hover { background: #FDDDE3; transform: scale(1.08); }
  .day.closed { color: #C9BDBF; text-decoration: line-through; cursor: help; }
  .day.past, .day.out { color: #DDD2D4; cursor: default; }
  .day.is-today { box-shadow: inset 0 0 0 1.5px #E8788A; }
  .day.is-selected { background: #E8788A !important; color: white; transform: scale(1.1); box-shadow: 0 8px 18px -6px rgba(212,90,106,0.7); }
  .pip { position: absolute; top: 0.3rem; right: 0.3rem; width: 0.4rem; height: 0.4rem; border-radius: 50%; background: #F59E0B; }
  .cal-loading { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255,255,255,0.8); color: #7A6A6D; font-size: 0.875rem; border-radius: 0.75rem; }
  .cal-hint { display: flex; gap: 0.9rem; flex-wrap: wrap; font-size: 0.75rem; color: #7A6A6D; margin: 0.75rem 0 0; min-height: 1.2rem; }
  .legend-item { display: inline-flex; align-items: center; gap: 0.35rem; }
  .sw { width: 0.75rem; height: 0.75rem; border-radius: 0.25rem; }
  .sw.open { background: #FDDDE3; }
  .sw.limited { background: #F59E0B; border-radius: 50%; width: 0.5rem; height: 0.5rem; }
  .sw.closed { background: #EEE6E7; }
</style>
