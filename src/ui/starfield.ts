/* タイトル/スタッフロール共用の星空キャンバス */
interface Star { x: number; y: number; r: number; phase: number; speed: number; hue: number; }
interface Shoot { x: number; y: number; vx: number; vy: number; life: number; }

export class Starfield {
  private ctx: CanvasRenderingContext2D;
  private stars: Star[] = [];
  private shoot: Shoot | null = null;
  private shootTimer = 2.5;
  private raf = 0;
  private density: number;

  constructor(canvas: HTMLCanvasElement, density = 170) {
    this.ctx = canvas.getContext('2d')!;
    this.density = density;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < density; i++) {
      this.stars.push({
        x: rand(0, 1920), y: rand(0, 700),
        r: rand(0.5, 2.3),
        phase: rand(0, Math.PI * 2),
        speed: rand(0.6, 2.1),
        hue: Math.random() < 0.22 ? 45 : 225,
      });
    }
    this.loop();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const ctx = this.ctx;
    const t = performance.now() * 0.001;
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.stars) {
      const tw = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = s.hue === 45 ? `rgba(255, 240, 200, ${tw})` : `rgba(214, 226, 255, ${tw * 0.92})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    this.shootTimer -= 1 / 60;
    if (!this.shoot && this.shootTimer <= 0) {
      this.shoot = { x: 300 + Math.random() * 1300, y: 60 + Math.random() * 260, vx: -16 - Math.random() * 7, vy: 8 + Math.random() * 5, life: 1 };
      this.shootTimer = 4 + Math.random() * 6;
    }
    if (this.shoot) {
      const s = this.shoot;
      const tx = s.x + s.vx * 11, ty = s.y + s.vy * 11;
      const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${s.life})`);
      g.addColorStop(0.4, `rgba(255, 244, 214, ${s.life * 0.6})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tx, ty); ctx.stroke();
      s.x += s.vx; s.y += s.vy; s.life -= 0.016;
      if (s.life <= 0) this.shoot = null;
    }
    ctx.restore();
  };

  destroy() { cancelAnimationFrame(this.raf); }
}
