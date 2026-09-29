<script lang="ts">
  // FeedbackForm.svelte — shown after a 1–4 star rating from the review e-mail.
  // The customer can adjust the stars; choosing 5 still sends them to Google.
  import { onMount } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';

  let { orderId, token, rating: initial, alreadySent = false, reviewUrl }: {
    orderId: string; token: string; rating: number; alreadySent?: boolean; reviewUrl: string;
  } = $props();

  const TOPICS = ['Smaak', 'Uiterlijk', 'Versheid', 'Communicatie', 'Ophalen', 'Prijs'];
  const LABELS = ['Niet goed', 'Matig', 'Oké', 'Lekker!', 'Geweldig!'];

  let rating = $state(initial);
  let hover = $state(0);
  let topics = $state<string[]>([]);
  let text = $state('');
  let sending = $state(false);
  let done = $state(alreadySent);
  let error = $state('');

  const shown = $derived(hover || rating);

  function toggle(t: string) {
    topics = topics.includes(t) ? topics.filter((x) => x !== t) : [...topics, t];
  }

  const post = (body: Record<string, unknown>) =>
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, token, ...body }),
    });

  let redirecting = $state(false);
  async function rate(n: number) {
    rating = n;
    await post({ action: 'rate', rating: n }).catch(() => {});
    if (n === 5) {
      redirecting = true;
      setTimeout(() => (location.href = reviewUrl), 1200);
    }
  }

  // Save the score from the e-mail as soon as a real person opens the page
  onMount(() => { rate(initial); });

  const pick = (n: number) => rate(n);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!text.trim() && topics.length === 0) { error = 'Vertel ons kort wat beter kon — dat helpt ons enorm.'; return; }
    sending = true;
    error = '';
    try {
      const res = await post({ rating, topics, feedback: text });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      done = true;
    } catch (err: any) {
      error = err?.message || 'Versturen mislukt. Probeer het opnieuw.';
    } finally {
      sending = false;
    }
  }
</script>

{#if redirecting}
  <div class="thanks" in:scale={{ start: 0.9, duration: 500, easing: backOut }}>
    <div class="thanks-icon" aria-hidden="true"><i class="fa-solid fa-star"></i></div>
    <h2>Wat fijn dat je genoten hebt!</h2>
    <p>Zou je dit ook op Google willen delen? Zo vinden andere feestvierders ons ook. We sturen je nu door…</p>
    <a href={reviewUrl} class="btn btn-primary"><i class="fa-brands fa-google" aria-hidden="true"></i> Review op Google</a>
  </div>
{:else if done}
  <div class="thanks" in:scale={{ start: 0.9, duration: 500, easing: backOut }}>
    <div class="thanks-icon" aria-hidden="true"><i class="fa-solid fa-heart"></i></div>
    <h2>Dankjewel voor je eerlijke feedback!</h2>
    <p>Nathalie leest elke reactie persoonlijk en gebruikt ze om het nog beter te doen. Heb je nog een vraag? Beantwoord gerust de e-mail die je kreeg.</p>
    <a href="/" class="btn btn-primary">Terug naar de website</a>
  </div>
{:else}
  <form onsubmit={submit} in:fade>
    <p class="intro">Jammer dat het niet helemaal perfect was. Wil je ons vertellen wat beter kon?</p>

    <div class="stars" role="radiogroup" aria-label="Jouw score" onmouseleave={() => (hover = 0)}>
      {#each [1, 2, 3, 4, 5] as n}
        <button
          type="button"
          role="radio"
          aria-checked={rating === n}
          aria-label="{n} ster{n === 1 ? '' : 'ren'}"
          class:on={n <= shown}
          onmouseenter={() => (hover = n)}
          onclick={() => pick(n)}
        ><i class="fa-solid fa-star" aria-hidden="true"></i></button>
      {/each}
    </div>
    {#key shown}<p class="label" in:fly={{ y: -6, duration: 200 }}>{LABELS[shown - 1]}</p>{/key}

    <fieldset class="topics">
      <legend>Waarover gaat het? <small>(optioneel)</small></legend>
      <div class="chips">
        {#each TOPICS as t}
          <button type="button" class="chip" class:is-on={topics.includes(t)} aria-pressed={topics.includes(t)} onclick={() => toggle(t)}>{t}</button>
        {/each}
      </div>
    </fieldset>

    <label class="field">
      <span>Wat kon beter?</span>
      <textarea rows="4" maxlength="2000" bind:value={text} placeholder="Vertel het ons gerust — we leren er graag van."></textarea>
    </label>

    {#if error}<p class="error" role="alert" transition:fade>{error}</p>{/if}

    <button type="submit" class="btn btn-primary submit" disabled={sending}>
      {#if sending}<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Versturen…{:else}<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Verstuur feedback{/if}
    </button>
  </form>
{/if}

<style>
  form { display: grid; gap: 1.25rem; }
  .intro { margin: 0; text-align: center; color: var(--color-text-muted); font-size: 1.05rem; }
  .stars { display: flex; justify-content: center; gap: 0.35rem; }
  .stars button { border: 0; background: none; padding: 0.25rem; cursor: pointer; font-size: 2.4rem; color: #EEE3E5; transition: transform 250ms var(--ease-spring), color 200ms; }
  .stars button.on { color: #F5B83D; }
  .stars button:hover { transform: scale(1.15) rotate(-6deg); }
  .label { margin: -0.5rem 0 0; text-align: center; font-weight: 800; color: var(--color-primary-dark); min-height: 1.5em; }
  .topics { border: 0; padding: 0; margin: 0; }
  .topics legend { font-weight: 700; margin-bottom: 0.6rem; }
  .topics small { font-weight: 400; color: var(--color-text-muted); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .chip { padding: 0.5rem 0.95rem; border-radius: 999px; border: 1.5px solid var(--color-border); background: #fff; font: inherit; font-weight: 600; font-size: 0.9rem; color: var(--color-text); cursor: pointer; transition: all 250ms var(--ease-spring); }
  .chip.is-on { background: var(--color-primary); border-color: var(--color-primary); color: #fff; transform: scale(1.04); }
  .field { display: grid; gap: 0.5rem; font-weight: 700; }
  textarea { font: inherit; font-weight: 400; padding: 0.9rem 1rem; border-radius: 1rem; border: 1.5px solid var(--color-border); resize: vertical; }
  textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 4px rgba(232, 120, 138, 0.15); }
  .error { margin: 0; color: #DC2626; font-weight: 600; font-size: 0.9rem; }
  .submit { justify-self: center; border-radius: 999px; padding: 0.9rem 1.8rem; }
  .thanks { text-align: center; display: grid; gap: 1rem; justify-items: center; }
  .thanks h2 { font-family: var(--font-heading); font-size: 2.2rem; margin: 0; color: var(--color-text) !important; text-shadow: none !important; }
  .thanks p { margin: 0; color: var(--color-text-muted); max-width: 30rem; }
  .thanks-icon { width: 4.5rem; height: 4.5rem; border-radius: 50%; display: grid; place-items: center; background: var(--color-secondary); color: var(--color-primary); font-size: 1.8rem; animation: beat 1.6s ease-in-out infinite; }
  @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.18); } 30% { transform: scale(1); } }
  @media (prefers-reduced-motion: reduce) { .thanks-icon { animation: none; } }
</style>
