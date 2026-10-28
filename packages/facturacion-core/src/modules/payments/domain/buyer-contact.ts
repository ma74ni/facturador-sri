import { SriAuthorizedInvoice } from './sri-authorized-invoice';

/** El contacto del comprador tal como viene en el XML autorizado. */
export type BuyerContact = Pick<SriAuthorizedInvoice['buyer'], 'email' | 'phone' | 'address'>;

export function newestFirst<T extends { issueDate: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
}

/** Los datos de contacto para crear un cliente nuevo. */
export function contactData(buyer: BuyerContact) {
  return {
    email: buyer.email ?? undefined,
    phone: buyer.phone ?? undefined,
    address: buyer.address ?? undefined,
  };
}

/** Solo los datos que el cliente no tiene: nunca pisa lo cargado a mano. */
export function missingContact(
  customer: Partial<Record<keyof BuyerContact, string | null>>,
  buyer: BuyerContact,
) {
  const data: Partial<Record<keyof BuyerContact, string>> = {};
  for (const field of ['email', 'phone', 'address'] as const) {
    if (!customer[field]?.trim() && buyer[field]) data[field] = buyer[field]!;
  }
  return data;
}
