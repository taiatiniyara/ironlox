/**
 * Ironlox crypto — all encryption, key derivation, and TOTP.
 * Uses Web Crypto API (SubtleCrypto) + @noble/hashes for Argon2id.
 * No node:crypto. No third-party crypto beyond noble.
 */

// Public API surface — all exports are named, pure, synchronous where possible.
export { aesEncrypt, aesDecrypt } from "./aes.js";
export { deriveEncryptionKey, deriveAuthHash, generateVaultKey, wrapVaultKey, unwrapVaultKey, generateSalt } from "./keys.js";
export { generateRecoveryKey, hashRecoveryKey } from "./recovery.js";
export { generatePassword, generatePassphrase } from "./generator.js";
export { generateTotp, generateTotpSecret, verifyTotp, generateTotpUri } from "./totp.js";
export { constantTimeEqual, importExportCsv, exportVaultToCsv } from "./utils.js";
export { encryptVault, decryptVault, createEmptyVault, addItemToVault, removeItemFromVault, updateItemInVault } from "./vault.js";
