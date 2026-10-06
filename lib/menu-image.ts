/**
 * Single source of truth for menu image resolution (customer portal).
 *
 * Rule: real record URLs always win. Only when a record has no image, or the
 * remote image fails to load (removed upstream photo, offline LAN, DNS),
 * fall back to a LOCAL public asset — never to another remote URL (a remote
 * fallback reintroduces the same failure mode it is supposed to catch, and
 * breaks offline counter operation).
 *
 * `/drinks.jpg` is the café's own branded drinks photo in `public/`:
 * served by Next on every environment (localhost, LAN, production),
 * requires no internet, needs no next/image domain allow-listing.
 */
export const MENU_IMAGE_FALLBACK = "/drinks.jpg";

export function resolveMenuImage(src?: string | null): string {
  return src && src.trim().length > 0 ? src : MENU_IMAGE_FALLBACK;
}
