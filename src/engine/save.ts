/* セーブ/ロード — サムネイル付き10スロット（QUICK/AUTO含む） */
import html2canvas from 'html2canvas';
import type { BgmKey } from './audio';
import type { CharId, SpriteSlot } from './stage';

export interface SpriteState { char: CharId; expr: string; slot: SpriteSlot }

export interface SaveData {
  version: 1;
  slot: number;
  timestamp: number;
  chapter: string;
  index: number;
  bgKey: string | null;
  cgKey: string | null;
  sprites: SpriteState[];
  bgm: BgmKey | null;
  playtimeMs: number;
  thumb: string | null;
}

const SAVE_KEY = 'hoshikuzu_saves_v1';
export const SLOT_COUNT = 10;
export const QUICK_SLOT = 8;
export const AUTO_SLOT = 9;

function readAll(): (SaveData | null)[] {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as (SaveData | null)[];
      return Array.from({ length: SLOT_COUNT }, (_, i) => arr[i] ?? null);
    }
  } catch { /* ignore */ }
  return Array.from({ length: SLOT_COUNT }, () => null);
}

function writeAll(slots: (SaveData | null)[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(slots)); } catch (e) {
    console.warn('save failed', e);
    throw new Error('セーブ容量が不足しています。古いセーブデータを削除してください。');
  }
}

export function listSaves(): (SaveData | null)[] { return readAll(); }
export function getSave(slot: number): SaveData | null { return readAll()[slot] ?? null; }
export function hasAnySave(): boolean { return readAll().some(s => s !== null); }

export function writeSave(data: Omit<SaveData, 'version' | 'timestamp'> & { thumb?: string | null }) {
  const slots = readAll();
  const full: SaveData = { ...data, version: 1, timestamp: Date.now(), thumb: data.thumb ?? null };
  slots[data.slot] = full;
  writeAll(slots);
}

export function deleteSave(slot: number) {
  const slots = readAll();
  slots[slot] = null;
  writeAll(slots);
}

/* #stage を小さなJPEGサムネイルに */
export async function captureThumbnail(): Promise<string | null> {
  const el = document.getElementById('stage');
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      width: 1920, height: 1080, scale: 0.3,
      backgroundColor: '#000', logging: false, useCORS: true,
    });
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch (e) {
    console.warn('thumbnail capture failed', e);
    return null;
  }
}
