/**
 * Narrows a parsed update to the fields the request actually carried.
 *
 * Parsing fills in every default the schema declares, and `.partial()` does not stop it:
 * `{ outcome: 'Converted' }` comes back with a blank notes, exec, follow-up and flag
 * beside it. Writing that whole object to the document erases what was already there, so
 * changing one field quietly clears the rest — which is what the Converted tick in the
 * CRM was doing to every lead it touched.
 */
export function onlySent<T extends object>(parsed: T, body: unknown): Partial<T> {
  const sent = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  return Object.fromEntries(Object.entries(parsed).filter(([key]) => key in sent)) as Partial<T>
}
