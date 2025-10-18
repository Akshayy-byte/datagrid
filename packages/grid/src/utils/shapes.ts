export function drawInnerSquircleRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | { rx?: number; ry?: number },
  corner: 'tl' | 'tr' | 'br' | 'bl' = 'tl',
  intensity: number = 4,
  segments: number = 24,
) {
  const a = Math.max(0, Math.min(typeof radius === 'number' ? radius : (radius?.rx ?? 0), width));
  const b = Math.max(0, Math.min(typeof radius === 'number' ? radius : (radius?.ry ?? 0), height));
  if (a === 0 || b === 0) {
    ctx.rect(x, y, width, height);
    return;
  }
  const n = intensity;
  const cx_tl = x;
  const cy_tl = y;
  const cx_tr = x + width;
  const cy_tr = y;
  const cx_br = x + width;
  const cy_br = y + height;
  const cx_bl = x;
  const cy_bl = y + height;
  switch (corner) {
    case 'tl': {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + a, y + height);
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * (Math.PI / 2);
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const px = cx_tl + a * Math.pow(Math.abs(cosT), 2 / n);
        const py = cy_tl + b * Math.pow(Math.abs(sinT), 2 / n);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x, y);
      break;
    }
    case 'tr': {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + b);
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const t = (Math.PI / 2) * (1 - u);
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const px = cx_tr - a * Math.pow(Math.abs(cosT), 2 / n);
        const py = cy_tr + b * Math.pow(Math.abs(sinT), 2 / n);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x, y);
      break;
    }
    case 'br': {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + width - a, y + height);
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * (Math.PI / 2);
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const px = cx_br - a * Math.pow(Math.abs(cosT), 2 / n);
        const py = cy_br - b * Math.pow(Math.abs(sinT), 2 / n);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + width, y);
      ctx.lineTo(x, y);
      break;
    }
    case 'bl': {
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + a, y + height);
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * (Math.PI / 2);
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const px = cx_bl + a * Math.pow(Math.abs(cosT), 2 / n);
        const py = cy_bl - b * Math.pow(Math.abs(sinT), 2 / n);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x, y);
      break;
    }
  }
}


