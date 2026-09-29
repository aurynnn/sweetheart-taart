// src/config/site.ts — Business details in one place.
// Used by pages, components and e-mails, so a new phone number or address is a one-line change.

export const SITE = {
  name: 'Sweetheart',
  tagline: 'Koekjes, Cake & Taart',
  owner: 'Nathalie',
  url: 'https://sweetheart-taart.com',
  email: 'nathalie@sweetheart-taart.com',
  phone: {
    display: '0486 95 32 10',
    international: '+32 486 95 32 10',
    href: 'tel:+32486953210',
  },
  address: {
    street: 'Zwanenlaan 62',
    postalCode: '8400',
    city: 'Oostende',
  },
  openingHours: 'Donderdag 17u – 20u (niet tijdens schoolvakanties)',
  reviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJ722oViGs3EcRQQq7hspVsDs',
  social: {
    facebook: 'https://www.facebook.com/pages/category/Product-Service/Sweetheart-koekjes-cake-en-taart-131377077490172/',
    instagram: 'https://www.instagram.com/sweetheart.taart/',
  },
} as const;

export const fullAddress = `${SITE.address.street}, ${SITE.address.postalCode} ${SITE.address.city}`;

/** Opens turn-by-turn directions (Google Maps app on phones, maps.google.com on desktop) */
export const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;
