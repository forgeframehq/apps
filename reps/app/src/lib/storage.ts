import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Plain JSON files in the app's private folder. (In a browser, used for development, it falls back to localStorage.)
const web = Platform.OS === 'web';
const file = (name: string) => new File(Paths.document, `${name}.json`);

export async function readJson<T>(name: string): Promise<T | null> {
  try {
    if (web) {
      const raw = globalThis.localStorage?.getItem(`reps.${name}`);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    const f = file(name);
    return f.exists ? (JSON.parse(await f.text()) as T) : null;
  } catch {
    return null; // a missing or corrupt file should never stop the app from opening
  }
}

export function writeJson(name: string, value: unknown): void {
  try {
    const text = JSON.stringify(value);
    if (web) globalThis.localStorage?.setItem(`reps.${name}`, text);
    else {
      const f = file(name);
      if (!f.exists) f.create();
      f.write(text);
    }
  } catch (e) {
    console.warn('Could not save', name, e);
  }
}

export function removeJson(name: string): void {
  try {
    if (web) globalThis.localStorage?.removeItem(`reps.${name}`);
    else {
      const f = file(name);
      if (f.exists) f.delete();
    }
  } catch {
    // nothing to remove
  }
}
