// src/lib/email/links.ts — Personal links used in e-mails. Each carries an id + signature
// (lib/tokens.ts), never an e-mail address, so nothing personal ends up in URLs or logs.

import { SITE } from '../../config/site';
import { signToken } from '../tokens';
import { siteUrl } from './layout';

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** 1–4 stars → our feedback page; 5 stars → straight to Google reviews */
export const ratingUrl = (orderId: string) => (stars: number) =>
  stars === 5 ? SITE.reviewUrl : siteUrl(`/beoordeling?${q({ o: orderId, r: String(stars), t: signToken('review', orderId) })}`);

export const unsubscribeUrlForCustomer = (customerId: string) =>
  siteUrl(`/uitschrijven?${q({ c: customerId, t: signToken('optout', `c:${customerId}`) })}`);

export const unsubscribeUrlForReminder = (reminderId: string) =>
  siteUrl(`/uitschrijven?${q({ r: reminderId, t: signToken('optout', `r:${reminderId}`) })}`);

export const reminderUrl = (reminderId: string, action: 'bevestig' | 'annuleer') =>
  siteUrl(`/herinnering?${q({ id: reminderId, actie: action, t: signToken('reminder', reminderId) })}`);
