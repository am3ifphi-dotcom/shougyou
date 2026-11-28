/* シナリオコマンド定義 */
import type { BgKey, CharId, SpriteSlot } from './stage';
import type { BgmKey, SeKey, VoiceKey } from './audio';

export type CgKey = 'cg_flashback_1981' | 'cg_last_night' | 'cg_rebuilt';

export const CG_PATHS: Record<CgKey, string> = {
  cg_flashback_1981: 'assets/cg/cg_flashback_1981.jpg',
  cg_last_night:     'assets/cg/cg_last_night.jpg',
  cg_rebuilt:        'assets/cg/cg_rebuilt.jpg',
};

export type Cmd =
  | { t: 'bg'; key: BgKey; instant?: boolean }
  | { t: 'cg'; key: CgKey }
  | { t: 'cgHide' }
  | { t: 'say'; speaker: CharId | 'narrator' | 'keiichi'; text: string; expr?: string; voice?: VoiceKey }
  | { t: 'show'; char: CharId; expr?: string; slot?: SpriteSlot }
  | { t: 'hide'; char: CharId }
  | { t: 'expr'; char: CharId; expr: string }
  | { t: 'bgm'; key: BgmKey | null; fade?: number }
  | { t: 'se'; key: SeKey; volume?: number }
  | { t: 'wait'; ms: number }
  | { t: 'fx'; kind: 'flash' | 'shake' | 'fadeblack' | 'fadeblackOut' | 'fadewhite' | 'fadewhiteOut' | 'stardust'; intensity?: number }
  | { t: 'label'; id: string }
  | { t: 'jump'; to: string }
  | { t: 'choice'; options: Array<{ label: string; to: string }> }
  | { t: 'chapter'; kicker: string; title: string }
  | { t: 'ending'; id: string; title: string }
  | { t: 'unlockCG'; key: CgKey }
  | { t: 'setParticle'; mode: 'none' | 'dust' | 'stars' | 'stardust' };
