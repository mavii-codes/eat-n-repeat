import crypto from "node:crypto";

/* Friendly temporary passwords for staff accounts.
 *
 * Format: Word-Word-DDD (e.g. "Latte-Cebu-482") — two random words from a
 * café-flavoured list plus three random digits. Chosen so a manager can
 * read it over the phone and a new hire can type it on first sign-in:
 * no symbols, no look-alike digits (0/O, 1/l), always 11+ characters.
 *
 * The password policy only requires 8+ characters and not being in the
 * common-password list, which this format always satisfies. Accounts
 * created or reset with a temporary password set mustChangePassword, so
 * the temporary value only lives until the first sign-in. */

const WORDS = [
  "Latte", "Mocha", "Cocoa", "Matcha", "Boba", "Brew", "Barako",
  "Cordova", "Cebu", "Lapu", "Mactan", "Gabi", "Camotes", "Ube",
  "Mango", "Pandesal", "Kape", "Silog", "Adobo", "Taho", "Puto",
  "Bibingka", "Choco", "Vanilla", "Caramel", "Hazelnut", "Cinnamon",
  "Toffee", "Milktea", "Frappe",
];

function pickWord(exclude?: string): string {
  for (;;) {
    const word = WORDS[crypto.randomInt(WORDS.length)];
    if (word !== exclude) return word;
  }
}

/**
 * Generates an easy-to-type temporary password ("Latte-Cebu-482") that
 * always passes `assertPasswordPolicy`.
 */
export function generateTemporaryPassword(): string {
  const first = pickWord();
  const second = pickWord(first);
  const digits = String(crypto.randomInt(1000)).padStart(3, "0");
  return `${first}-${second}-${digits}`;
}
