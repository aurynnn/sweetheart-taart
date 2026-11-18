// src/lib/catalog.ts — Products, options and indicative pricing for an aanvraag.
// Shared by the AanvraagWizard (client) and POST /api/orders (server), so the
// total shown to the customer is the total that is stored.

export type ProductId = 'feesttaart' | 'koekjes' | 'mini-gebak';

export interface Option { value: string; label: string; hint?: string }

export interface AanvraagItem {
  product: ProductId;
  event?: string;
  persons?: string;
  flavor?: string;
  topper?: string;
  miniType?: string;
  quantity?: number;
  allergies?: string;
  message?: string;
  /** R2 key of an uploaded example photo (see /api/uploads) */
  image?: string;
  /** Small data-URL thumbnail, only kept client-side for the draft */
  imagePreview?: string;
}

export const PRODUCTS: Array<{ id: ProductId; name: string; tagline: string; image: string; icon: string; from: string }> = [
  { id: 'feesttaart', name: 'Feesttaart', tagline: 'Luchtige biscuit met verse room & mascarpone, vanaf 8 personen', image: '/images/cards/trouwtaart-640.webp', icon: 'fa-cake-candles', from: 'vanaf €88' },
  { id: 'koekjes', name: 'Koekjes', tagline: 'Prachtig versierd, vanaf 24 stuks', image: '/images/cards/koekjes-640.webp', icon: 'fa-cookie-bite', from: '€2 per koekje' },
  { id: 'mini-gebak', name: 'Mini-gebak', tagline: 'Cupcakes & mini cupcakes', image: '/images/cards/cupcakes-640.webp', icon: 'fa-cookie', from: 'vanaf €9' },
];

export const EVENTS: Option[] = [
  { value: 'verjaardag', label: 'Verjaardag' },
  { value: 'jubileum', label: 'Jubileum' },
  { value: 'huwelijk', label: 'Huwelijk' },
  { value: 'communie', label: 'Communie' },
  { value: 'doopsel', label: 'Doopsel' },
  { value: 'babyshower', label: 'Baby shower' },
  { value: 'anders', label: 'Anders' },
];

// ── Feesttaart pricing (client's "Menukaart & Tarieven", nov 2026) ──────────
// Every number from the price list lives here. Points still waiting for the
// client's answer are marked OPEN, with the assumption used for now.

/** Price per extra person on top of the smallest size of each layer count. */
const PER_PERSON = 6;
/** Stacking fee per layer count (dowels, cake boards, heavier box, stacking work).
 *  2 layers: €15, the difference in the price list (20 p.: €160 → €175). 3 layers: €30. */
const STACKING_FEE: Record<1 | 2 | 3, number> = { 1: 0, 2: 15, 3: 30 };
/** Linear base: €88 for 8 persons + €6 per extra person, plus the stacking fee. */
const basePrice = (persons: number, layers: 1 | 2 | 3) => 88 + (persons - 8) * PER_PERSON + STACKING_FEE[layers];

export interface CakeSize extends Option { persons: number; layers: 1 | 2 | 3; base: number; deposit: number }

function makeSize(persons: number, layers: 1 | 2 | 3, base: number, deposit: number): CakeSize {
  const value = layers === 1 ? String(persons) : `${persons}-${layers}lagen`;
  return { value, label: `${persons} personen`, hint: layers === 1 ? '1 laag' : `${layers} lagen`, persons, layers, base, deposit };
}

/** Deposit by persons: 8–14 p. €50 · 16–26 p. €75 · from 28 p. €100. */
const depositFor = (persons: number) => (persons <= 14 ? 50 : persons <= 26 ? 75 : 100);

// Client's answers (18 nov 2026): 1 layer up to 20 p.; 2 layers from 16 p. (16–20 the customer
// chooses); 3 layers from 36 p.; only even numbers (the customer rounds); more than 36 → e-mail.
// 36 persons: deposit €100 (confirmed). Bigger cakes are arranged by e-mail.
export const CAKE_SIZES: CakeSize[] = [
  ...[8, 10, 12, 14, 16, 18, 20].map(p => makeSize(p, 1, basePrice(p, 1), depositFor(p))),
  ...[16, 18, 20, 22, 24, 26, 28, 30, 32, 34].map(p => makeSize(p, 2, basePrice(p, 2), depositFor(p))),
  makeSize(36, 3, basePrice(36, 3), depositFor(36)),
];
export const MAX_FORM_PERSONS = 36;

export interface FlavorCategory { id: 0 | 1 | 2 | 3; name: string; surcharge: number }
export const FLAVOR_CATEGORIES: FlavorCategory[] = [
  { id: 0, name: 'Basis', surcharge: 0 },
  { id: 1, name: 'Categorie 1', surcharge: 0.6 },
  { id: 2, name: 'Categorie 2', surcharge: 1.2 },
  { id: 3, name: 'Categorie 3', surcharge: 1.8 },
];

export interface CakeFlavor extends Option { category: 0 | 1 | 2 | 3; description: string }

// Red Velvet is Categorie 1 (confirmed by the client).
// A stacked cake can have a flavour per layer, stored comma-separated in `flavor`
// (bottom → top, empty = no preference). The most expensive flavour sets the surcharge for all persons.
export const CAKE_FLAVORS: CakeFlavor[] = [
  { value: 'luxe-vanille', label: 'Luxe Vanille', category: 0, description: 'Luchtige vanillebiscuit gevuld met een rijke, frisse vanillecrème van verse room en mascarpone.' },
  { value: 'vanille-aardbei', label: 'Vanille & Aardbei', category: 1, description: 'Vanillebiscuit met mascarponeroom en frisse stukjes aardbei. Buiten het seizoen wordt dit een aardbeiencompote.' },
  { value: 'vanille-lemon-curd', label: 'Vanille & Lemon Curd', category: 1, description: 'Vanillebiscuit met mascarponeroom en een frisse swirl van huisgemaakte lemon curd.' },
  { value: 'choco-cappuccino', label: 'Choco Cappuccino', category: 1, description: 'Chocoladebiscuit gevuld met een romige cappuccinomousse.' },
  { value: 'choco-sinaasappel', label: 'Choco Sinaasappel', category: 1, description: 'Chocoladebiscuit gevuld met een fluweelzachte, frisse sinaasappelcurd.' },
  { value: 'red-velvet', label: 'Classic Red Velvet', category: 1, description: 'Fluweelzachte rode biscuit gevuld met een traditionele, romige cream cheese frosting.' },
  { value: 'witte-choco-framboos', label: 'Witte Chocolade & Framboos', category: 2, description: 'Vanillebiscuit met mascarponeroom, frambozen en stukjes witte chocolade.' },
  { value: 'pina-colada', label: 'Pina Colada', category: 2, description: 'Vanillebiscuit met een tropische ananas- en kokoscurd.' },
  { value: 'botanical-strawberry', label: 'Botanical Strawberry', category: 2, description: 'Vanillebiscuit met een verfijnde lavendeltoets en aardbeien.' },
  { value: 'double-chocolate', label: 'Double Chocolate', category: 2, description: 'Intense chocoladebiscuit gevuld met een volle, romige chocolademousse.' },
  { value: 'choco-salty-caramel', label: 'Choco Salty Caramel', category: 2, description: 'Chocoladebiscuit gevuld met gezouten karamel en romige mascarpone.' },
  { value: 'pink-velvet-cava', label: 'Pink Velvet & Cava', category: 2, description: 'Roze velvetbiscuit getemperd met een luxe cavastroop, gevuld met een luchtige roze mousse en verse aardbeien (buiten het seizoen een compote).' },
  { value: 'pure-pistache', label: 'Pure Pistache', category: 3, description: 'Vanillebiscuit gevuld met een luxe mascarponeroom en 100% huisgemaakte, ambachtelijke pistachecrème.' },
  { value: 'raspberry-rose', label: 'Raspberry Rose', category: 3, description: 'Vanillebiscuit met een vulling van frambozen en een subtiele toets van rozenessence.' },
  { value: 'choco-mousse-strawberry', label: 'Choco Mousse & Strawberry', category: 3, description: 'Chocoladebiscuit met een volle chocolademousse en verse aardbeien.' },
  { value: 'choco-violette', label: 'Choco Violette', category: 3, description: 'Chocoladebiscuit gevuld met een exclusieve vulling van violette en bosvruchten.' },
];

/** Flavours for koekjes and mini-gebak (the cake list above is only for the feesttaart). */
export const FLAVORS: Option[] = [
  { value: '', label: 'Geen voorkeur', hint: 'Ik adviseer je graag' },
  { value: 'vanille-bisquit-slagroom', label: 'Vanille biscuit met slagroom' },
  { value: 'vanille-bisquit-aardbei', label: 'Vanille biscuit met aardbei' },
  { value: 'chocolade-bisquit-framboos', label: 'Chocolade biscuit met framboos' },
  { value: 'redvelvet-creamcheese', label: 'Red velvet met cream cheese' },
  { value: 'anders', label: 'Anders', hint: 'vermeld bij opmerkingen' },
];

/** Print and theme decoration are included; figures and 3D cost extra, agreed beforehand. */
export const TOPPERS: Option[] = [
  { value: '', label: 'Eetbare print & thema', hint: 'inbegrepen' },
  { value: 'kunststof', label: 'Kunststof caketopper', hint: 'meerprijs' },
  { value: 'geboetseerd', label: 'Geboetseerd figuur', hint: 'meerprijs' },
  { value: '3d', label: '3D-taart', hint: 'meerprijs' },
];

/** Old values still found in stored orders, so they keep a readable label. */
const LEGACY_TOPPERS: Option[] = [{ value: 'print', label: 'Opdruk op taart' }, { value: 'kunststof', label: 'Kunststof figuurtje' }];

export function cakeSize(item: Pick<AanvraagItem, 'persons'>): CakeSize | undefined {
  return CAKE_SIZES.find(s => s.value === item.persons);
}

export function cakeFlavor(value: string | undefined): CakeFlavor | undefined {
  return CAKE_FLAVORS.find(f => f.value === value);
}

/** Per-layer cake flavours (bottom → top), or null when the value isn't a list of cake flavours
 *  (e.g. free text typed by the admin, like "Aardbei, Choco"). */
export function layerFlavors(value: string | undefined): string[] | null {
  if (!value || !value.includes(',')) return null;
  const parts = value.split(',').map(p => p.trim());
  return parts.every(p => p === '' || cakeFlavor(p)) ? parts : null;
}

/** The most expensive flavour category in a cake flavour value (single or per layer). */
export function flavorCategory(value: string | undefined): FlavorCategory {
  const values = layerFlavors(value) ?? [value ?? ''];
  const id = Math.max(0, ...values.map(v => cakeFlavor(v)?.category ?? 0));
  return FLAVOR_CATEGORIES[id];
}

const LAYER_NAMES: Record<number, string[]> = { 2: ['Onder', 'Boven'], 3: ['Onder', 'Midden', 'Boven'] };

/** Label of any flavour value: per-layer cake flavours, cake list, koekjes/mini list, or the raw value. */
export function flavorLabel(value: string | undefined): string {
  if (!value) return '';
  const layers = layerFlavors(value);
  if (layers) {
    const names = LAYER_NAMES[layers.length] ?? layers.map((_, i) => `Laag ${i + 1}`);
    return layers.map((v, i) => `${names[i]}: ${cakeFlavor(v)?.label ?? 'geen voorkeur'}`).join(' · ');
  }
  return cakeFlavor(value)?.label ?? optionLabel(FLAVORS, value);
}

export function topperLabel(value: string | undefined): string {
  if (!value) return '';
  return TOPPERS.find(o => o.value === value)?.label ?? optionLabel(LEGACY_TOPPERS, value);
}

/** Deposit for one item: only feesttaarten have one. */
export function itemDeposit(item: AanvraagItem): number {
  return item.product === 'feesttaart' ? (cakeSize(item)?.deposit ?? 0) : 0;
}

export const MINI_TYPES: Array<Option & { min: number; step: number }> = [
  { value: 'cupcakes', label: 'Cupcakes', min: 12, step: 6 },
  { value: 'mini-cupcakes', label: 'Mini cupcakes', min: 24, step: 12 },
];

export const KOEKJES_QTY = { min: 24, step: 12, max: 480 };
export const MINI_MAX = 480;
export const MAX_ITEMS = 6;

export const PICKUP_TIMES = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];

export function productName(id: string): string {
  return PRODUCTS.find(p => p.id === id)?.name ?? id;
}

export function optionLabel(options: Option[], value: string | undefined): string {
  if (!value) return '';
  return options.find(o => o.value === value)?.label ?? value;
}

/** Price per decorated cookie (koekjescollectie: "vanaf €2 per koekje"). */
export const KOEKJE_PRICE = 2;

/** Indicative price in euro. Mirrors the tariffs communicated on the collection pages. */
export function itemPrice(item: AanvraagItem): number {
  if (item.product === 'feesttaart') {
    const size = cakeSize(item) ?? CAKE_SIZES[0];
    const surcharge = flavorCategory(item.flavor).surcharge;
    return Math.round((size.base + surcharge * size.persons) * 100) / 100;
  }
  if (item.product === 'koekjes') return (item.quantity || KOEKJES_QTY.min) * KOEKJE_PRICE;
  if (item.product === 'mini-gebak') return item.quantity ? Math.ceil(item.quantity / 12) * 9 : 9;
  return 0;
}

export function itemSummary(item: AanvraagItem): string {
  const parts: string[] = [];
  if (item.event) parts.push(optionLabel(EVENTS, item.event));
  if (item.persons) {
    const size = cakeSize(item);
    parts.push(size ? `${size.label} (${size.hint})` : `${item.persons} personen`);
  }
  if (item.miniType) parts.push(optionLabel(MINI_TYPES, item.miniType));
  if (item.quantity) parts.push(`${item.quantity} stuks`);
  if (item.flavor) parts.push(flavorLabel(item.flavor));
  if (item.topper) parts.push(topperLabel(item.topper));
  return parts.join(' · ');
}

/** Returns a list of problems (empty = valid). Used client- and server-side. */
export function validateItem(item: AanvraagItem): string[] {
  const errors: string[] = [];
  if (!PRODUCTS.some(p => p.id === item.product)) {
    errors.push('Onbekend product');
    return errors;
  }
  if (item.product === 'feesttaart') {
    if (!item.event || !EVENTS.some(o => o.value === item.event)) errors.push('Kies een gelegenheid');
    if (!cakeSize(item)) errors.push('Kies het aantal personen');
    if (item.topper && !TOPPERS.some(o => o.value === item.topper)) errors.push('Onbekende taarttopper');
    if (item.flavor) {
      const layers = layerFlavors(item.flavor);
      if (layers) {
        if (layers.length > (cakeSize(item)?.layers ?? 1)) errors.push('Meer smaken dan lagen');
      } else if (!cakeFlavor(item.flavor)) errors.push('Onbekende smaak');
    }
  } else if (item.flavor && !FLAVORS.some(o => o.value === item.flavor)) errors.push('Onbekende smaak');
  if (item.product === 'koekjes') {
    const q = Number(item.quantity);
    if (!Number.isInteger(q) || q < KOEKJES_QTY.min || q > KOEKJES_QTY.max) errors.push(`Minstens ${KOEKJES_QTY.min} koekjes`);
  }
  if (item.product === 'mini-gebak') {
    const type = MINI_TYPES.find(t => t.value === item.miniType);
    const q = Number(item.quantity);
    if (!type) errors.push('Kies een type mini-gebak');
    else if (!Number.isInteger(q) || q < type.min || q > MINI_MAX) errors.push(`Minstens ${type.min} stuks`);
  }
  if (item.image && !isUploadKey(item.image)) errors.push('Ongeldige voorbeeldfoto');
  if ((item.allergies?.length ?? 0) > 500) errors.push('Allergieën: maximaal 500 tekens');
  if ((item.message?.length ?? 0) > 1000) errors.push('Opmerkingen: maximaal 1000 tekens');
  return errors;
}

export function isUploadKey(key: string): boolean {
  return /^aanvragen\/\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key);
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export function formatEuro(n: number): string {
  return '€' + n.toFixed(2);
}

/** Dutch notation for price lists: € 92,80 */
export function formatEuroNl(n: number): string {
  return '€ ' + n.toFixed(2).replace('.', ',');
}

/** Totals may be stored as numbers (45) or legacy strings ("€45.00"). */
export function parseEuro(raw: unknown): number {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const n = parseFloat(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}
