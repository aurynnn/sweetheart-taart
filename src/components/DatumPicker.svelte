<script lang="ts">
  // DatumPicker.svelte
  // Inline trigger + centered modal calendar. Renders an inline trigger row
  // (label + selected date or placeholder) and a modal popup with the
  // month grid when clicked. Selection is mirrored to a hidden input
  // (#date-input) so non-Svelte code can read it.

  interface DayInfo {
    available: boolean;
    remaining: number;
    reason?: string;
  }

  interface Props {
    open?: boolean;
    value?: string;
  }

  let { open = $bindable(false), value = $bindable('') }: Props = $props();

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

  let selected = $derived(value || '');
  let daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());
  let firstDayOfWeek = $derived((new Date(viewYear, viewMonth, 1).getDay() + 6) % 7); // Mon=0

  let calendarDays = $derived.by(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
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
      const start = toIso(new Date());
      const end = new Date();
      end.setDate(end.getDate() + 120);
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
    if (viewMonthStart <= currentMonthStart) return;
    if (viewMonth === 0) { viewMonth = 11; viewYear--; }
    else viewMonth--;
  }

  function nextMonth() {
    if (viewMonth === 11) { viewMonth = 0; viewYear++; }
    else viewMonth++;
  }

  function isPast(day: number | null) {
    if (!day) return false;
    const d = new Date(viewYear, viewMonth, day);
    d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d < t;
  }

  function isSelected(day: number | null) {
    if (!day) return false;
    return toIso(new Date(viewYear, viewMonth, day)) === selected;
  }

  function isToday(day: number | null) {
    if (!day) return false;
    return toIso(new Date(viewYear, viewMonth, day)) === todayStr;
  }

  function getDayStatus(day: number | null): 'past' | 'unavailable' | 'limited' | 'available' {
    if (!day) return 'available';
    if (isPast(day)) return 'past';
    const dateStr = toIso(new Date(viewYear, viewMonth, day));
    const slot = availability[dateStr];
    if (!slot) return 'available';
    if (!slot.available) return 'unavailable';
    if (slot.remaining <= 2) return 'limited';
    return 'available';
  }

  function selectDay(day: number | null) {
    if (!day || isPast(day)) return;
    const status = getDayStatus(day);
    if (status === 'unavailable' || status === 'past') return;
    const iso = toIso(new Date(viewYear, viewMonth, day));
    value = iso;
    // Mirror to hidden input + dispatch change event for non-Svelte listeners
    const hidden = document.getElementById('date-input') as HTMLInputElement | null;
    if (hidden) {
      hidden.value = iso;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    open = false;
  }

  function clearValue(e: MouseEvent) {
    e.stopPropagation();
    value = '';
    const hidden = document.getElementById('date-input') as HTMLInputElement | null;
    if (hidden) {
      hidden.value = '';
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function closeCalendar() {
    open = false;
  }

  function formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const dayNames = ['Zon','Maa','Din','Woe','Don','Vri','Zat'];
    const monthNames = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeCalendar();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeCalendar();
  }

  // When the modal opens, jump the view to the selected month (or today)
  $effect(() => {
    if (open) {
      if (selected) {
        const d = new Date(selected + 'T00:00:00');
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
      } else {
        viewYear = today.getFullYear();
        viewMonth = today.getMonth();
      }
      if (Object.keys(availability).length === 0) {
        fetchAvailability();
      }
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Inline trigger row: label + selected date (or placeholder) + clear button -->
<button
  type="button"
  class="datum-trigger w-full px-4 py-3 rounded-lg border border-[#F0E0E2] bg-white text-left flex items-center justify-between gap-3 hover:border-[#E8788A] transition-colors"
  onclick={() => (open = true)}
>
  <span class="flex items-center gap-2 min-w-0">
    <i class="fa-solid fa-calendar text-[#E8788A]"></i>
    <span class="text-sm font-semibold text-[#1e293b] shrink-0">Datum</span>
    <span class="text-sm text-[#1e293b] truncate" class:opacity-50={!value}>
      {value ? formatDate(value) : 'Kies een datum'}
    </span>
  </span>
  {#if value}
    <span
      role="button"
      tabindex="0"
      class="clear-btn shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:bg-[#FDEEF0] hover:text-[#E8788A] transition-colors"
      aria-label="Datum wissen"
      onclick={clearValue}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') clearValue(e as any); }}
    >
      <i class="fa-solid fa-xmark text-xs"></i>
    </span>
  {:else}
    <i class="fa-solid fa-chevron-right text-xs text-[#94A3B8]"></i>
  {/if}
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-label="Kies een ophaaldatum"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="datum-modal bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header: month navigation -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#F0E0E2] bg-[#FDEEF0]">
        <button
          type="button"
          class="p-2 rounded-full hover:bg-[#f0d8da] transition-colors disabled:opacity-30"
          onclick={prevMonth}
          disabled={(() => {
            const now = new Date();
            return viewYear === now.getFullYear() && viewMonth === now.getMonth();
          })()}
          aria-label="Vorige maand"
        >
          <i class="fa-solid fa-chevron-left text-[#1e293b]"></i>
        </button>
        <span class="font-heading font-semibold text-[#1e293b] text-base">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          class="p-2 rounded-full hover:bg-[#f0d8da] transition-colors"
          onclick={nextMonth}
          aria-label="Volgende maand"
        >
          <i class="fa-solid fa-chevron-right text-[#1e293b]"></i>
        </button>
      </div>

      <!-- Day-of-week labels -->
      <div class="grid grid-cols-7 px-3 pt-3 pb-1">
        {#each DAY_NAMES as dn}
          <div class="text-center text-xs font-medium text-[#94A3B8] py-1">{dn}</div>
        {/each}
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 px-3 pb-3 gap-0.5">
        {#each calendarDays as day}
          {#if day === null}
            <div></div>
          {:else}
            {@const status = getDayStatus(day)}
            <button
              type="button"
              class="aspect-square rounded-full flex items-center justify-center text-sm transition-all relative
                {status === 'past' ? 'text-[#94A3B8] opacity-30 cursor-not-allowed' : ''}
                {status === 'unavailable' ? 'text-[#94A3B8] opacity-50 cursor-not-allowed line-through' : ''}
                {status === 'available' && !isSelected(day) ? 'hover:bg-[#FDEEF0] cursor-pointer text-[#1e293b]' : ''}
                {status === 'limited' && !isSelected(day) ? 'hover:bg-[#FEF3C7] cursor-pointer text-[#1e293b]' : ''}
                {isToday(day) && status !== 'past' && !isSelected(day) ? 'ring-1 ring-[#E8788A]' : ''}
                {isSelected(day) ? 'bg-[#E8788A] text-white font-semibold hover:bg-[#D66B7A]' : ''}
              "
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
      <div class="flex items-center justify-center gap-4 px-4 pb-3 text-xs text-[#94A3B8]">
        <div class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-[#E8788A]"></span>
          <span>Beschikbaar</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
          <span>Bijna vol</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-full bg-[#FDF2F4] line-through"></span>
          <span>Bezet</span>
        </div>
      </div>

      <!-- Footer / close -->
      <div class="px-4 pb-3 pt-1 flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 text-sm text-[#94A3B8] hover:text-[#E8788A] transition-colors rounded-lg hover:bg-[#FDEEF0]"
          onclick={closeCalendar}
        >
          Annuleren
        </button>
      </div>

      {#if loadingAvailability}
        <div class="absolute top-2 right-2 text-xs text-[#94A3B8]">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
      {/if}
    </div>
  </div>
{/if}
