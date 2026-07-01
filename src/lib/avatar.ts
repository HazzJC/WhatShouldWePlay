export const maxAvatarBytes = 512 * 1024;
export const allowedAvatarTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedAvatarType = (typeof allowedAvatarTypes)[number];

export async function validateAvatarFile(file: File) {
  if (!allowedAvatarTypes.includes(file.type as AllowedAvatarType)) {
    return { success: false as const, error: "Choose a JPEG, PNG, or WebP image." };
  }

  if (file.size <= 0 || file.size > maxAvatarBytes) {
    return { success: false as const, error: "Profile pictures must be 512 KB or smaller." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  return validateAvatarBytes(bytes, file.type, file.size);
}

export function validateAvatarBytes(bytes: Uint8Array, mimeType: string, sizeBytes = bytes.byteLength) {
  if (!allowedAvatarTypes.includes(mimeType as AllowedAvatarType)) {
    return { success: false as const, error: "Choose a JPEG, PNG, or WebP image." };
  }

  if (sizeBytes <= 0 || sizeBytes > maxAvatarBytes) {
    return { success: false as const, error: "Profile pictures must be 512 KB or smaller." };
  }

  if (!signatureMatches(bytes, mimeType as AllowedAvatarType)) {
    return { success: false as const, error: "The selected file does not contain a valid image." };
  }

  return {
    success: true as const,
    data: Buffer.from(bytes),
    mimeType: mimeType as AllowedAvatarType,
    sizeBytes,
  };
}

function signatureMatches(bytes: Uint8Array, mimeType: AllowedAvatarType) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }

  return (
    readAscii(bytes, 0, 4) === "RIFF" &&
    readAscii(bytes, 8, 12) === "WEBP"
  );
}

function readAscii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}
