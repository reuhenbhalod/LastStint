// The identity of a race model: SHA-256 (hex) of its canonical JSON. The Worker and the
// schedule script both use this, so a scheduled day pins exactly the model it was given.

export async function modelHash(model: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(model));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
