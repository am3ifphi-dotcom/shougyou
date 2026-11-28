/* スタッフロールとエンディング演出 */
import { Starfield } from './starfield';
import { STAFFROLL } from '../scenario';
import { fx } from '../engine/fx';

const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

export function showStaffroll(endingTitle: string, onFinish: () => void) {
  const el = document.getElementById('staffroll')!;
  const track = document.getElementById('staffroll-track')!;
  const starsCanvas = document.getElementById('staffroll-stars') as HTMLCanvasElement;
  const skipBtn = document.getElementById('staffroll-skip')!;

  el.classList.remove('hidden');
  const starfield = new Starfield(starsCanvas, 210);

  /* クレジットHTML */
  let html = `
    <div style="height:190px"></div>
    <div class="sr-kicker">THE END OF THE STORY</div>
    <div class="sr-title">星屑珈琲</div>
    <div class="sr-sub">${escapeHtml(endingTitle)}</div>
    <div class="sr-rule"></div>`;
  for (const item of STAFFROLL) {
    if (item.role) html += `<div class="sr-role">${escapeHtml(item.role)}</div>`;
    if (item.name) html += `<div class="sr-name">${escapeHtml(item.name)}</div>`;
    if (item.small) html += `<div class="sr-small">${escapeHtml(item.small)}</div>`;
  }
  html += `
    <div class="sr-spacer"></div>
    <div class="sr-rule"></div>
    <div class="sr-role" style="font-size:22px">SPECIAL THANKS</div>
    <div class="sr-name">芦木町の、すべての記憶</div>
    <div class="sr-small">あなたが、忘れなければ――</div>
    <div class="sr-spacer" style="height:180px"></div>
    <div class="sr-kicker">FIN</div>
    <div class="sr-spacer" style="height:300px"></div>`;
  track.innerHTML = html;

  void (async () => {
    // 開始位置は画面下
    const total = track.scrollHeight + 40;
    const duration = Math.max(46, total / 16.5) * 1000; // ゆっくり
    track.style.transition = 'none';
    track.style.transform = 'translateY(1080px)';
    void track.offsetHeight;
    track.style.transition = `transform ${duration}ms linear`;
    track.style.transform = `translateY(-${total}px)`;

    let skipped = false;
    const skipHandler = () => { skipped = true; cleanup(); finish(); };
    const timer = window.setTimeout(() => { if (!skipped) { cleanup(); finish(); } }, duration + 600);
    const cleanup = () => { window.clearTimeout(timer); skipBtn.removeEventListener('click', skipHandler); };
    skipBtn.addEventListener('click', skipHandler);
  })();

  function finish() {
    el.classList.add('hidden');
    starfield.destroy();
    void showEndTitle(onFinish);
  }
}

async function showEndTitle(onFinish: () => void) {
  const root = document.getElementById('modal-root')!;
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.style.cssText = 'background:radial-gradient(ellipse at center,#0b0b16 0%,#050508 100%);flex-direction:column;z-index:50';
  veil.innerHTML = `
    <div style="text-align:center;opacity:0;transition:opacity 1.6s ease" id="end-title-inner">
      <div style="font-size:19px;letter-spacing:0.5em;color:var(--gold);margin-bottom:18px;padding-left:0.5em">HOSHIKUZU KISSATEN</div>
      <div style="font-size:52px;font-weight:800;letter-spacing:0.18em;padding-left:0.18em;color:var(--cream);text-shadow:0 0 44px rgba(232,201,122,0.3)">星屑は、消えない。</div>
      <div style="margin-top:22px;font-size:17px;color:#a49fb6;letter-spacing:0.28em">―― 君の記憶のなかで、星は降り続けている ――</div>
      <button id="end-title-return" style="margin-top:56px;font-size:21px;letter-spacing:0.3em;padding:16px 54px 16px 60px;border:1px solid var(--line);border-radius:4px;color:var(--gold-bright);transition:all .25s">タイトルへ戻る</button>
    </div>`;
  root.appendChild(veil);
  requestAnimationFrame(() => {
    const inner = veil.querySelector('#end-title-inner') as HTMLElement;
    inner.style.opacity = '1';
  });
  const btn = veil.querySelector('#end-title-return') as HTMLButtonElement;
  btn.addEventListener('mouseenter', () => { btn.style.boxShadow = '0 0 26px rgba(232,201,122,0.4)'; btn.style.borderColor = 'var(--gold)'; });
  btn.addEventListener('mouseleave', () => { btn.style.boxShadow = ''; btn.style.borderColor = ''; });
  await new Promise<void>(resolve => {
    btn.addEventListener('click', () => resolve(), { once: true });
  });
  veil.remove();
  await fx.fade('black', true, 900);
  onFinish();
  await fx.fade('black', false, 1200);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
