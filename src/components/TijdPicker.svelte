<script lang="ts">
  // TijdPicker.svelte
  // Inline trigger + centered modal time picker. Renders an inline trigger
  // row (label + selected time or placeholder) and a modal popup with the
  // available pickup hours when clicked. Selection is mirrored to a hidden
  // input (#time-input) so non-Svelte code can read it.

  interface Props {
    open?: boolean;
    value?: string;
  }

  let { open = $bindable(false), value = $bindable('') }: Props = $props();

  // Pickup hours offered (must match what the backend can fulfil)
  const HOURS = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

  function selectHour(h: string) {
    value = h;
    const hidden = document.getElementById('time-input') as HTMLInputElement | null;
    if (hidden) {
      hidden.value = h;
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
    open = false;
  }

  function clearValue(e: MouseEvent) {
    e.stopPropagation();
    value = '';
    const hidden = document.getElementById('time-input') as HTMLInputElement | null;
    if (hidden) {
      hidden.value = '';
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function closeModal() {
    open = false;
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) closeModal();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeModal();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Inline trigger row -->
<button
  type="button"
  class="tijd-trigger w-full px-4 py-3 rounded-lg border border-[#F0E0E2] bg-white text-left flex items-center justify-between gap-3 hover:border-[#E8788A] transition-colors"
  onclick={() => (open = true)}
>
  <span class="flex items-center gap-2 min-w-0">
    <i class="fa-solid fa-clock text-[#E8788A]"></i>
    <span class="text-sm font-semibold text-[#1e293b] shrink-0">Tijd</span>
    <span class="text-sm text-[#1e293b] truncate" class:opacity-50={!value}>
      {value ? value : 'Kies een tijd'}
    </span>
  </span>
  {#if value}
    <span
      role="button"
      tabindex="0"
      class="clear-btn shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[#94A3B8] hover:bg-[#FDEEF0] hover:text-[#E8788A] transition-colors"
      aria-label="Tijd wissen"
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
    aria-label="Kies een ophaaltijd"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="tijd-modal bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-[#F0E0E2] bg-[#FDEEF0]">
        <span class="font-heading font-semibold text-[#1e293b] text-base">
          Kies een ophaalmoment
        </span>
      </div>

      <!-- Hours grid -->
      <div class="grid grid-cols-2 gap-2 p-4">
        {#each HOURS as h}
          <button
            type="button"
            class="tijd-btn py-4 rounded-xl text-base font-semibold border-2 transition-all
              {value === h
                ? 'bg-[#E8788A] text-white border-[#E8788A]'
                : 'bg-white text-[#1e293b] border-[#F0E0E2] hover:border-[#E8788A] hover:bg-[#FDEEF0] hover:text-[#E8788A]'}
            "
            onclick={() => selectHour(h)}
          >
            {h}
          </button>
        {/each}
      </div>

      <!-- Footer -->
      <div class="px-4 pb-3 pt-1">
        <button
          type="button"
          class="w-full py-2 text-sm text-[#94A3B8] hover:text-[#E8788A] transition-colors rounded-lg hover:bg-[#FDEEF0]"
          onclick={closeModal}
        >
          Annuleren
        </button>
      </div>
    </div>
  </div>
{/if}
