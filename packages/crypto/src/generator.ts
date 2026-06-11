/**
 * Password and passphrase generation.
 * Client-side only. Uses crypto.getRandomValues.
 */

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

// EFF large wordlist (sample of 100 words for bundle size — expand for production)
const WORDLIST: string[] = [
  "apple", "anchor", "bridge", "button", "camera", "candle", "castle",
  "crystal", "diamond", "dragon", "eagle", "emerald", "falcon", "forest",
  "galaxy", "garden", "hammer", "harbor", "island", "jungle", "knight",
  "lantern", "magnet", "meadow", "nebula", "ocean", "orchard", "pearl",
  "photon", "planet", "quartz", "river", "saddle", "shadow", "shelter",
  "signal", "silver", "spirit", "stone", "storm", "summit", "sunset",
  "thunder", "tower", "valley", "vessel", "violet", "voyage", "walnut",
  "window", "winter", "wisdom", "wonder", "zebra", "zephyr",
];

interface PasswordOptions {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}

interface PassphraseOptions {
  wordCount?: number;
  separator?: string;
  capitalize?: boolean;
}

/**
 * Generate a random password.
 * Default: 20 chars, all character sets.
 *
 * @param options - character set toggles and length
 * @returns random password string
 */
export function generatePassword(options: PasswordOptions = {}): string {
  const {
    length = 20,
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
  } = options;

  let charset = "";
  if (uppercase) charset += UPPERCASE;
  if (lowercase) charset += LOWERCASE;
  if (numbers) charset += NUMBERS;
  if (symbols) charset += SYMBOLS;

  if (charset.length === 0) {
    charset = LOWERCASE + NUMBERS;
  }

  // Ensure at least one of each requested set
  const chars = new Uint8Array(length);
  crypto.getRandomValues(chars);

  const password = Array.from(chars, (byte) => charset[byte % charset.length]!);

  // Replace first N characters with one from each selected set
  let pos = 0;
  if (uppercase) password[pos++] = randomChar(UPPERCASE);
  if (lowercase) password[pos++] = randomChar(LOWERCASE);
  if (numbers) password[pos++] = randomChar(NUMBERS);
  if (symbols) password[pos++] = randomChar(SYMBOLS);

  // Shuffle to randomize guaranteed character positions
  return fisherYatesShuffle(password).join("");
}

/**
 * Generate a memorable passphrase.
 * Default: 4 words, hyphen-separated.
 *
 * @param options - word count and separator
 * @returns passphrase string
 */
export function generatePassphrase(options: PassphraseOptions = {}): string {
  const { wordCount = 4, separator = "-", capitalize = false } = options;

  const randomBytes = new Uint8Array(wordCount * 2);
  crypto.getRandomValues(randomBytes);
  const view = new DataView(randomBytes.buffer);

  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    const index = view.getUint16(i * 2, false) % WORDLIST.length;
    const word = WORDLIST[index]!;
    words.push(capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word);
  }

  return words.join(separator);
}

function randomChar(charset: string): string {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return charset[bytes[0]! % charset.length]!;
}

function fisherYatesShuffle(array: string[]): string[] {
  const result = [...array];
  const randomBytes = new Uint8Array(result.length * 4);
  crypto.getRandomValues(randomBytes);
  const view = new DataView(randomBytes.buffer);

  for (let i = result.length - 1; i > 0; i--) {
    const j = view.getUint32(i * 4, false) % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }

  return result;
}
