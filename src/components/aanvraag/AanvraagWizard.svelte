<script lang="ts">
  // AanvraagWizard.svelte — the full aanvraag flow in four steps:
  //   1. Producten   2. Ophalen (datum + tijd)   3. Gegevens   4. Overzicht → verzenden
  // Progress is saved as a draft in localStorage, so a refresh never loses work.
  import { onMount, tick } from 'svelte';
  import { fly, fade, scale, slide } from 'svelte/transition';
  import { cubicOut, backOut } from 'svelte/easing';
  import {
    type AanvraagItem, type ProductId,
    PRODUCTS, EVENTS, PERSONS, FLAVORS, TOPPERS, MINI_TYPES, KOEKJES_QTY, MINI_MAX, MAX_ITEMS, PICKUP_TIMES,
    EMAIL_RE, isValidPhone, itemPrice, itemSummary, validateItem, formatEuro, optionLabel, productName,
  } from '../../lib/catalog';
  import AanvraagCalendar from './AanvraagCalendar.svelte';
  import Confetti from './Confetti.svelte';

  const DRAFT_KEY = 'sweetheart-aanvraag-draft-v1';
  const STEPS = [
    { id: 'producten', label: 'Producten', icon: 'fa-cake-candles' },
    { id: 'ophalen', label: 'Ophalen', icon: 'fa-calendar-day' },
    { id: 'gegevens', label: 'Gegevens', icon: 'fa-user' },
    { id: 'overzicht', label: 'Overzicht', icon: 'fa-list-check' },
  ] as const;

  // ── State ─────────────────────────────────────────────────────────────
  let step = $state(0);
  let direction = $state(1);
  let items = $state<AanvraagItem[]>([]);
  let editor = $state<AanvraagItem | null>(null);
  let editingIndex = $state<number | null>(null);
  let editorErrors = $state<string[]>([]);
  let date = $state('');
  let time = $state('');
  let contact = $state({ firstname: '', lastname: '', email: '', phone: '' });
  let touched = $state<Record<string, boolean>>({});
  let message = $state('');
  let agreed = $state(false);
  let submitting = $state(false);
  let submitError = $state('');
  let result = $state<{ orderId: string; total: string } | null>(null);
  let restored = $state(false);
  let stepAttempted = $state(false);
  let draftLoaded = $state(false);
  let root: HTMLElement;

  let total = $derived(items.reduce((s, i) => s + itemPrice(i), 0));
  let contactErrors = $derived({
    firstname: contact.firstname.trim() ? '' : 'Vul je voornaam in',
    lastname: contact.lastname.trim() ? '' : 'Vul je achternaam in',
    email: EMAIL_RE.test(contact.email.trim()) ? '' : 'Vul een geldig e-mailadres in',
    phone: isValidPhone(contact.phone) ? '' : 'Vul een geldig telefoonnummer in',
  });
  let contactValid = $derived(Object.values(contactErrors).every((e) => !e));
  let stepValid = $derived([
    items.length > 0 && !editor,
    !!date && !!time,
    contactValid,
    agreed,
  ]);

  // ── Draft persistence ─────────────────────────────────────────────────
  onMount(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.items)) items = d.items.filter((i: AanvraagItem) => validateItem(i).length === 0);
        if (d.contact) contact = { ...contact, ...d.contact };
        if (typeof d.message === 'string') message = d.message;
        if (typeof d.time === 'string') time = d.time;
        // A stored date may have passed or filled up — the calendar re-validates it
        if (typeof d.date === 'string') date = d.date;
        restored = items.length > 0 || !!contact.firstname;
      }
    } catch { /* storage unavailable — start fresh */ }

    // Deep link from a collection page: /aanvraag?product=koekjes
    const wanted = new URLSearchParams(location.search).get('product') as ProductId | null;
    if (wanted && PRODUCTS.some((p) => p.id === wanted) && items.length === 0) openEditor(wanted);
    draftLoaded = true;
  });

  $effect(() => {
    const snapshot = JSON.stringify({ items, contact, message, date, time });
    if (!draftLoaded || result) return;
    try { localStorage.setItem(DRAFT_KEY, snapshot); } catch { /* ignore */ }
  });

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  function startOver() {
    items = []; date = ''; time = ''; message = ''; agreed = false;
    contact = { firstname: '', lastname: '', email: '', phone: '' };
    touched = {}; restored = false; step = 0; editor = null;
    clearDraft();
  }

  // ── Navigation ────────────────────────────────────────────────────────
  async function goTo(target: number) {
    if (target > step) {
      // Can't skip ahead past an incomplete step
      for (let s = step; s < target; s++) {
        if (!stepValid[s]) {
          stepAttempted = true;
          if (s === 2) touched = { firstname: true, lastname: true, email: true, phone: true };
          if (s !== step) { direction = 1; step = s; }
          await tick();
          focusFirstError();
          return;
        }
      }
    }
    direction = target > step ? 1 : -1;
    step = target;
    stepAttempted = false;
    await tick();
    scrollToTop();
  }

  function scrollToTop() {
    const top = root.getBoundingClientRect().top + window.scrollY - 90;
    const lenis = (window as any).__lenis;
    if (Math.abs(window.scrollY - top) < 40) return;
    lenis ? lenis.scrollTo(top, { duration: 0.9 }) : window.scrollTo({ top, behavior: 'smooth' });
  }

  function focusFirstError() {
    const el = root.querySelector<HTMLElement>('[aria-invalid="true"], .needs-attention');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el && 'focus' in el) el.focus({ preventScroll: true });
  }

  // ── Product editor ────────────────────────────────────────────────────
  function blankItem(product: ProductId): AanvraagItem {
    if (product === 'feesttaart') return { product, event: '', persons: '', flavor: '', topper: '', allergies: '', message: '' };
    if (product === 'koekjes') return { product, quantity: KOEKJES_QTY.min, flavor: '', allergies: '', message: '' };
    return { product, miniType: 'cupcakes', quantity: MINI_TYPES[0].min, flavor: '', allergies: '', message: '' };
  }

  async function openEditor(product: ProductId, index: number | null = null) {
    editorErrors = [];
    editingIndex = index;
    editor = index === null ? blankItem(product) : { ...items[index] };
    await tick();
    root.querySelector('#item-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    editor = null;
    editingIndex = null;
    editorErrors = [];
  }

  function saveEditor() {
    if (!editor) return;
    const errors = validateItem(editor);
    if (errors.length) {
      editorErrors = errors;
      tick().then(focusFirstError);
      return;
    }
    const clean: AanvraagItem = { ...editor };
    if (editingIndex === null) items = [...items, clean];
    else items = items.map((it, i) => (i === editingIndex ? clean : it));
    closeEditor();
  }

  function removeItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  function duplicateItem(index: number) {
    if (items.length >= MAX_ITEMS) return;
    items = [...items.slice(0, index + 1), { ...items[index] }, ...items.slice(index + 1)];
  }

  function stepQty(delta: number) {
    if (!editor) return;
    const conf = editor.product === 'koekjes'
      ? { min: KOEKJES_QTY.min, step: KOEKJES_QTY.step, max: KOEKJES_QTY.max }
      : { ...MINI_TYPES.find((t) => t.value === editor!.miniType)!, max: MINI_MAX };
    const next = (editor.quantity ?? conf.min) + delta * conf.step;
    editor.quantity = Math.max(conf.min, Math.min(conf.max, next));
  }

  function setMiniType(value: string) {
    if (!editor) return;
    editor.miniType = value;
    editor.quantity = MINI_TYPES.find((t) => t.value === value)!.min;
  }

  let editorHasError = (field: string) =>
    editorErrors.length > 0 && !!editor && validateItem(editor).some((e) => e.toLowerCase().includes(field));

  // ── Submit ────────────────────────────────────────────────────────────
  async function submit() {
    if (!stepValid.every(Boolean)) {
      const firstBad = stepValid.findIndex((v) => !v);
      goTo(firstBad);
      return;
    }
    submitting = true;
    submitError = '';
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, time, message: message.trim(),
          customer: {
            firstname: contact.firstname.trim(), lastname: contact.lastname.trim(),
            email: contact.email.trim(), phone: contact.phone.trim(),
          },
          items,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (data.code === 'date_unavailable') {
          date = '';
          submitError = data.error || 'Deze datum is intussen volzet. Kies een andere datum.';
          direction = -1;
          step = 1;
          return;
        }
        submitError = data.error || 'Er ging iets mis. Probeer het opnieuw.';
        return;
      }
      result = { orderId: data.orderId, total: data.total };
      clearDraft();
      await tick();
      scrollToTop();
    } catch {
      submitError = 'Geen verbinding. Controleer je internet en probeer opnieuw.';
    } finally {
      submitting = false;
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function productImage(id: string) {
    return PRODUCTS.find((p) => p.id === id)?.image ?? '';
  }
</script>

<div class="wizard" bind:this={root}>
  {#if result}
    <!-- ─── SUCCESS ─────────────────────────────────────────────────── -->
    <Confetti />
    <div class="success" in:scale={{ duration: 700, start: 0.85, easing: backOut }}>
      <div class="success-badge" aria-hidden="true">
        <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
      </div>
      <h2 class="success-title">Joepie, je aanvraag is verstuurd!</h2>
      <p class="success-lead">
        Bedankt {contact.firstname}! Je aanvraag <strong>#{result.orderId}</strong> is goed ontvangen.
      </p>

      <ol class="next-steps">
        <li><span>1</span><div><strong>Nathalie bekijkt je aanvraag</strong><p>Meestal binnen 1 à 2 werkdagen.</p></div></li>
        <li><span>2</span><div><strong>Je krijgt een bevestiging</strong><p>Per mail of telefoon, met de definitieve prijs.</p></div></li>
        <li><span>3</span><div><strong>Ophalen & smullen</strong><p>{formatDate(date)} om {time}, Zwanenlaan 62, Oostende.</p></div></li>
      </ol>

      <p class="success-hint">
        <i class="fa-solid fa-image" aria-hidden="true"></i>
        Heb je een inspiratiefoto? Mail die gerust naar
        <a href="mailto:nathalie@sweetheart-taart.com?subject=Aanvraag%20{result.orderId}">nathalie@sweetheart-taart.com</a>
        met je aanvraagnummer.
      </p>

      <div class="success-actions">
        <a class="btn btn-primary" href="/">Terug naar home</a>
        <button type="button" class="btn btn-secondary" onclick={() => { result = null; startOver(); }}>Nieuwe aanvraag</button>
      </div>
    </div>
  {:else}
    <!-- ─── PROGRESS ────────────────────────────────────────────────── -->
    <nav class="stepper" aria-label="Stappen van je aanvraag">
      <div class="stepper-track" aria-hidden="true">
        <div class="stepper-fill" style="transform: scaleX({step / (STEPS.length - 1)})"></div>
      </div>
      <ol>
        {#each STEPS as s, i}
          <li>
            <button
              type="button"
              class="step-dot"
              class:is-active={i === step}
              class:is-done={i < step}
              aria-current={i === step ? 'step' : undefined}
              onclick={() => goTo(i)}
            >
              <span class="dot">
                {#if i < step}<i class="fa-solid fa-check" aria-hidden="true"></i>{:else}<i class="fa-solid {s.icon}" aria-hidden="true"></i>{/if}
              </span>
              <span class="step-label">{s.label}</span>
            </button>
          </li>
        {/each}
      </ol>
    </nav>

    {#if restored && step === 0}
      <div class="restored" transition:slide>
        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        <span>We hebben je vorige aanvraag bewaard.</span>
        <button type="button" onclick={startOver}>Opnieuw beginnen</button>
        <button type="button" class="restored-close" aria-label="Melding sluiten" onclick={() => (restored = false)}>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
    {/if}

    <div class="panel-wrap">
      {#key step}
        <section
          class="panel"
          aria-labelledby="step-title-{step}"
          in:fly={{ x: 60 * direction, duration: 520, delay: 120, easing: cubicOut }}
          out:fly={{ x: -60 * direction, duration: 220, easing: cubicOut }}
        >
          <!-- ─── STEP 1: PRODUCTEN ─────────────────────────────────── -->
          {#if step === 0}
            <header class="panel-head">
              <p class="eyebrow">Stap 1 van 4</p>
              <h2 id="step-title-0">Wat mag het zijn?</h2>
              <p class="muted">Kies een product en stel het samen. Je kan tot {MAX_ITEMS} producten combineren.</p>
            </header>

            {#if items.length > 0}
              <ul class="cart" aria-label="Gekozen producten">
                {#each items as item, i (i + item.product + JSON.stringify(item))}
                  <li class="cart-item" in:fly={{ y: 16, duration: 400 }} out:slide={{ duration: 250 }}>
                    <img src={productImage(item.product)} alt="" width="56" height="56" />
                    <div class="cart-info">
                      <strong>{productName(item.product)}</strong>
                      <span>{itemSummary(item) || 'Standaard'}</span>
                      {#if item.allergies}<span class="cart-allergy"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> {item.allergies}</span>{/if}
                    </div>
                    <span class="cart-price">{formatEuro(itemPrice(item))}</span>
                    <div class="cart-actions">
                      <button type="button" aria-label="Bewerk {productName(item.product)}" onclick={() => openEditor(item.product, i)}><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
                      {#if items.length < MAX_ITEMS}
                        <button type="button" aria-label="Dupliceer {productName(item.product)}" onclick={() => duplicateItem(i)}><i class="fa-regular fa-copy" aria-hidden="true"></i></button>
                      {/if}
                      <button type="button" class="danger" aria-label="Verwijder {productName(item.product)}" onclick={() => removeItem(i)}><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}

            {#if editor}
              <!-- Product editor -->
              <div id="item-editor" class="editor" in:fly={{ y: 24, duration: 450, easing: cubicOut }}>
                <div class="editor-head">
                  <img src={productImage(editor.product)} alt="" width="64" height="64" />
                  <div>
                    <p class="eyebrow">{editingIndex === null ? 'Nieuw product' : 'Product bewerken'}</p>
                    <h3>{productName(editor.product)}</h3>
                  </div>
                  <button type="button" class="icon-btn" aria-label="Sluiten" onclick={closeEditor}><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
                </div>

                {#if editor.product === 'feesttaart'}
                  <fieldset class="field" class:needs-attention={editorHasError('gelegenheid')} tabindex="-1">
                    <legend>Gelegenheid <span class="req">*</span></legend>
                    <div class="chips">
                      {#each EVENTS as o}
                        <button type="button" class="chip" class:is-on={editor.event === o.value} aria-pressed={editor.event === o.value} onclick={() => (editor!.event = o.value)}>{o.label}</button>
                      {/each}
                    </div>
                    {#if editorHasError('gelegenheid')}<p class="error" transition:slide>Kies een gelegenheid</p>{/if}
                  </fieldset>

                  <fieldset class="field" class:needs-attention={editorHasError('personen')} tabindex="-1">
                    <legend>Aantal personen <span class="req">*</span></legend>
                    <div class="tiles tiles-4">
                      {#each PERSONS as o}
                        <button type="button" class="tile" class:is-on={editor.persons === o.value} aria-pressed={editor.persons === o.value} onclick={() => (editor!.persons = o.value)}>
                          <strong>{o.label}</strong><span>{o.hint}</span>
                        </button>
                      {/each}
                    </div>
                    {#if editorHasError('personen')}<p class="error" transition:slide>Kies het aantal personen</p>{/if}
                  </fieldset>

                  <fieldset class="field">
                    <legend>Taarttopper</legend>
                    <div class="chips">
                      {#each TOPPERS as o}
                        <button type="button" class="chip" class:is-on={editor.topper === o.value} aria-pressed={editor.topper === o.value} onclick={() => (editor!.topper = o.value)}>{o.label}</button>
                      {/each}
                    </div>
                  </fieldset>
                {/if}

                {#if editor.product === 'mini-gebak'}
                  <fieldset class="field">
                    <legend>Type</legend>
                    <div class="tiles tiles-2">
                      {#each MINI_TYPES as o}
                        <button type="button" class="tile" class:is-on={editor.miniType === o.value} aria-pressed={editor.miniType === o.value} onclick={() => setMiniType(o.value)}>
                          <strong>{o.label}</strong><span>vanaf {o.min} stuks</span>
                        </button>
                      {/each}
                    </div>
                  </fieldset>
                {/if}

                {#if editor.product !== 'feesttaart'}
                  <div class="field">
                    <span class="legend" id="qty-label">Aantal</span>
                    <div class="stepper-qty" role="group" aria-labelledby="qty-label">
                      <button type="button" aria-label="Minder" onclick={() => stepQty(-1)}><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
                      <output aria-live="polite">
                        {#key editor.quantity}<span in:fly={{ y: -10, duration: 250 }}>{editor.quantity}</span>{/key}
                        <small>{editor.product === 'koekjes' ? 'koekjes' : optionLabel(MINI_TYPES, editor.miniType).toLowerCase()}</small>
                      </output>
                      <button type="button" aria-label="Meer" onclick={() => stepQty(1)}><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
                    </div>
                  </div>
                {/if}

                <fieldset class="field">
                  <legend>Smaak</legend>
                  <div class="chips">
                    {#each FLAVORS as o}
                      <button type="button" class="chip" class:is-on={editor.flavor === o.value} aria-pressed={editor.flavor === o.value} onclick={() => (editor!.flavor = o.value)}>
                        {o.label}{#if o.hint}<small> · {o.hint}</small>{/if}
                      </button>
                    {/each}
                  </div>
                </fieldset>

                <div class="grid-2">
                  <label class="field">
                    <span class="legend">Allergieën <small>(optioneel)</small></span>
                    <textarea rows="2" maxlength="500" placeholder="bv. glutenvrij, lactosevrij, noten…" bind:value={editor.allergies}></textarea>
                  </label>
                  <label class="field">
                    <span class="legend">Wensen & thema <small>(optioneel)</small></span>
                    <textarea rows="2" maxlength="1000" placeholder="bv. naam op de taart, kleuren, thema…" bind:value={editor.message}></textarea>
                  </label>
                </div>

                <div class="editor-foot">
                  <span class="price-tag">Indicatie <strong>{formatEuro(itemPrice(editor))}</strong></span>
                  <button type="button" class="btn btn-ghost" onclick={closeEditor}>Annuleren</button>
                  <button type="button" class="btn btn-primary" onclick={saveEditor}>
                    <i class="fa-solid fa-check" aria-hidden="true"></i>
                    {editingIndex === null ? 'Toevoegen' : 'Opslaan'}
                  </button>
                </div>
              </div>
            {:else if items.length < MAX_ITEMS}
              <p class="choose-label">{items.length ? 'Nog iets toevoegen?' : 'Kies je product'}</p>
              <div class="product-grid" class:needs-attention={stepAttempted && items.length === 0} tabindex="-1">
                {#each PRODUCTS as p, i}
                  <button type="button" class="product" onclick={() => openEditor(p.id)} in:fly={{ y: 30, duration: 500, delay: 80 * i, easing: cubicOut }}>
                    <span class="product-img"><img src={p.image} alt="" loading="lazy" /></span>
                    <span class="product-body">
                      <strong>{p.name}</strong>
                      <span>{p.tagline}</span>
                      <em>{p.from}</em>
                    </span>
                    <span class="product-add" aria-hidden="true"><i class="fa-solid fa-plus"></i></span>
                  </button>
                {/each}
              </div>
              {#if stepAttempted && items.length === 0}<p class="error" transition:slide>Kies minstens één product om verder te gaan.</p>{/if}
            {:else}
              <p class="muted center">Maximum van {MAX_ITEMS} producten bereikt.</p>
            {/if}

          <!-- ─── STEP 2: OPHALEN ───────────────────────────────────── -->
          {:else if step === 1}
            <header class="panel-head">
              <p class="eyebrow">Stap 2 van 4</p>
              <h2 id="step-title-1">Wanneer kom je ophalen?</h2>
              <p class="muted">Kies een vrije dag en een ophaalmoment in ons bakatelier in Oostende.</p>
            </header>

            {#if submitError}
              <p class="alert" role="alert" transition:slide><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {submitError}</p>
            {/if}

            <div class="pickup-grid">
              <div class="field" class:needs-attention={stepAttempted && !date} tabindex="-1">
                <span class="legend">Datum <span class="req">*</span></span>
                <AanvraagCalendar bind:value={date} />
              </div>
              <fieldset class="field" class:needs-attention={stepAttempted && !time} tabindex="-1">
                <legend>Ophaalmoment <span class="req">*</span></legend>
                <div class="times">
                  {#each PICKUP_TIMES as t, i}
                    <button type="button" class="time" class:is-on={time === t} aria-pressed={time === t} onclick={() => (time = t)} in:fade={{ delay: 40 * i }}>
                      <i class="fa-regular fa-clock" aria-hidden="true"></i>{t}
                    </button>
                  {/each}
                </div>
                {#if date}
                  <p class="picked" transition:slide><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> {formatDate(date)}{time ? ` om ${time}` : ''}</p>
                {/if}
                {#if stepAttempted && (!date || !time)}
                  <p class="error" transition:slide>{!date ? 'Kies een datum' : 'Kies een ophaalmoment'}</p>
                {/if}
              </fieldset>
            </div>

          <!-- ─── STEP 3: GEGEVENS ──────────────────────────────────── -->
          {:else if step === 2}
            <header class="panel-head">
              <p class="eyebrow">Stap 3 van 4</p>
              <h2 id="step-title-2">Hoe bereiken we je?</h2>
              <p class="muted">We gebruiken je gegevens enkel om je aanvraag te bevestigen.</p>
            </header>

            <div class="grid-2">
              {#each [
                { key: 'firstname', label: 'Voornaam', type: 'text', auto: 'given-name', placeholder: 'Nathalie' },
                { key: 'lastname', label: 'Achternaam', type: 'text', auto: 'family-name', placeholder: 'Peeters' },
                { key: 'email', label: 'E-mailadres', type: 'email', auto: 'email', placeholder: 'jij@voorbeeld.be' },
                { key: 'phone', label: 'Telefoon', type: 'tel', auto: 'tel', placeholder: '0486 12 34 56' },
              ] as f}
                {@const k = f.key as keyof typeof contact}
                {@const invalid = touched[k] && !!contactErrors[k]}
                <label class="field float" class:is-valid={!contactErrors[k] && contact[k]}>
                  <input
                    type={f.type}
                    autocomplete={f.auto}
                    inputmode={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : undefined}
                    placeholder=" "
                    maxlength="120"
                    aria-invalid={invalid}
                    aria-describedby="err-{k}"
                    bind:value={contact[k]}
                    onblur={() => (touched[k] = true)}
                  />
                  <span class="float-label">{f.label} <span class="req">*</span></span>
                  <i class="fa-solid fa-circle-check valid-mark" aria-hidden="true"></i>
                  {#if invalid}<p class="error" id="err-{k}" transition:slide>{contactErrors[k]}</p>{/if}
                </label>
              {/each}
            </div>

            <label class="field">
              <span class="legend">Nog iets dat we moeten weten? <small>(optioneel)</small></span>
              <textarea rows="3" maxlength="1000" placeholder="bv. levering bespreken, budget, vragen…" bind:value={message}></textarea>
            </label>

          <!-- ─── STEP 4: OVERZICHT ─────────────────────────────────── -->
          {:else}
            <header class="panel-head">
              <p class="eyebrow">Stap 4 van 4</p>
              <h2 id="step-title-3">Klopt alles?</h2>
              <p class="muted">Controleer je aanvraag. Je betaalt nu nog niets.</p>
            </header>

            <div class="review">
              <div class="review-block">
                <div class="review-head"><h3><i class="fa-solid fa-cake-candles" aria-hidden="true"></i> Producten</h3><button type="button" onclick={() => goTo(0)}>Wijzig</button></div>
                <ul class="review-items">
                  {#each items as item}
                    <li>
                      <img src={productImage(item.product)} alt="" width="44" height="44" />
                      <div>
                        <strong>{productName(item.product)}</strong>
                        <span>{itemSummary(item)}</span>
                        {#if item.allergies}<span class="cart-allergy">Allergieën: {item.allergies}</span>{/if}
                        {#if item.message}<span class="review-note">“{item.message}”</span>{/if}
                      </div>
                      <b>{formatEuro(itemPrice(item))}</b>
                    </li>
                  {/each}
                </ul>
              </div>

              <div class="review-row">
                <div class="review-block">
                  <div class="review-head"><h3><i class="fa-solid fa-calendar-day" aria-hidden="true"></i> Ophalen</h3><button type="button" onclick={() => goTo(1)}>Wijzig</button></div>
                  <p class="review-text">{formatDate(date)}<br />om {time}<br /><small>Zwanenlaan 62, Oostende</small></p>
                </div>
                <div class="review-block">
                  <div class="review-head"><h3><i class="fa-solid fa-user" aria-hidden="true"></i> Gegevens</h3><button type="button" onclick={() => goTo(2)}>Wijzig</button></div>
                  <p class="review-text">{contact.firstname} {contact.lastname}<br />{contact.email}<br />{contact.phone}</p>
                </div>
              </div>

              {#if message}
                <div class="review-block"><h3 class="solo"><i class="fa-solid fa-comment" aria-hidden="true"></i> Opmerking</h3><p class="review-text">{message}</p></div>
              {/if}

              <div class="total">
                <span>Totaal <small>(indicatie, definitieve prijs na bevestiging)</small></span>
                <strong>{formatEuro(total)}</strong>
              </div>

              <label class="agree" class:needs-attention={stepAttempted && !agreed}>
                <input type="checkbox" bind:checked={agreed} />
                <span>Ik ga akkoord met de <a href="/algemene-voorwaarden" target="_blank" rel="noopener">algemene voorwaarden</a>.</span>
              </label>

              {#if submitError}
                <p class="alert" role="alert" transition:slide><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {submitError}</p>
              {/if}
            </div>
          {/if}
        </section>
      {/key}
    </div>

    <!-- ─── FOOTER NAV (sticky on mobile) ───────────────────────────── -->
    <div class="wizard-nav">
      {#if step > 0}
        <button type="button" class="btn btn-ghost" onclick={() => goTo(step - 1)}>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Terug
        </button>
      {:else}
        <span class="nav-summary">
          {#if items.length}<strong>{items.length}</strong> product{items.length === 1 ? '' : 'en'} · {formatEuro(total)}{/if}
        </span>
      {/if}

      {#if step < STEPS.length - 1}
        <button type="button" class="btn btn-primary btn-next" class:is-ready={stepValid[step]} onclick={() => goTo(step + 1)}>
          Verder <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      {:else}
        <button type="button" class="btn btn-primary btn-next btn-shine" class:is-ready={agreed} disabled={submitting} onclick={() => { stepAttempted = true; submit(); }}>
          {#if submitting}
            <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Versturen…
          {:else}
            <i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Verstuur aanvraag
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .wizard { --pink: #E8788A; --pink-dark: #D45A6A; --blush: #FDEEF0; --line: #F0E0E2; --ink: #4A3A3D; --muted: #7A6A6D; position: relative; color: var(--ink); }

  /* Stepper */
  .stepper { position: relative; margin: 0 auto 2rem; max-width: 34rem; }
  .stepper ol { display: grid; grid-template-columns: repeat(4, 1fr); list-style: none; margin: 0; padding: 0; position: relative; }
  .stepper-track { position: absolute; top: 1.25rem; left: 12.5%; right: 12.5%; height: 3px; background: var(--line); border-radius: 3px; overflow: hidden; }
  .stepper-fill { height: 100%; background: linear-gradient(90deg, #F2A0AA, var(--pink)); transform-origin: 0 50%; transition: transform 700ms var(--ease-out-expo); }
  .step-dot { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; width: 100%; background: none; border: 0; cursor: pointer; color: var(--muted); font: inherit; }
  .dot { width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center; background: white; border: 2px solid var(--line); font-size: 0.85rem; transition: all 400ms var(--ease-spring); position: relative; z-index: 1; }
  .step-dot.is-active .dot { border-color: var(--pink); color: var(--pink); transform: scale(1.15); box-shadow: 0 0 0 6px rgba(232,120,138,0.15); }
  .step-dot.is-done .dot { background: var(--pink); border-color: var(--pink); color: white; }
  .step-label { font-size: 0.75rem; font-weight: 600; }
  .step-dot.is-active .step-label { color: var(--ink); }

  .restored { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; padding: 0.7rem 1rem; margin-bottom: 1.25rem; border-radius: 0.9rem; background: #FFF7E8; color: #7A5A1D; font-size: 0.875rem; }
  .restored button { background: none; border: 0; color: var(--pink-dark); font-weight: 700; cursor: pointer; text-decoration: underline; }
  .restored .restored-close { margin-left: auto; text-decoration: none; color: #7A5A1D; }

  .panel-wrap { display: grid; }
  .panel { grid-area: 1 / 1; min-width: 0; }
  .panel-head { text-align: center; margin-bottom: 1.75rem; }
  .panel-head h2 { font-family: var(--font-heading); font-size: clamp(2rem, 4vw, 2.75rem); color: var(--ink) !important; text-shadow: none !important; margin: 0.15rem 0 0.4rem; }
  .eyebrow { font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: var(--pink); margin: 0; }
  .muted { color: var(--muted); margin: 0; }
  .center { text-align: center; }
  .choose-label { font-weight: 700; margin: 1.5rem 0 0.75rem; }

  /* Product choice */
  .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; border-radius: 1.25rem; outline: none; }
  .product { position: relative; display: flex; flex-direction: column; text-align: left; background: white; border: 2px solid var(--line); border-radius: 1.25rem; overflow: hidden; cursor: pointer; font: inherit; color: inherit; padding: 0; transition: transform 400ms var(--ease-spring), border-color 250ms, box-shadow 250ms; }
  .product:hover, .product:focus-visible { transform: translateY(-6px); border-color: var(--pink); box-shadow: 0 18px 40px -18px rgba(212,90,106,0.45); }
  .product-img { aspect-ratio: 4 / 3; overflow: hidden; background: var(--blush); }
  .product-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 700ms var(--ease-out-expo); }
  .product:hover .product-img img { transform: scale(1.08); }
  .product-body { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.9rem 1rem 1.1rem; }
  .product-body strong { font-size: 1.05rem; }
  .product-body span { font-size: 0.8rem; color: var(--muted); }
  .product-body em { font-style: normal; font-size: 0.8rem; font-weight: 700; color: var(--pink-dark); margin-top: 0.3rem; }
  .product-add { position: absolute; top: 0.7rem; right: 0.7rem; width: 2.2rem; height: 2.2rem; border-radius: 50%; background: white; color: var(--pink); display: grid; place-items: center; box-shadow: 0 4px 14px rgba(0,0,0,0.12); transition: transform 400ms var(--ease-spring), background 200ms, color 200ms; }
  .product:hover .product-add { transform: rotate(90deg) scale(1.1); background: var(--pink); color: white; }

  /* Cart */
  .cart { list-style: none; padding: 0; margin: 0 0 0.5rem; display: grid; gap: 0.6rem; }
  .cart-item { display: flex; align-items: center; gap: 0.85rem; padding: 0.7rem; border-radius: 1rem; background: white; border: 1px solid var(--line); }
  .cart-item img, .review-items img, .editor-head img { border-radius: 0.7rem; object-fit: cover; background: var(--blush); flex-shrink: 0; }
  .cart-item img { width: 56px; height: 56px; }
  .review-items img { width: 44px; height: 44px; }
  .editor-head img { width: 64px; height: 64px; border-radius: 0.9rem; }
  .cart-info { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .cart-info span { font-size: 0.8rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
  .cart-allergy { color: #B45309 !important; font-size: 0.78rem; }
  .cart-price { font-weight: 800; color: var(--pink-dark); }
  .cart-actions { display: flex; gap: 0.15rem; }
  .cart-actions button, .icon-btn { width: 2.2rem; height: 2.2rem; border-radius: 0.6rem; border: 0; background: none; color: var(--muted); cursor: pointer; transition: background 200ms, color 200ms; }
  .cart-actions button:hover, .icon-btn:hover { background: var(--blush); color: var(--pink); }
  .cart-actions button.danger:hover { background: #FEF2F2; color: #DC2626; }

  /* Editor */
  .editor { margin-top: 1rem; padding: 1.25rem; border-radius: 1.25rem; background: white; border: 2px solid var(--pink); box-shadow: 0 24px 60px -30px rgba(212,90,106,0.5); scroll-margin-top: 6rem; }
  .editor-head { display: flex; align-items: center; gap: 0.9rem; margin-bottom: 1rem; }
  .editor-head h3 { margin: 0; font-family: var(--font-heading); font-size: 1.8rem; color: var(--ink) !important; text-shadow: none !important; }
  .editor-head .icon-btn { margin-left: auto; }
  .editor-foot { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed var(--line); }
  .price-tag { margin-right: auto; color: var(--muted); font-size: 0.9rem; }
  .price-tag strong { color: var(--pink-dark); font-size: 1.1rem; margin-left: 0.25rem; }

  /* Fields */
  .field { display: block; border: 0; margin: 0 0 1.1rem; padding: 0; min-width: 0; border-radius: 1rem; outline: none; transition: box-shadow 300ms; }
  .field legend, .legend { display: block; font-weight: 700; font-size: 0.9rem; margin-bottom: 0.55rem; padding: 0; }
  .legend small, .field legend small { font-weight: 400; color: var(--muted); }
  .req { color: var(--pink); }
  .needs-attention { animation: shake 450ms ease; box-shadow: 0 0 0 3px rgba(239,68,68,0.18); }
  @keyframes shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
  .error { color: #DC2626; font-size: 0.8rem; margin: 0.4rem 0 0; font-weight: 600; }
  .alert { display: flex; gap: 0.5rem; align-items: center; padding: 0.8rem 1rem; border-radius: 0.9rem; background: #FEF2F2; color: #991B1B; font-size: 0.9rem; margin-bottom: 1rem; }
  textarea, input { width: 100%; font: inherit; color: var(--ink); background: white; border: 1.5px solid var(--line); border-radius: 0.9rem; padding: 0.8rem 1rem; transition: border-color 200ms, box-shadow 200ms; resize: vertical; }
  textarea:focus, input:focus { outline: none; border-color: var(--pink); box-shadow: 0 0 0 4px rgba(232,120,138,0.15); }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }

  .chips { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .chip { padding: 0.55rem 0.95rem; border-radius: 999px; border: 1.5px solid var(--line); background: white; font: inherit; font-size: 0.875rem; font-weight: 600; color: var(--ink); cursor: pointer; transition: all 250ms var(--ease-spring); }
  .chip small { font-weight: 400; color: var(--muted); }
  .chip:hover { border-color: var(--pink); transform: translateY(-1px); }
  .chip.is-on { background: var(--pink); border-color: var(--pink); color: white; transform: scale(1.04); box-shadow: 0 6px 16px -6px rgba(212,90,106,0.6); }
  .chip.is-on small { color: rgba(255,255,255,0.85); }

  .tiles { display: grid; gap: 0.5rem; }
  .tiles-4 { grid-template-columns: repeat(4, 1fr); }
  .tiles-2 { grid-template-columns: repeat(2, 1fr); }
  .tile { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.85rem 0.5rem; border-radius: 1rem; border: 1.5px solid var(--line); background: white; font: inherit; color: var(--ink); cursor: pointer; transition: all 250ms var(--ease-spring); }
  .tile strong { font-size: 1.1rem; }
  .tile span { font-size: 0.75rem; color: var(--muted); }
  .tile:hover { border-color: var(--pink); }
  .tile.is-on { border-color: var(--pink); background: var(--blush); box-shadow: inset 0 0 0 1px var(--pink); transform: translateY(-2px); }

  .stepper-qty { display: inline-flex; align-items: center; gap: 0.75rem; padding: 0.35rem; border-radius: 999px; background: var(--blush); }
  .stepper-qty button { width: 2.6rem; height: 2.6rem; border-radius: 50%; border: 0; background: white; color: var(--pink); cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.08); transition: transform 200ms var(--ease-spring), background 200ms, color 200ms; }
  .stepper-qty button:hover { background: var(--pink); color: white; }
  .stepper-qty button:active { transform: scale(0.9); }
  .stepper-qty output { min-width: 7rem; text-align: center; display: grid; line-height: 1.1; }
  .stepper-qty output span { font-size: 1.5rem; font-weight: 800; grid-area: 1 / 1; }
  .stepper-qty output small { color: var(--muted); font-size: 0.75rem; }

  /* Pickup */
  .pickup-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 1.5rem; align-items: start; }
  .times { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
  .time { display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.9rem; border-radius: 1rem; border: 1.5px solid var(--line); background: white; font: inherit; font-weight: 700; color: var(--ink); cursor: pointer; transition: all 250ms var(--ease-spring); }
  .time i { color: var(--pink); }
  .time:hover { border-color: var(--pink); }
  .time.is-on { background: var(--pink); border-color: var(--pink); color: white; transform: scale(1.03); }
  .time.is-on i { color: white; }
  .picked { margin: 1rem 0 0; padding: 0.8rem 1rem; border-radius: 0.9rem; background: #F0FDF4; color: #166534; font-weight: 600; font-size: 0.9rem; }

  /* Floating labels */
  .float { position: relative; }
  .float input { padding: 1.35rem 2.5rem 0.55rem 1rem; }
  .float-label { position: absolute; left: 1rem; top: 1rem; color: var(--muted); pointer-events: none; transition: all 200ms var(--ease-out-expo); font-size: 0.95rem; }
  .float input:focus + .float-label, .float input:not(:placeholder-shown) + .float-label { top: 0.45rem; font-size: 0.7rem; font-weight: 700; color: var(--pink-dark); letter-spacing: 0.02em; }
  .float input[aria-invalid="true"] { border-color: #EF4444; }
  .valid-mark { position: absolute; right: 1rem; top: 1.15rem; color: #22C55E; opacity: 0; transform: scale(0.5); transition: all 300ms var(--ease-spring); }
  .float.is-valid .valid-mark { opacity: 1; transform: scale(1); }

  /* Review */
  .review { display: grid; gap: 1rem; }
  .review-block { background: white; border: 1px solid var(--line); border-radius: 1.1rem; padding: 1rem 1.1rem; }
  .review-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .review-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
  .review h3 { font-family: var(--font-body); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted) !important; text-shadow: none !important; margin: 0; }
  .review h3 i { color: var(--pink); margin-right: 0.35rem; }
  .review h3.solo { margin-bottom: 0.5rem; }
  .review-head button { background: none; border: 0; color: var(--pink-dark); font-weight: 700; font-size: 0.85rem; cursor: pointer; }
  .review-head button:hover { text-decoration: underline; }
  .review-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.7rem; }
  .review-items li { display: flex; gap: 0.75rem; align-items: flex-start; }
  .review-items li div { display: flex; flex-direction: column; flex: 1; min-width: 0; font-size: 0.875rem; }
  .review-items li div span { color: var(--muted); }
  .review-note { font-style: italic; }
  .review-text { margin: 0; line-height: 1.6; overflow-wrap: anywhere; }
  .review-text small { color: var(--muted); }
  .total { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem; border-radius: 1.1rem; background: linear-gradient(135deg, var(--blush), #FFE4EA); }
  .total small { display: block; color: var(--muted); font-size: 0.75rem; }
  .total strong { font-size: 1.6rem; color: var(--pink-dark); }
  .agree { display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.9rem 1rem; border-radius: 1rem; cursor: pointer; background: white; border: 1px solid var(--line); }
  .agree input { width: 1.25rem; height: 1.25rem; accent-color: var(--pink); flex-shrink: 0; margin-top: 0.1rem; }

  /* Bottom navigation */
  .wizard-nav { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 2rem; padding-top: 1.25rem; border-top: 1px solid var(--line); }
  .nav-summary { color: var(--muted); font-size: 0.9rem; }
  .nav-summary strong { color: var(--pink-dark); }
  .btn-next { padding: 0.9rem 1.75rem; border-radius: 999px; font-size: 1.05rem; opacity: 0.75; }
  .btn-next.is-ready { opacity: 1; box-shadow: 0 12px 28px -10px rgba(212,90,106,0.7); }
  .btn-next i { transition: transform 300ms var(--ease-spring); }
  .btn-next:hover i.fa-arrow-right { transform: translateX(4px); }

  /* Success */
  .success { text-align: center; padding: 1rem 0; position: relative; z-index: 1; }
  .success-badge svg { width: 5.5rem; height: 5.5rem; margin: 0 auto 1rem; display: block; }
  .success-badge circle { fill: var(--blush); stroke: var(--pink); stroke-width: 2.5; stroke-dasharray: 160; stroke-dashoffset: 160; animation: draw 900ms var(--ease-out-expo) forwards; }
  .success-badge path { fill: none; stroke: var(--pink-dark); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: draw 600ms 500ms var(--ease-out-expo) forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .success-title { font-family: var(--font-heading); font-size: clamp(2.2rem, 5vw, 3.2rem); color: var(--ink) !important; text-shadow: none !important; margin: 0 0 0.5rem; }
  .success-lead { color: var(--muted); font-size: 1.1rem; }
  .next-steps { list-style: none; padding: 0; margin: 2rem auto; max-width: 28rem; display: grid; gap: 1rem; text-align: left; }
  .next-steps li { display: flex; gap: 0.9rem; align-items: flex-start; }
  .next-steps li > span { width: 2rem; height: 2rem; border-radius: 50%; background: var(--pink); color: white; display: grid; place-items: center; font-weight: 800; flex-shrink: 0; }
  .next-steps p { margin: 0.1rem 0 0; color: var(--muted); font-size: 0.9rem; }
  .success-hint { font-size: 0.875rem; color: var(--muted); max-width: 30rem; margin: 0 auto 1.75rem; }
  .success-hint a { font-weight: 700; }
  .success-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }

  @media (max-width: 720px) {
    .product-grid { grid-template-columns: 1fr; }
    .product { flex-direction: row; align-items: stretch; }
    .product-img { aspect-ratio: auto; width: 7.5rem; flex-shrink: 0; }
    .product-add { top: auto; bottom: 0.7rem; }
    .grid-2, .pickup-grid, .review-row { grid-template-columns: 1fr; }
    .tiles-4 { grid-template-columns: repeat(2, 1fr); }
    .cart-item { flex-wrap: wrap; }
    .cart-info { flex-basis: calc(100% - 70px); }
    .cart-price { margin-left: 68px; }
    .cart-actions { margin-left: auto; }
    .step-label { font-size: 0.68rem; }
    .wizard-nav {
      position: sticky; bottom: 0; z-index: 20;
      margin: 2rem -1.25rem -1.25rem; padding: 0.85rem 1.25rem calc(0.85rem + env(safe-area-inset-bottom, 0px));
      background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); border-radius: 0 0 1.5rem 1.5rem;
    }
    .editor-foot .btn-ghost { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .needs-attention { animation: none; }
    .success-badge circle, .success-badge path { animation: none; stroke-dashoffset: 0; }
  }
</style>
