// The player's "About you" details from settings: optional, kept on this device only (nothing is sent anywhere yet). Pure: no UI imports.

export const PROFILE_KEY = 'bank-shot/profile';

export const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export interface Profile {
  name: string;
  /** Whole years, or null when not given. */
  age: number | null;
  gender: Gender | null;
  country: string;
}

export const emptyProfile = (): Profile => ({ name: '', age: null, gender: null, country: '' });

/** An age typed into the form: whole years from 5 to 120, anything else is "not given". */
export function parseAge(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 5 && n <= 120 ? n : null;
}

/** Read a stored profile, keeping only well-formed fields. */
export function parseProfile(raw: string | null): Profile {
  try {
    const o = JSON.parse(raw ?? '{}') as Partial<Record<keyof Profile, unknown>>;
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    return {
      name: text(o.name, 40),
      age: typeof o.age === 'number' ? parseAge(String(o.age)) : null,
      gender: GENDERS.includes(o.gender as Gender) ? (o.gender as Gender) : null,
      country: text(o.country, 40),
    };
  } catch {
    return emptyProfile();
  }
}

/** Whether anything has been filled in. */
export const hasProfile = (p: Profile) => !!(p.name || p.age != null || p.gender || p.country);
