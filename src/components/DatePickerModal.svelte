<script lang="ts">
  // DatePickerModal.svelte
  // Custom calendar picker — no native browser dropdown
  // Fetches availability from /api/availability and shows available/limited/unavailable days

  interface DayInfo {
    available: boolean;
    remaining: number;
    reason?: string;
  }

  interface Props {
    value?: string; // ISO date string YYYY-MM-DD
    onSelect?: (date: string) => void;
  }

  let { value = $bindable(''), onSelect }: Props = $props();

  let isOpen = $state(false);
  let viewYear = $state(new Date().getFullYear());
  let viewMonth = $state(new Date().getMonth()); // 0-indexed
  let availability = $state<Record<string, DayInfo>>({});
  let loadingAvailability = $state(false);

  const MONTHS = [
    'Januari','Februari','Maart','April','Mei','Juni',
    'Juli','Augustus','September','Oktober','November','December'
  ];
  const DAY_NAMES = ['Ma','Di','Wo','Do','Vr','Za','Zo'];

  // Today
  const today = new Date();
  const todayStr = toIso(today);

  // Selected date (from prop)
  let selected = $derived(value || '');
  let selectedDate = $derived(selected ? new Date(selected + 'T00:00:00') : null);

  // Days in current view month
  let daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());
  // Day of week for the 1st (0=Sun → adjust for Mon-start)
  let firstDayOfWeek = $derived((new Date(viewYear, viewMonth, 1).getDay() + 6) % 7); // Mon=0

  // Build calendar grid (6 rows max)
  let calendarDays = $derived(() => {
    let cells = [];
    // Leading empty cells
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    // Days
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // Pad to multiple of 7
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  });

  function toIso(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function fetchAvailability() {
    loadingAvailability = true;
    try {
      const today = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 120); // fetch 4 months ahead
      const start = toIso(today);
      const endStr = toIso(end);

      const res = await fetch(`/api/availability?startDate=${start}&endDate=${endStr}`);
      const data = await res.json();

      if (data.availability) {
        const newAvail: Record<string, DayInfo> = {};
        data.availability.forEach((slot: DayInfo & { date: string }) => {
          newAvail[slot.date] = {
            available: slot.available,
            remaining: slot.remaining ?? 0,
            reason: slot.reason
          };
        });
        availability = newAvail;
      }
    } catch (err) {
      console.log('Could not fetch availability:', err);
    } finally {
      loadingAvailability = false;
    }
  }

  function prevMonth() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const viewMonthStart = new Date(viewYear, viewMonth, 1);
    if (viewMonthStart <= currentMonthStart) return; // don't go to past months
    if (viewMonth === 0) { viewMonth = 11; viewYear--; }
    else viewMonth--;
  }

  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; }
    else viewMonth++;
  }

  function isToday(day: number | null) {
    if (!day) return false;
    return toIso(new Date(viewYear, viewMonth, day)) === todayStr;
  }

  function isSelected(day: number | null) {
    if (!day) return false;
    return toIso(new Date(viewYear, viewMonth, day)) === selected;
  }

  function isPast(day: number | null) {
    if (!day) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  }

  function getDayStatus(day: number | null): 'past' | 'unavailable' | 'limited' | 'available' {
    if (!day) return 'available';
    if (isPast(day)) return 'past';
    const dateStr = toIso(new Date(viewYear, viewMonth, day));
    const slot = availability[dateStr];
    if (!slot) return 'available'; // no data = assume available
    if (!slot.available) return 'unavailable';
    if (slot.remaining <= 2) return 'limited';
    return 'available';
  }

  function getDayTitle(day: number | null): string {
    if (!day) return '';
    const dateStr = toIso(new Date(viewYear, viewMonth, day));
    const slot = availability[dateStr];
    if (!slot) return '';
    if (!slot.available && slot.reason) return slot.reason;
    if (slot.remaining <= 2) return `Nog ${slot.remaining} plaats${slot.remaining === 1 ? '' : 'en'}`;
    return '';
  }

  function selectDay(day: number | null) {
    if (!day || isPast(day)) return;
    const y = viewYear, m = String(viewMonth + 1).padStart(2, '0'), d = String(day).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    value = iso;
    onSelect?.(iso);

    // Fire native change event on hidden input so Astro script listeners pick it up
    const hidden = document.getElementById('date-input') as HTMLInputElement | null;
    if (hidden) {
      hidden.value = iso;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }

    isOpen = false;
  }

  function openCalendar() {
    if (selected) {
      const d = new Date(selected + 'T00:00:00');
      viewYear = d.getFullYear();
      viewMonth = d.getMonth();
    } else {
      viewYear = today.getFullYear();
      viewMonth = today.getMonth();
    }
    isOpen = true;
    if (Object.keys(availability).length === 0) {
      fetchAvailability();
    }
  }

  function closeCalendar() {
    isOpen = false;
  }

  function formatDisplay(iso: string) {
    if (!iso) return 'Kies een datum';
    const d = new Date(iso + 'T00:00:00');
    const dayNames = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
    const monthNames = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  // Fetch availability when calendar opens (if not already loaded)
  $effect(() => {
    if (isOpen && Object.keys(availability).length === 0) {
      fetchAvailability();
    }
  });
</script>

<!-- Trigger button (replaces native date input) -->
<button
  type="button"
  id="date-picker-btn"
  class="w-full px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all text-left flex items-center justify-between group"
  onclick={openCalendar}
>
  <span class:opacity-50={!selected}>{selected ? formatDisplay(selected) : 'Kies een datum'}</span>
  {#if loadingAvailability}
    <i class="fa-solid fa-spinner fa-spin text-[var(--color-text-muted)]"></i>
  {:else}
    <i class="fa-solid fa-calendar-day text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors"></i>
  {/if}
</button>

<!-- Hidden native input to keep form value -->
<input type="hidden" id="date-input" name="date" value={value} />

<!-- Calendar modal overlay -->
{#if isOpen}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" onclick={closeCalendar}>
    <!-- Click inside stops propagation -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="calendar-modal bg-[var(--color-surface)] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onclick={(e) => e.stopPropagation()}>
      <!-- Header: month navigation -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[#FDEEF0]">
        <button type="button" class="p-2 rounded-full hover:bg-[#f0d8da] transition-colors disabled:opacity-30" onclick={prevMonth} disabled={(() => {
          const now = new Date();
          return viewYear === now.getFullYear() && viewMonth === now.getMonth();
        })()}>
          <i class="fa-solid fa-chevron-left text-[var(--color-text-muted)]"></i>
        </button>
        <span class="font-heading font-semibold text-[var(--color-text)] text-base">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" class="p-2 rounded-full hover:bg-[#f0d8da] transition-colors" onclick={nextMonth}>
          <i class="fa-solid fa-chevron-right text-[var(--color-text-muted)]"></i>
        </button>
      </div>

      <!-- Day-of-week labels -->
      <div class="grid grid-cols-7 px-3 pt-3 pb-1">
        {#each DAY_NAMES as dn}
          <div class="text-center text-xs font-medium text-[var(--color-text-muted)] py-1">{dn}</div>
        {/each}
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 px-3 pb-3 gap-0.5">
        {#each calendarDays() as day, i}
          {#if day === null}
            <div></div>
          {:else}
            {@const status = getDayStatus(day)}
            {@const title = getDayTitle(day)}
            <button
              type="button"
              class="aspect-square rounded-full flex items-center justify-center text-sm transition-all relative
                {status === 'past' ? 'text-[var(--color-text-muted)] opacity-30 cursor-not-allowed' : ''}
                {status === 'unavailable' ? 'text-[var(--color-text-muted)] opacity-50 cursor-not-allowed line-through' : ''}
                {status === 'available' ? 'hover:bg-[#FDEEF0] cursor-pointer' : ''}
                {status === 'limited' ? 'hover:bg-[#FEF3C7] cursor-pointer' : ''}
                {isToday(day) && status !== 'past' ? 'border-2 border-[var(--color-primary)]' : ''}
                {isSelected(day) ? 'bg-[var(--color-primary)] text-white font-semibold hover:bg-[#D66B7A]' : ''}
                {status !== 'past' && !isSelected(day) ? 'text-[var(--color-text)]' : ''}
              "
              title={title}
              disabled={status === 'past' || status === 'unavailable'}
              onclick={() => selectDay(day)}
            >
              {day}
              {#if status === 'limited' && !isSelected(day)}
                <span class="absolute top-0 right-0 w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
              {/if}
            </button>
          {/if}
        {/each}
      </div>

      <!-- Legend -->
      <div class="flex items-center justify-center gap-4 px-4 pb-3 text-xs text-[var(--color-text-muted)]">
        <div class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-[var(--color-primary)]"></span>
          <span>Beschikbaar</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-yellow-400"></span>
          <span>Bijna vol</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-gray-300 line-through"></span>
          <span>Bezet</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 pb-3 pt-1">
        <button
          type="button"
          class="w-full py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors rounded-lg hover:bg-[#FDEEF0]"
          onclick={closeCalendar}
        >
          Annuleren
        </button>
      </div>
    </div>
  </div>
{/if}
