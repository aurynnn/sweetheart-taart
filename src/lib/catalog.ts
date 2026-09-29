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
  { id: 'feesttaart', name: 'Feesttaart', tagline: 'Luchtige biscuit met mousse, vanaf 8 personen', image: '/images/trouwtaart.png', icon: 'fa-cake-candles', from: 'vanaf €45' },
  { id: 'koekjes', name: 'Koekjes', tagline: 'Prachtig versierd, per 12 stuks', image: '/images/koekjes.png', icon: 'fa-cookie-bite', from: 'vanaf €12' },
  { id: 'mini-gebak', name: 'Mini-gebak', tagline: 'Cupcakes & mini cupcakes', image: '/images/cupcakes.png', icon: 'fa-cookie', from: 'vanaf €9' },
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

export const PERSONS: Option[] = [
  { value: '8-14', label: '8–14', hint: '1 laag' },
  { value: '15-25', label: '15–25', hint: '2 lagen' },
  { value: '25-40', label: '25–40', hint: '3 lagen' },
  { value: '40+', label: '40+', hint: 'meerdere lagen' },
];

export const FLAVORS: Option[] = [
  { value: '', label: 'Geen voorkeur', hint: 'Nathalie adviseert' },
  { value: 'vanille-bisquit-slagroom', label: 'Vanille biscuit met slagroom' },
  { value: 'vanille-bisquit-aardbei', label: 'Vanille biscuit met aardbei' },
  { value: 'chocolade-bisquit-framboos', label: 'Chocolade biscuit met framboos' },
  { value: 'redvelvet-creamcheese', label: 'Red velvet met cream cheese' },
  { value: 'anders', label: 'Anders', hint: 'vermeld bij opmerkingen' },
];

export const TOPPERS: Option[] = [
  { value: '', label: 'Geen figuurtje' },
  { value: 'kunststof', label: 'Kunststof figuurtje' },
  { value: 'geboetseerd', label: 'Geboetseerd figuurtje' },
  { value: 'print', label: 'Opdruk op taart' },
];

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

/** Indicative price in euro. Mirrors the tariffs communicated on the collection pages. */
export function itemPrice(item: AanvraagItem): number {
  if (item.product === 'feesttaart') return 45;
  if (item.product === 'koekjes') return item.quantity ? Math.ceil(item.quantity / 24) * 12 : 12;
  if (item.product === 'mini-gebak') return item.quantity ? Math.ceil(item.quantity / 12) * 9 : 9;
  return 0;
}

export function itemSummary(item: AanvraagItem): string {
  const parts: string[] = [];
  if (item.event) parts.push(optionLabel(EVENTS, item.event));
  if (item.persons) parts.push(`${item.persons} personen`);
  if (item.miniType) parts.push(optionLabel(MINI_TYPES, item.miniType));
  if (item.quantity) parts.push(`${item.quantity} stuks`);
  if (item.flavor) parts.push(optionLabel(FLAVORS, item.flavor));
  if (item.topper) parts.push(optionLabel(TOPPERS, item.topper));
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
    if (!item.persons || !PERSONS.some(o => o.value === item.persons)) errors.push('Kies het aantal personen');
    if (item.topper && !TOPPERS.some(o => o.value === item.topper)) errors.push('Onbekende taarttopper');
  }
  if (item.flavor && !FLAVORS.some(o => o.value === item.flavor)) errors.push('Onbekende smaak');
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

/** Totals may be stored as numbers (45) or legacy strings ("€45.00"). */
export function parseEuro(raw: unknown): number {
  if (typeof raw === 'number') return isFinite(raw) ? raw : 0;
  if (typeof raw !== 'string') return 0;
  const n = parseFloat(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}
