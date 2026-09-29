// src/data/home.ts — Content for the home page sections.

export const OCCASIONS = [
  { label: 'Verjaardag', icon: 'fa-cake-candles' },
  { label: 'Communie', icon: 'fa-dove' },
  { label: 'Huwelijk', icon: 'fa-ring' },
  { label: 'Doopsel', icon: 'fa-baby' },
  { label: 'Baby shower', icon: 'fa-baby-carriage' },
  { label: 'Jubileum', icon: 'fa-champagne-glasses' },
  { label: 'Lentefeest', icon: 'fa-seedling' },
  { label: 'Gewoon omdat het kan', icon: 'fa-heart' },
];

export const STEPS = [
  {
    title: 'Kies je lekkers',
    text: 'Feesttaart, koekjes of mini-gebak — combineer gerust. Kies gelegenheid, aantal personen en smaak.',
    icon: 'fa-cake-candles',
    image: '/images/trouwtaart.png',
  },
  {
    title: 'Maak het persoonlijk',
    text: 'Een thema, een naam, een figuurtje of een voorbeeldfoto? Vertel het ons, alles kan op maat.',
    icon: 'fa-wand-magic-sparkles',
    image: '/images/koekjes.png',
  },
  {
    title: 'Prik een datum',
    text: 'De kalender toont live welke dagen en ophaalmomenten nog vrij zijn.',
    icon: 'fa-calendar-check',
    image: '/images/cupcakes.png',
  },
  {
    title: 'Nathalie bevestigt',
    text: 'Je krijgt een mail met de bevestiging en definitieve prijs. Daarna is het aftellen tot het feest!',
    icon: 'fa-heart',
    image: '/images/nathalie-e1542633374448.jpg',
  },
];

export const INTRO_STATS = [
  { label: 'Bakatelier sinds', value: 2018, from: 2000, suffix: '' },
  { label: 'Handgemaakt', value: 100, from: 0, suffix: '%' },
];

// Photos of customers that go with the testimonials (by author name)
export const TESTIMONIAL_PHOTOS: Record<string, string> = {
  'Sofie Missiaen': '/images/mini-collectie/sofie.jpg',
  'Vanessa Anaïs Verkempynck': '/images/mini-collectie/vanessa.jpg',
};
