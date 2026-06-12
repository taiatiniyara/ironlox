import { z } from "zod";

export const LoginFieldsSchema = z.object({
  uris: z.array(z.string().url()).max(3).optional(),
  username: z.string(),
  password: z.string(),
  previousPasswords: z.array(z.string().max(256)).max(5).optional(),
  totpSecret: z.string().max(256).optional(),
  notes: z.string().max(10000).optional(),
});

export const CardFieldsSchema = z.object({
  cardholder: z.string().max(200),
  number: z.string().max(32),
  expiryMonth: z.string().max(2),
  expiryYear: z.string().max(4),
  cvv: z.string().max(4),
  brand: z.string().max(50).optional(),
  notes: z.string().max(10000).optional(),
});

export const NoteFieldsSchema = z.object({
  content: z.string(),
});

export const IdentityFieldsSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const CustomFieldSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.string().max(10000),
  type: z.enum(["text", "hidden"]),
});

export const VaultItemSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["login", "card", "note", "identity"]),
  name: z.string().min(1).max(500),
  tags: z.array(z.string().max(100)).default([]),
  folderId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean().optional(),
  customFields: z.array(CustomFieldSchema).max(50).optional(),
  fields: z.union([LoginFieldsSchema, CardFieldsSchema, NoteFieldsSchema, IdentityFieldsSchema]),
});

export const VaultSchema = z.object({
  version: z.number().int().positive(),
  items: z.array(VaultItemSchema),
});

// API request/response schemas
export const RegisterRequestSchema = z.object({
  email: z.string().email().max(320),
  authHash: z.string().min(64).max(128),
  authSalt: z.string().min(16).max(128),
  encryptionSalt: z.string().min(16).max(128),
  wrappedVaultKey: z.string().min(1).max(2048),
});

export const LoginRequestSchema = z.object({
  email: z.string().email().max(320),
  authHash: z.string().min(64).max(128),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  vaultVersion: z.number(),
  wrappedVaultKey: z.string(),
  encryptionSalt: z.string(),
  vaultUrl: z.string().optional(),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string(),
});

export const MfaEnableRequestSchema = z.object({
  secret: z.string(),
  code: z.string(),
});

export const MfaVerifyRequestSchema = z.object({
  email: z.string().email(),
  code: z.string(),
  tempToken: z.string(),
});

export const WebAuthnRegisterRequestSchema = z.object({
  credential: z.object({}).passthrough(),
});

export const WebAuthnVerifyRequestSchema = z.object({
  credential: z.object({}).passthrough(),
  email: z.string().email().max(320),
});

export const RecoveryRequestSchema = z.object({
  email: z.string().email(),
  recoveryKey: z.string(),
});

export const PutVaultRequestSchema = z.object({
  version: z.number().int(),
  vaultBlob: z.string(),
});

export const PutVaultResponseSchema = z.object({
  version: z.number(),
  vaultUrl: z.string(),
});

export const AccountInfoResponseSchema = z.object({
  email: z.string().email(),
  tier: z.enum(["free", "premium"]),
  vaultVersion: z.number(),
  attachmentQuota: z.number(),
  attachmentUsed: z.number(),
  createdAt: z.string(),
  loginEvents: z
    .array(
      z.object({
        timestamp: z.string(),
        ipHash: z.string(),
        userAgent: z.string(),
        cityCountry: z.string(),
      }),
    )
    .optional(),
});

export const ChangePasswordRequestSchema = z.object({
  currentEncryptionSalt: z.string().min(16).max(128),
  newEncryptionSalt: z.string().min(16).max(128),
  newWrappedVaultKey: z.string().min(1).max(2048),
  newAuthHash: z.string().min(64).max(128),
  newAuthSalt: z.string().min(16).max(128),
});

export const ChangeEmailRequestSchema = z.object({
  newEmail: z.string().email(),
  otp: z.string(),
});

// Type exports
export type LoginFields = z.infer<typeof LoginFieldsSchema>;
export type CardFields = z.infer<typeof CardFieldsSchema>;
export type NoteFields = z.infer<typeof NoteFieldsSchema>;
export type IdentityFields = z.infer<typeof IdentityFieldsSchema>;
export type CustomField = z.infer<typeof CustomFieldSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
export type Vault = z.infer<typeof VaultSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type MfaEnableRequest = z.infer<typeof MfaEnableRequestSchema>;
export type MfaVerifyRequest = z.infer<typeof MfaVerifyRequestSchema>;
export type RecoveryRequest = z.infer<typeof RecoveryRequestSchema>;
export type PutVaultRequest = z.infer<typeof PutVaultRequestSchema>;
export type PutVaultResponse = z.infer<typeof PutVaultResponseSchema>;
export type AccountInfoResponse = z.infer<typeof AccountInfoResponseSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
export type ChangeEmailRequest = z.infer<typeof ChangeEmailRequestSchema>;

// Typed item helpers — narrow VaultItem.fields to the correct subtype
export type TypedVaultItem<T extends VaultItem["type"]> = Omit<VaultItem, "fields"> & {
  fields: T extends "login"
    ? LoginFields
    : T extends "card"
      ? CardFields
      : T extends "note"
        ? NoteFields
        : T extends "identity"
          ? IdentityFields
          : never;
};

export function isLoginItem(item: VaultItem): item is TypedVaultItem<"login"> {
  return item.type === "login";
}
export function isCardItem(item: VaultItem): item is TypedVaultItem<"card"> {
  return item.type === "card";
}
export function isNoteItem(item: VaultItem): item is TypedVaultItem<"note"> {
  return item.type === "note";
}
export function isIdentityItem(item: VaultItem): item is TypedVaultItem<"identity"> {
  return item.type === "identity";
}
