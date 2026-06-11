/**
 * Password and passphrase generation.
 * Client-side only. Uses crypto.getRandomValues.
 */

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

// EFF large wordlist (7,776 words) — sample of 500 for bundle size
const WORDLIST: string[] = [
// EFF large wordlist — expanded selection of 500 words (~9 bits/word entropy)
  "abacus", "abandon", "ability", "able", "abroad", "absent", "absorb", "abstract",
  "academy", "accent", "accept", "access", "account", "accuse", "achieve", "acquire",
  "action", "active", "actual", "adapt", "addition", "address", "adjust", "admit",
  "adopt", "advance", "advice", "affair", "afford", "after", "agency", "agent",
  "agenda", "anchor", "animal", "annual", "answer", "anxiety", "anybody", "apart",
  "appeal", "appear", "apple", "applied", "approach", "approve", "archive", "arrange",
  "arrival", "article", "artist", "aspect", "assign", "assist", "assume", "athlete",
  "atlas", "attach", "attack", "attempt", "attend", "auction", "august", "author",
  "average", "badger", "baggage", "balance", "balloon", "banana", "banker", "banner",
  "barrel", "basket", "battery", "beacon", "beauty", "become", "before", "behave",
  "behind", "belief", "belong", "beside", "beyond", "bishop", "bitter", "blanket",
  "bless", "blossom", "boring", "bottle", "bottom", "bounce", "branch", "brave",
  "breath", "bridge", "bright", "broken", "broker", "bubble", "budget", "buffer",
  "bullet", "bundle", "burden", "butter", "button", "cabin", "camera", "campus",
  "cancel", "candle", "capital", "captain", "capture", "carbon", "career", "carpet",
  "castle", "catalog", "category", "caution", "cavity", "ceiling", "census", "center",
  "chance", "change", "channel", "chapter", "charge", "charm", "chemical", "cherry",
  "choice", "cipher", "circuit", "citizen", "climate", "clinic", "closure", "cluster",
  "coffee", "college", "combat", "combine", "comfort", "command", "comment", "compact",
  "company", "compare", "compass", "compete", "complex", "concept", "concern", "conduct",
  "confirm", "connect", "consent", "contact", "contain", "content", "contest", "context",
  "control", "convert", "correct", "council", "counter", "country", "courage", "creator",
  "credit", "cricket", "cross", "crystal", "culture", "current", "custom", "damage",
  "debate", "decade", "decline", "default", "defense", "deficit", "deploy", "deposit",
  "desert", "design", "desire", "desktop", "detail", "detect", "develop", "device",
  "dialog", "diamond", "digital", "dilemma", "direct", "discuss", "display", "dispute",
  "distant", "diverse", "doctor", "domain", "double", "dragon", "drawer", "driving",
  "dynamic", "eager", "eagle", "editor", "effect", "effort", "element", "emerald",
  "emotion", "empire", "enable", "energy", "engage", "engine", "enhance", "ensure",
  "entire", "entity", "escape", "estate", "ethics", "exceed", "excess", "execute",
  "exhaust", "exhibit", "expand", "expect", "expert", "explain", "export", "extend",
  "faculty", "falcon", "fallen", "family", "famous", "farmer", "fashion", "feather",
  "fellow", "female", "figure", "filter", "finger", "finish", "fiscal", "forest",
  "forgot", "formal", "format", "former", "fossil", "foster", "fragile", "freedom",
  "frozen", "galaxy", "gallery", "garden", "garlic", "gather", "gender", "genius",
  "gentle", "glacier", "global", "golden", "govern", "grant", "grocery", "growth",
  "hammer", "handle", "happen", "harbor", "health", "heaven", "height", "helmet",
  "hidden", "horizon", "hybrid", "ignore", "impact", "import", "income", "indoor",
  "injury", "insect", "insert", "insist", "intact", "invest", "island", "jacket",
  "jungle", "kitten", "knight", "lantern", "laptop", "launch", "layout", "leader",
  "league", "legacy", "legend", "length", "lesson", "liberty", "linear", "liquid",
  "listen", "litter", "magnet", "manage", "margin", "market", "master", "matter",
  "medium", "member", "memory", "mental", "mercy", "method", "middle", "mighty",
  "mineral", "miracle", "mirror", "mystery", "nebula", "needle", "narrow", "native",
  "nature", "notion", "object", "obtain", "occur", "ocean", "offend", "office",
  "oppose", "option", "orchard", "orient", "outlook", "oxygen", "palace", "pearl",
  "pepper", "period", "permit", "person", "photon", "pillar", "planet", "pocket",
  "poetry", "policy", "porter", "potato", "powder", "prayer", "prefer", "prince",
  "prison", "profit", "proper", "protest", "public", "puzzle", "quartz", "rabbit",
  "random", "rather", "rebuild", "record", "reform", "regard", "regret", "reject",
  "relate", "relief", "remain", "remote", "remove", "render", "repair", "repeat",
  "report", "rescue", "resist", "resort", "result", "retail", "retain", "retire",
  "return", "reveal", "review", "revise", "ribbon", "rocket", "saddle", "safety",
  "salary", "salmon", "sample", "scheme", "scholar", "screen", "script", "search",
  "season", "secret", "secure", "seldom", "select", "shadow", "shelter", "signal",
  "silver", "simple", "single", "sister", "sketch", "soccer", "social", "source",
  "spirit", "sponsor", "spread", "stable", "status", "stereo", "studio", "subject",
  "submit", "subsidy", "subtle", "succeed", "sudden", "suffer", "summit", "sunset",
  "super", "supply", "support", "suppose", "surgery", "sustain", "symbol", "symptom",
  "system", "tackle", "talent", "target", "temple", "tender", "tennis", "terror",
  "theater", "thrive", "thunder", "timber", "tissue", "tobacco", "toilet", "tongue",
  "toward", "tragic", "travel", "treaty", "tunnel", "unable", "unfair", "unique",
  "unknow", "unless", "unlike", "update", "useful", "valley", "vessel", "victim",
  "viewer", "vintage", "violet", "voyage", "walnut", "wander", "warmth", "wealth",
  "weapon", "window", "winter", "wisdom", "witness", "wonder", "worker", "worthy",
  "writer", "yearly", "zebra", "zephyr",
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

  // Ensure at least one of each requested set at positions 0-3
  let idx = 0;
  const sets: Array<{ enabled: boolean; chars: string }> = [
    { enabled: uppercase, chars: UPPERCASE },
    { enabled: lowercase, chars: LOWERCASE },
    { enabled: numbers, chars: NUMBERS },
    { enabled: symbols, chars: SYMBOLS },
  ];
  for (const set of sets) {
    if (set.enabled) {
      password[idx] = randomChar(set.chars);
      idx++;
    }
  }

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
