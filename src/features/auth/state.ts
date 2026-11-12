// Account-form state and validation; no DOM or cloud access.
export type AuthMode = "signup" | "login";
export interface RememberedSignIn {
  email: string;
  via: string;
}

export function rememberedSignIn(raw: string | null): RememberedSignIn {
  try {
    const data: unknown = JSON.parse(raw || "null");
    if (data && typeof data === "object" && "email" in data && typeof data.email === "string") {
      const providers = "providers" in data && Array.isArray(data.providers) ? data.providers : [];
      return {
        email: data.email.slice(0, 200),
        via:
          providers.includes("google.com") && !providers.includes("password")
            ? "Google"
            : "email and password",
      };
    }
  } catch {
    // A corrupt browser-only hint must not prevent signing in.
  }
  return { email: "", via: "" };
}

export function validateCredentials(
  mode: AuthMode,
  email: string,
  password: string,
  name: string,
): string | null {
  if (!email || !password) return "Email and password are both required.";
  if (mode === "signup" && !name)
    return "Pick a display name -- this is what your podmates will see instead of your email.";
  return null;
}
