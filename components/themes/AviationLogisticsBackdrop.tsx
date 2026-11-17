'use client';

import React, { useEffect, useRef } from 'react';

interface VolumetricCloud {
  x: number;
  yRatio: number;
  scale: number;
  speed: number;
  alpha: number;
  variant: number;
}

interface WindowStrip {
  ry: number;
  rxStart: number;
  rxEnd: number;
  warm: boolean;
  alpha: number;
}

interface Building3D {
  xRatio: number;
  widthRatio: number;
  heightPx: number;
  layer: 'far' | 'mid' | 'near';
  frontColor: string;
  sideColor: string;
  roofType: 'flat' | 'stepped' | 'spire' | 'controlTower' | 'amexHub' | 'slanted';
  hasCurtainGrid: boolean;
  hasStorefront: boolean;
  strips: WindowStrip[];
}

type PedestrianRole = 'courier' | 'executive' | 'shopper';

interface Pedestrian {
  x: number;
  yOffset: number; // posición dentro del ancho de la vereda
  speed: number;
  dir: 1 | -1;
  phase: number;
  strideFreq: number;
  scale: number;
  role: PedestrianRole;
  jacketColor: string;
  pantsColor: string;
  skinColor: string;
  hairColor: string;
}

/**
 * Pre-renderiza un sprite de nube volumétrica suave con iluminación cálida inferior
 * (sin bordes duros ni óvalos marcados).
 */
function createVolumetricCloudSprite(variant: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 440;
  c.height = 150;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const puffs =
    variant === 0
      ? [
          { x: 110, y: 88, r: 54 },
          { x: 175, y: 68, r: 68 },
          { x: 245, y: 74, r: 62 },
          { x: 310, y: 90, r: 48 },
          { x: 210, y: 92, r: 58 },
        ]
      : [
          { x: 120, y: 86, r: 50 },
          { x: 190, y: 72, r: 64 },
          { x: 265, y: 66, r: 66 },
          { x: 325, y: 88, r: 46 },
          { x: 225, y: 92, r: 55 },
        ];

  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x, p.y - 8, p.r * 0.12, p.x, p.y, p.r);
    g.addColorStop(0, 'rgba(203, 213, 225, 0.42)');
    g.addColorStop(0.5, 'rgba(148, 163, 184, 0.22)');
    g.addColorStop(1, 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of puffs) {
    const g = ctx.createRadialGradient(p.x, p.y + 16, p.r * 0.1, p.x, p.y + 12, p.r * 0.85);
    g.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    g.addColorStop(0.55, 'rgba(234, 88, 12, 0.08)');
    g.addColorStop(1, 'rgba(234, 88, 12, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 10, p.r * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

/**
 * Construye un skyline continuo en 3 capas (sin huecos en el centro)
 * incluyendo Torre de Control Aeroportuaria, Terminales AMEX y vitrinas comerciales.
 */
function buildRealisticCityscape(): Building3D[] {
  const list: Building3D[] = [];

  const farSpecs: Array<{
    x: number;
    w: number;
    h: number;
    roof: Building3D['roofType'];
    grid?: boolean;
  }> = [
    { x: -0.01, w: 0.065, h: 220, roof: 'stepped', grid: true },
    { x: 0.05, w: 0.058, h: 265, roof: 'spire', grid: true },
    { x: 0.102, w: 0.068, h: 195, roof: 'flat' },
    { x: 0.165, w: 0.062, h: 245, roof: 'slanted', grid: true },
    { x: 0.222, w: 0.055, h: 210, roof: 'controlTower' },
    { x: 0.275, w: 0.072, h: 185, roof: 'flat', grid: true },
    { x: 0.342, w: 0.068, h: 225, roof: 'stepped' },
    { x: 0.405, w: 0.075, h: 190, roof: 'flat' },
    { x: 0.475, w: 0.068, h: 215, roof: 'spire', grid: true },
    { x: 0.538, w: 0.072, h: 180, roof: 'flat' },
    { x: 0.605, w: 0.065, h: 230, roof: 'stepped', grid: true },
    { x: 0.665, w: 0.064, h: 200, roof: 'flat' },
    { x: 0.724, w: 0.062, h: 255, roof: 'spire', grid: true },
    { x: 0.782, w: 0.068, h: 195, roof: 'flat' },
    { x: 0.845, w: 0.062, h: 270, roof: 'stepped', grid: true },
    { x: 0.902, w: 0.058, h: 215, roof: 'slanted' },
    { x: 0.955, w: 0.06, h: 240, roof: 'stepped', grid: true },
  ];

  farSpecs.forEach((s, idx) => {
    const stripCount = Math.floor(s.h / 15);
    const strips: WindowStrip[] = [];
    for (let r = 1; r < stripCount; r++) {
      const seed = (idx * 31 + r * 17) % 10;
      if (seed < 7) {
        strips.push({
          ry: r / stripCount,
          rxStart: 0.12 + ((seed * 3) % 20) / 100,
          rxEnd: 0.88 - ((seed * 7) % 20) / 100,
          warm: seed % 2 === 0,
          alpha: 0.22 + (seed % 4) * 0.06,
        });
      }
    }
    list.push({
      xRatio: s.x,
      widthRatio: s.w,
      heightPx: s.h,
      layer: 'far',
      frontColor: '#13233b',
      sideColor: '#0c1729',
      roofType: s.roof,
      hasCurtainGrid: Boolean(s.grid),
      hasStorefront: false,
      strips,
    });
  });

  const midSpecs: Array<{
    x: number;
    w: number;
    h: number;
    roof: Building3D['roofType'];
    grid?: boolean;
  }> = [
    { x: 0.015, w: 0.072, h: 165, roof: 'flat', grid: true },
    { x: 0.082, w: 0.068, h: 185, roof: 'stepped' },
    { x: 0.145, w: 0.075, h: 150, roof: 'flat', grid: true },
    { x: 0.215, w: 0.065, h: 172, roof: 'slanted' },
    { x: 0.275, w: 0.08, h: 142, roof: 'flat' },
    { x: 0.35, w: 0.075, h: 160, roof: 'stepped', grid: true },
    { x: 0.42, w: 0.085, h: 138, roof: 'flat' },
    { x: 0.5, w: 0.08, h: 155, roof: 'stepped' },
    { x: 0.575, w: 0.075, h: 145, roof: 'flat', grid: true },
    { x: 0.645, w: 0.072, h: 175, roof: 'slanted' },
    { x: 0.712, w: 0.078, h: 152, roof: 'flat', grid: true },
    { x: 0.785, w: 0.07, h: 182, roof: 'stepped' },
    { x: 0.85, w: 0.075, h: 160, roof: 'flat', grid: true },
    { x: 0.92, w: 0.085, h: 170, roof: 'stepped' },
  ];

  midSpecs.forEach((s, idx) => {
    const stripCount = Math.floor(s.h / 16);
    const strips: WindowStrip[] = [];
    for (let r = 1; r < stripCount; r++) {
      const seed = (idx * 23 + r * 13) % 10;
      if (seed < 7) {
        strips.push({
          ry: r / stripCount,
          rxStart: 0.1 + ((seed * 5) % 18) / 100,
          rxEnd: 0.9 - ((seed * 3) % 18) / 100,
          warm: seed % 3 !== 0,
          alpha: 0.35 + (seed % 4) * 0.08,
        });
      }
    }
    list.push({
      xRatio: s.x,
      widthRatio: s.w,
      heightPx: s.h,
      layer: 'mid',
      frontColor: '#0e1b2e',
      sideColor: '#08111f',
      roofType: s.roof,
      hasCurtainGrid: Boolean(s.grid),
      hasStorefront: false,
      strips,
    });
  });

  const nearSpecs: Array<{
    x: number;
    w: number;
    h: number;
    roof: Building3D['roofType'];
    storefront?: boolean;
  }> = [
    { x: 0.0, w: 0.085, h: 112, roof: 'flat', storefront: true },
    { x: 0.078, w: 0.115, h: 96, roof: 'amexHub' },
    { x: 0.188, w: 0.075, h: 122, roof: 'stepped', storefront: true },
    { x: 0.258, w: 0.082, h: 104, roof: 'flat', storefront: true },
    { x: 0.335, w: 0.09, h: 92, roof: 'flat' },
    { x: 0.42, w: 0.095, h: 88, roof: 'amexHub' },
    { x: 0.51, w: 0.085, h: 98, roof: 'flat', storefront: true },
    { x: 0.59, w: 0.08, h: 115, roof: 'stepped' },
    { x: 0.665, w: 0.085, h: 102, roof: 'flat', storefront: true },
    { x: 0.745, w: 0.11, h: 94, roof: 'amexHub' },
    { x: 0.85, w: 0.078, h: 124, roof: 'stepped', storefront: true },
    { x: 0.922, w: 0.085, h: 108, roof: 'flat', storefront: true },
  ];

  nearSpecs.forEach((s, idx) => {
    const stripCount = Math.floor(s.h / 18);
    const strips: WindowStrip[] = [];
    for (let r = 1; r < stripCount; r++) {
      const seed = (idx * 19 + r * 11) % 10;
      if (seed < 8) {
        strips.push({
          ry: r / stripCount,
          rxStart: 0.12,
          rxEnd: 0.88,
          warm: seed % 2 === 0,
          alpha: 0.5 + (seed % 3) * 0.1,
        });
      }
    }
    list.push({
      xRatio: s.x,
      widthRatio: s.w,
      heightPx: s.h,
      layer: 'near',
      frontColor: '#091322',
      sideColor: '#050b14',
      roofType: s.roof,
      hasCurtainGrid: false,
      hasStorefront: Boolean(s.storefront),
      strips,
    });
  });

  return list;
}

function createPedestrians(width: number, isMobile: boolean): Pedestrian[] {
  const count = isMobile ? 4 : 8;
  const roles: PedestrianRole[] = [
    'courier',
    'shopper',
    'executive',
    'courier',
    'shopper',
    'executive',
    'courier',
    'shopper',
  ];
  const jacketPalette = [
    '#0f172a',
    '#0284c7',
    '#334155',
    '#0f172a',
    '#dc2626',
    '#1e293b',
    '#0f172a',
    '#0d9488',
  ];
  const pantsPalette = ['#1e293b', '#0f172a', '#334155', '#1e3a8a'];
  const skinPalette = ['#fed7aa', '#fdba74', '#f5d0fe', '#fde68a'];
  const hairPalette = ['#0f172a', '#451a03', '#1c1917', '#78350f'];

  return Array.from({ length: count }, (_, i) => {
    const role = roles[i % roles.length];
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    return {
      x: ((i + 0.4) / count) * width,
      yOffset: (i % 3) * 3.5, // escalonado sutil en la vereda para dar profundidad
      speed: 22 + (i % 4) * 4.5,
      dir,
      phase: i * 1.35,
      strideFreq: 4.8 + (i % 3) * 0.6,
      scale: isMobile ? 0.82 : 0.96 + (i % 3) * 0.04,
      role,
      jacketColor: jacketPalette[i % jacketPalette.length],
      pantsColor: pantsPalette[i % pantsPalette.length],
      skinColor: skinPalette[i % skinPalette.length],
      hairColor: hairPalette[i % hairPalette.length],
    };
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Dibuja un edificio en 3D con fachada frontal, pared lateral extruida,
 * líneas de muro cortina, vitrinas comerciales en planta baja y detalles de azotea.
 */
function drawBuilding3D(
  ctx: CanvasRenderingContext2D,
  b: Building3D,
  width: number,
  sidewalkTopY: number,
  scale: number,
  parallaxOffset: number,
  timeSec: number
) {
  const bx = b.xRatio * width + parallaxOffset;
  const bw = b.widthRatio * width;
  const bh = b.heightPx * scale;
  const by = sidewalkTopY - bh;
  const sideW = Math.max(8, bw * 0.16);

  ctx.save();

  // 1. Pared lateral 3D
  ctx.fillStyle = b.sideColor;
  ctx.beginPath();
  ctx.moveTo(bx + bw, by);
  ctx.lineTo(bx + bw + sideW, by + 6);
  ctx.lineTo(bx + bw + sideW, sidewalkTopY);
  ctx.lineTo(bx + bw, sidewalkTopY);
  ctx.closePath();
  ctx.fill();

  // 2. Fachada frontal
  const frontGrad = ctx.createLinearGradient(bx, by, bx, sidewalkTopY);
  frontGrad.addColorStop(0, b.frontColor);
  frontGrad.addColorStop(1, b.sideColor);
  ctx.fillStyle = frontGrad;
  ctx.fillRect(bx, by, bw, bh);

  ctx.strokeStyle =
    b.layer === 'near' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  // 3. Muro cortina vertical
  if (b.hasCurtainGrid) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    const cols = 5;
    for (let c = 1; c < cols; c++) {
      const lx = bx + (bw * c) / cols;
      ctx.beginPath();
      ctx.moveTo(lx, by);
      ctx.lineTo(lx, sidewalkTopY);
      ctx.stroke();
    }
  }

  // 4. Detalles de azotea (Torre de Control ATC, Aguja, Terminal AMEX)
  if (b.roofType === 'controlTower') {
    const cx = bx + bw * 0.5;
    ctx.fillStyle = '#0f1d33';
    ctx.fillRect(cx - bw * 0.22, by - 32 * scale, bw * 0.44, 32 * scale);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.36, by - 46 * scale);
    ctx.lineTo(cx + bw * 0.36, by - 46 * scale);
    ctx.lineTo(cx + bw * 0.26, by - 32 * scale);
    ctx.lineTo(cx - bw * 0.26, by - 32 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#091220';
    ctx.fillRect(cx - bw * 0.4, by - 50 * scale, bw * 0.8, 4 * scale);
    const radarWidth = Math.max(4, Math.abs(Math.cos(timeSec * 2.4)) * 18 * scale);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, by - 50 * scale);
    ctx.lineTo(cx, by - 58 * scale);
    ctx.moveTo(cx - radarWidth * 0.5, by - 58 * scale);
    ctx.lineTo(cx + radarWidth * 0.5, by - 58 * scale);
    ctx.stroke();
  } else if (b.roofType === 'spire') {
    const cx = bx + bw * 0.5;
    ctx.fillStyle = b.frontColor;
    ctx.fillRect(bx + bw * 0.22, by - 14 * scale, bw * 0.56, 14 * scale);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, by - 14 * scale);
    ctx.lineTo(cx, by - 38 * scale);
    ctx.stroke();
    const blink = 0.35 + 0.65 * Math.abs(Math.sin(timeSec * 2.8 + bx * 0.01));
    ctx.fillStyle = `rgba(239, 68, 68, ${(blink * 0.28).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx, by - 38 * scale, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(239, 68, 68, ${blink.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(cx, by - 38 * scale, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.roofType === 'stepped') {
    ctx.fillStyle = b.frontColor;
    ctx.fillRect(bx + bw * 0.16, by - 12 * scale, bw * 0.68, 12 * scale);
    ctx.fillStyle = b.sideColor;
    ctx.fillRect(bx + bw * 0.84, by - 10 * scale, sideW * 0.6, 10 * scale);
  } else if (b.roofType === 'amexHub') {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(bx, by + 5, bw, 3.5);
    const bayCount = 3;
    const bayW = (bw * 0.72) / bayCount;
    for (let i = 0; i < bayCount; i++) {
      const bayX = bx + bw * 0.1 + i * (bayW + bw * 0.05);
      const bayH = 18 * scale;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.48)';
      ctx.fillRect(bayX, sidewalkTopY - bayH, bayW, bayH);
      ctx.strokeRect(bayX, sidewalkTopY - bayH, bayW, bayH);
    }
  }

  // 5. Vitrinas comerciales iluminadas en planta baja (dan luz cálida sobre la vereda)
  if (b.hasStorefront && b.layer === 'near') {
    const sfH = 14 * scale;
    const sfY = sidewalkTopY - sfH;
    const sfW = bw * 0.76;
    const sfX = bx + bw * 0.12;

    // Toldo superior de tienda
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(sfX - 2, sfY - 3, sfW + 4, 3);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(sfX - 2, sfY - 1, sfW + 4, 1);

    // Cristal iluminado de la vitrina
    const storeGrad = ctx.createLinearGradient(sfX, sfY, sfX, sidewalkTopY);
    storeGrad.addColorStop(0, 'rgba(254, 240, 138, 0.42)');
    storeGrad.addColorStop(1, 'rgba(245, 158, 11, 0.24)');
    ctx.fillStyle = storeGrad;
    ctx.fillRect(sfX, sfY, sfW, sfH);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sfX, sfY, sfW, sfH);
  }

  // 6. Franjas de iluminación de oficinas (sin asignar cientos de CanvasGradient por frame)
  const stripH = Math.max(2.2, 3.2 * scale);
  for (const s of b.strips) {
    const sy = by + s.ry * bh;
    if (sy + stripH > sidewalkTopY - 22) continue;
    const sx = bx + s.rxStart * bw;
    const sw = Math.max(6, (s.rxEnd - s.rxStart) * bw);

    ctx.fillStyle = s.warm
      ? `rgba(251, 207, 74, ${(s.alpha * 0.85).toFixed(2)})`
      : `rgba(103, 198, 245, ${(s.alpha * 0.7).toFixed(2)})`;
    ctx.fillRect(sx, sy, sw, stripH);

    ctx.fillStyle = b.frontColor;
    const segs = 4;
    for (let k = 1; k < segs; k++) {
      ctx.fillRect(sx + (sw * k) / segs, sy, 1.5, stripH);
    }
  }

  ctx.restore();
}

/**
 * Dibuja una banca urbana y papelera sobre la vereda peatonal.
 */
function drawStreetBench(
  ctx: CanvasRenderingContext2D,
  x: number,
  sidewalkY: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, sidewalkY);
  ctx.scale(scale, scale);

  // Sombra de la banca
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-13, -1, 26, 3);

  // Respaldo y asiento de madera cálida
  ctx.fillStyle = '#92400e';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 0.8;
  ctx.fillRect(-12, -9, 24, 3.5);
  ctx.strokeRect(-12, -9, 24, 3.5);
  ctx.fillRect(-13, -5, 26, 2.5);

  // Patas metálicas
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-10, -9, 2, 9);
  ctx.fillRect(8, -9, 2, 9);

  ctx.restore();
}

/**
 * Dibuja una persona articulada caminando por la vereda peatonal:
 * - 'courier': Repartidor de AMEX con gorra dorada, chaleco y llevando un paquete con cinta AMEX.
 * - 'executive': Ejecutivo/cliente con traje y maletín.
 * - 'shopper': Cliente caminando con bolsas de compras de colores.
 */
function drawWalkingPedestrian(
  ctx: CanvasRenderingContext2D,
  p: Pedestrian,
  footY: number,
  timeSec: number
) {
  ctx.save();
  const cycle = timeSec * p.strideFreq + p.phase;
  const stride = Math.sin(cycle);
  const bob = Math.abs(Math.cos(cycle)) * 1.1;

  ctx.translate(p.x, footY - bob);
  ctx.scale(p.scale * p.dir, p.scale);

  // Sombra elíptica sobre las baldosas de la vereda
  ctx.fillStyle = 'rgba(2, 6, 23, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, bob + 1, 6.5, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Pierna trasera (en movimiento opuesto)
  const backLegAngle = -stride * 0.48;
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(backLegAngle);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 9.5);
  ctx.stroke();
  // Zapato trasero
  ctx.fillStyle = '#020617';
  ctx.fillRect(-0.5, 8.8, 3.2, 1.8);
  ctx.restore();

  // 2. Brazo trasero (si no lleva paquete con ambas manos)
  if (p.role !== 'courier') {
    ctx.save();
    ctx.translate(0, -17.5);
    ctx.rotate(stride * 0.42);
    ctx.strokeStyle = p.jacketColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7.2);
    ctx.stroke();

    // Si es shopper, dibuja una bolsa de compras en la mano trasera
    if (p.role === 'shopper') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(-2.5, 7, 5.5, 6.5);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(0.2, 7, 1.6, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Pierna delantera
  const frontLegAngle = stride * 0.48;
  ctx.save();
  ctx.translate(0, -10);
  ctx.rotate(frontLegAngle);
  ctx.strokeStyle = p.pantsColor;
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 9.5);
  ctx.stroke();
  // Zapato delantero
  ctx.fillStyle = p.role === 'courier' ? '#f59e0b' : '#cbd5e1';
  ctx.fillRect(-0.5, 8.8, 3.4, 1.8);
  ctx.restore();

  // 4. Torso / Chaqueta
  ctx.fillStyle = p.jacketColor;
  drawRoundedRect(ctx, -3.2, -19.5, 6.4, 10.2, 2.2);
  ctx.fill();

  // Si es repartidor AMEX, lleva franja reflectiva dorada en el uniforme
  if (p.role === 'courier') {
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-3.2, -15, 6.4, 2);
    ctx.fillRect(-1.2, -19.2, 2.4, 4.2);
  } else if (p.role === 'executive') {
    // Corbata / camisa clara ejecutiva
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0.8, -19, 1.8, 5);
  }

  // 5. Cabeza y cabello / gorra AMEX
  ctx.fillStyle = p.skinColor;
  ctx.beginPath();
  ctx.arc(0.3, -23.2, 3.1, 0, Math.PI * 2);
  ctx.fill();

  if (p.role === 'courier') {
    // Gorra corporativa AMEX azul marino con visera dorada
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0.2, -23.8, 3.3, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0.2, -24.2, 5.2, 1.4);
  } else {
    // Cabello
    ctx.fillStyle = p.hairColor;
    ctx.beginPath();
    ctx.arc(0, -24, 3.2, Math.PI * 0.9, Math.PI * 2.05);
    ctx.fill();
  }

  // 6. Brazo delantero y accesorios (Caja de paquete AMEX, Maletín o Bolsa)
  if (p.role === 'courier') {
    // Caja de paquete AMEX sostenida al frente con cinta dorada
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 0.8;
    drawRoundedRect(ctx, 2.2, -17.5, 7.5, 6.2, 1);
    ctx.fill();
    ctx.stroke();

    // Cinta de embalaje y etiqueta blanca en la caja
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(4.8, -17.5, 2, 6.2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3.2, -15.5, 3, 2);

    // Brazo sujetando el paquete
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(0, -17.2);
    ctx.lineTo(2.5, -13.5);
    ctx.lineTo(6.2, -13.5);
    ctx.stroke();
  } else {
    ctx.save();
    ctx.translate(0, -17.5);
    ctx.rotate(-stride * 0.42);
    ctx.strokeStyle = p.jacketColor;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 7.2);
    ctx.stroke();

    if (p.role === 'executive') {
      // Maletín ejecutivo en la mano
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.8;
      drawRoundedRect(ctx, -3.5, 7.2, 7, 5, 1);
      ctx.fill();
      ctx.stroke();
    } else if (p.role === 'shopper') {
      // Bolsa de compras dorada
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-2.6, 7.2, 5.2, 6.2);
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Dibuja palmeras / árboles urbanos estilizados a lo largo de la avenida.
 */
function drawStreetPalmTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  scale: number,
  timeSec: number,
  seed: number
) {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);

  const sway = Math.sin(timeSec * 1.4 + seed) * 2.2;

  ctx.strokeStyle = '#070d18';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(3 + sway * 0.4, -22, 5 + sway, -44);
  ctx.stroke();

  const topX = 5 + sway;
  const topY = -44;
  const fronds = [
    { dx: -18, dy: -6, cx: -10, cy: -14 },
    { dx: -15, dy: 4, cx: -8, cy: -6 },
    { dx: -6, dy: -14, cx: -3, cy: -12 },
    { dx: 18, dy: -5, cx: 10, cy: -13 },
    { dx: 16, dy: 5, cx: 9, cy: -5 },
    { dx: 7, dy: -13, cx: 4, cy: -11 },
  ];

  ctx.strokeStyle = '#0b1526';
  ctx.lineWidth = 2.2;
  for (const f of fronds) {
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + f.cx, topY + f.cy, topX + f.dx, topY + f.dy);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Dibuja el pórtico vial de autopista (Highway Gantry Sign).
 */
function drawHighwayGantrySign(
  ctx: CanvasRenderingContext2D,
  x: number,
  roadTopY: number,
  scale: number
) {
  ctx.save();
  ctx.translate(x, roadTopY);
  ctx.scale(scale, scale);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-68, 4);
  ctx.lineTo(-68, -88);
  ctx.moveTo(68, 4);
  ctx.lineTo(68, -88);
  ctx.stroke();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(-72, -86, 144, 8);

  ctx.fillStyle = '#062e22';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
  ctx.lineWidth = 1.4;
  drawRoundedRect(ctx, -56, -90, 112, 26, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
  ctx.fillRect(-36, -92, 14, 2);
  ctx.fillRect(22, -92, 14, 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 7.5px Inter, system-ui, sans-serif';
  ctx.fillText('HUB LOGÍSTICO AMEX', 0, -79);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 6.8px Inter, system-ui, sans-serif';
  ctx.fillText('✈ AEROPUERTO  •  LIMA / MIAMI', 0, -69);

  ctx.restore();
}

/**
 * Dibuja el avión carguero comercial 3D de AMEX Courier.
 */
function drawAmexCargoPlane3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  timeSec: number,
  logoImg: HTMLImageElement | null
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(-0.055);

  for (let i = 1; i <= 14; i++) {
    const px = -42 - i * 19;
    const py = 11 + Math.sin(timeSec * 3 + i * 0.5) * 1.8;
    const pr = 5 + i * 1.45;
    const alpha = Math.max(0, (1 - i / 14) * 0.22);
    const g = ctx.createRadialGradient(px, py, 1, px, py, pr);
    g.addColorStop(0, `rgba(241, 245, 249, ${alpha.toFixed(3)})`);
    g.addColorStop(0.6, `rgba(251, 191, 36, ${(alpha * 0.45).toFixed(3)})`);
    g.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const landingBeam = ctx.createLinearGradient(96, 4, 245, 26);
  landingBeam.addColorStop(0, 'rgba(254, 249, 195, 0.55)');
  landingBeam.addColorStop(0.45, 'rgba(56, 189, 248, 0.15)');
  landingBeam.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = landingBeam;
  ctx.beginPath();
  ctx.moveTo(95, 2);
  ctx.lineTo(245, 8);
  ctx.lineTo(245, 34);
  ctx.lineTo(92, 8);
  ctx.closePath();
  ctx.fill();

  const tailGrad = ctx.createLinearGradient(-115, -52, -65, -4);
  tailGrad.addColorStop(0, '#172554');
  tailGrad.addColorStop(0.6, '#0a1222');
  tailGrad.addColorStop(1, '#060b16');
  ctx.fillStyle = tailGrad;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-92, -4);
  ctx.lineTo(-120, -52);
  ctx.lineTo(-98, -52);
  ctx.lineTo(-62, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const stripeGrad = ctx.createLinearGradient(-116, -42, -80, -18);
  stripeGrad.addColorStop(0, '#fde047');
  stripeGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = stripeGrad;
  ctx.beginPath();
  ctx.moveTo(-114, -40);
  ctx.lineTo(-96, -40);
  ctx.lineTo(-82, -20);
  ctx.lineTo(-103, -20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-88, 2);
  ctx.lineTo(-112, 8);
  ctx.lineTo(-102, 10);
  ctx.lineTo(-76, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(-34, -24);
  ctx.lineTo(-22, -24);
  ctx.lineTo(14, -5);
  ctx.closePath();
  ctx.fill();

  const fuselageGrad = ctx.createLinearGradient(0, -16, 0, 14);
  fuselageGrad.addColorStop(0, '#334155');
  fuselageGrad.addColorStop(0.18, '#111d36');
  fuselageGrad.addColorStop(0.65, '#091020');
  fuselageGrad.addColorStop(0.82, '#1e293b');
  fuselageGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = fuselageGrad;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.42)';
  ctx.lineWidth = 1.1;

  ctx.beginPath();
  ctx.moveTo(-100, -6);
  ctx.lineTo(56, -15);
  ctx.quadraticCurveTo(84, -15, 98, -3);
  ctx.quadraticCurveTo(109, 4, 96, 10.5);
  ctx.lineTo(54, 13.5);
  ctx.lineTo(-70, 12.5);
  ctx.quadraticCurveTo(-94, 10.5, -106, 1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 0.9;
  drawRoundedRect(ctx, 36, -11, 20, 13, 2);
  ctx.stroke();

  const cheatGrad = ctx.createLinearGradient(-98, 0, 92, 0);
  cheatGrad.addColorStop(0, '#d97706');
  cheatGrad.addColorStop(0.5, '#fbbf24');
  cheatGrad.addColorStop(1, '#f59e0b');
  ctx.fillStyle = cheatGrad;
  ctx.beginPath();
  ctx.moveTo(-96, 4.5);
  ctx.lineTo(92, 3.2);
  ctx.lineTo(88, 6.8);
  ctx.lineTo(-100, 7.2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(66, -10);
  ctx.lineTo(82, -8.5);
  ctx.lineTo(89, -3);
  ctx.lineTo(68, -3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(253, 224, 71, 0.28)';
  ctx.beginPath();
  ctx.arc(96, 4.5, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(96, 4.5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(logoImg, -52, -12, 86, 14);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'italic 900 12px Inter, system-ui, sans-serif';
    ctx.fillText('AMEX', -42, 0);
  }

  const wingGrad = ctx.createLinearGradient(-20, 6, -48, 26);
  wingGrad.addColorStop(0, '#475569');
  wingGrad.addColorStop(0.5, '#1e293b');
  wingGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = wingGrad;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, 6);
  ctx.lineTo(-34, 25);
  ctx.lineTo(-50, 25);
  ctx.lineTo(-10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(-48, 25);
  ctx.lineTo(-54, 17);
  ctx.lineTo(-47, 17);
  ctx.lineTo(-42, 25);
  ctx.closePath();
  ctx.fill();

  const engGrad = ctx.createLinearGradient(-14, 12, -14, 25);
  engGrad.addColorStop(0, '#334155');
  engGrad.addColorStop(0.5, '#0f172a');
  engGrad.addColorStop(1, '#020617');
  ctx.fillStyle = engGrad;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, -14, 13, 30, 11.5, 4.5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(14.5, 14);
  ctx.lineTo(14.5, 23.5);
  ctx.stroke();

  const jetFlame = ctx.createRadialGradient(-16, 18.8, 1, -16, 18.8, 11);
  jetFlame.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
  jetFlame.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = jetFlame;
  ctx.beginPath();
  ctx.arc(-16, 18.8, 11, 0, Math.PI * 2);
  ctx.fill();

  const strobe = Math.sin(timeSec * 7.5) > 0.3;
  if (strobe) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.arc(-108, -51, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-108, -51, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(239, 68, 68, 0.28)';
  ctx.beginPath();
  ctx.arc(-48, 24, 4.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(-48, 24, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Dibuja una rueda 3D con neumático, disco de freno y rin giratorio.
 */
function drawRotatingWheel3D(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = '#03060c';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 3.8, Math.PI, 0, false);
  ctx.fill();

  const tireGrad = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius);
  tireGrad.addColorStop(0, '#1e293b');
  tireGrad.addColorStop(0.75, '#0f172a');
  tireGrad.addColorStop(1, '#020617');
  ctx.fillStyle = tireGrad;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.rotate(rotation);
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (radius * 0.18), Math.sin(a) * (radius * 0.18));
    ctx.lineTo(Math.cos(a) * (radius * 0.55), Math.sin(a) * (radius * 0.55));
    ctx.stroke();
  }

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Dibuja el Camión Furgón de reparto AMEX Courier en 3D.
 */
function drawAmexDeliveryTruck3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  roadSurfaceY: number,
  scale: number,
  direction: 1 | -1,
  wheelAngle: number,
  timeSec: number,
  logoImg: HTMLImageElement | null
) {
  ctx.save();
  const bounce = Math.sin(timeSec * 15 + (direction === 1 ? 0 : 2)) * 0.65;
  ctx.translate(x, roadSurfaceY + bounce);
  ctx.scale(scale * direction, scale);

  const shadowGrad = ctx.createRadialGradient(92, 0, 12, 92, 0, 118);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(92, 1.5, 112, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const roadReflect = ctx.createRadialGradient(110, 3, 5, 110, 3, 95);
  roadReflect.addColorStop(0, 'rgba(245, 158, 11, 0.18)');
  roadReflect.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = roadReflect;
  ctx.beginPath();
  ctx.ellipse(110, 3, 95, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const tailTrail = ctx.createLinearGradient(-55, -24, 0, -24);
  tailTrail.addColorStop(0, 'rgba(239, 68, 68, 0)');
  tailTrail.addColorStop(1, 'rgba(239, 68, 68, 0.38)');
  ctx.fillStyle = tailTrail;
  ctx.fillRect(-55, -27, 55, 6);

  const outerBeam = ctx.createLinearGradient(186, -22, 355, 6);
  outerBeam.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
  outerBeam.addColorStop(0.45, 'rgba(251, 191, 36, 0.18)');
  outerBeam.addColorStop(1, 'rgba(251, 191, 36, 0)');
  ctx.fillStyle = outerBeam;
  ctx.beginPath();
  ctx.moveTo(185, -26);
  ctx.lineTo(355, -45);
  ctx.lineTo(355, 8);
  ctx.lineTo(185, -16);
  ctx.closePath();
  ctx.fill();

  const coreBeam = ctx.createLinearGradient(186, -22, 275, -10);
  coreBeam.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
  coreBeam.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = coreBeam;
  ctx.beginPath();
  ctx.moveTo(185, -24);
  ctx.lineTo(275, -28);
  ctx.lineTo(275, -8);
  ctx.lineTo(185, -19);
  ctx.closePath();
  ctx.fill();

  const deflGrad = ctx.createLinearGradient(126, -74, 152, -54);
  deflGrad.addColorStop(0, '#fbbf24');
  deflGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = deflGrad;
  ctx.beginPath();
  ctx.moveTo(126, -74);
  ctx.quadraticCurveTo(144, -74, 152, -55);
  ctx.lineTo(126, -55);
  ctx.closePath();
  ctx.fill();

  const cabGrad = ctx.createLinearGradient(126, -56, 186, -12);
  cabGrad.addColorStop(0, '#172554');
  cabGrad.addColorStop(0.5, '#0f172a');
  cabGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = cabGrad;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(126, -55);
  ctx.lineTo(155, -55);
  ctx.lineTo(172, -35);
  ctx.quadraticCurveTo(185, -33, 187, -24);
  ctx.lineTo(187, -12);
  ctx.lineTo(126, -12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const glassGrad = ctx.createLinearGradient(134, -51, 168, -34);
  glassGrad.addColorStop(0, '#38bdf8');
  glassGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.moveTo(134, -50);
  ctx.lineTo(153, -50);
  ctx.lineTo(167, -34);
  ctx.lineTo(134, -34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.beginPath();
  ctx.arc(147, -43, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(142, -39, 9, 5);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(162, -44);
  ctx.lineTo(167, -44);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(166, -47, 3, 7);

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(136, -30, 6, 1.8);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(126, -23, 59, 4.5);

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(184, -22, 3, 6);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
  drawRoundedRect(ctx, 179.5, -29, 10, 11.5, 4);
  ctx.fill();
  ctx.fillStyle = '#fef9c3';
  drawRoundedRect(ctx, 181.5, -27, 6, 7.5, 2);
  ctx.fill();

  ctx.fillStyle = '#475569';
  drawRoundedRect(ctx, 180, -15.5, 8.5, 5.5, 2);
  ctx.fill();

  ctx.fillStyle = '#050914';
  ctx.beginPath();
  ctx.moveTo(-6, -73);
  ctx.lineTo(0, -76);
  ctx.lineTo(0, -12);
  ctx.lineTo(-6, -14);
  ctx.closePath();
  ctx.fill();

  const boxGrad = ctx.createLinearGradient(0, -76, 0, -12);
  boxGrad.addColorStop(0, '#111c33');
  boxGrad.addColorStop(0.2, '#0a1120');
  boxGrad.addColorStop(0.8, '#0c1528');
  boxGrad.addColorStop(1, '#060a14');
  ctx.fillStyle = boxGrad;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.6;
  drawRoundedRect(ctx, 0, -76, 128, 64, 4);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let p = 1; p < 5; p++) {
    const px = (128 * p) / 5;
    ctx.beginPath();
    ctx.moveTo(px, -73);
    ctx.lineTo(px, -18);
    ctx.stroke();
  }

  const goldTrim = ctx.createLinearGradient(0, 0, 128, 0);
  goldTrim.addColorStop(0, '#d97706');
  goldTrim.addColorStop(0.5, '#fbbf24');
  goldTrim.addColorStop(1, '#f59e0b');
  ctx.fillStyle = goldTrim;
  ctx.fillRect(2, -75, 124, 3.2);
  ctx.fillRect(2, -18, 124, 4.8);

  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(6, -73, 2, 0, Math.PI * 2);
  ctx.arc(64, -73, 1.8, 0, Math.PI * 2);
  ctx.arc(122, -73, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(239, 68, 68, 0.32)';
  ctx.fillRect(-4, -29, 7.5, 13);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(-2, -27, 3.5, 9);

  ctx.save();
  if (direction === -1) {
    ctx.translate(128, 0);
    ctx.scale(-1, 1);
  }
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.drawImage(logoImg, 12, -62, 104, 34);
  } else {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'italic 900 18px Inter, system-ui, sans-serif';
    ctx.fillText('AMEX', 24, -42);
    ctx.font = '700 8px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText('C O U R I E R', 32, -31);
  }
  ctx.restore();

  drawRotatingWheel3D(ctx, 32, -11, 12.8, wheelAngle);
  drawRotatingWheel3D(ctx, 155, -11, 12.8, wheelAngle);

  ctx.restore();
}

export function AviationLogisticsBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const cloudSprites = [createVolumetricCloudSprite(0), createVolumetricCloudSprite(1)];
    const logoImg = new Image();
    logoImg.src = '/images/logo-amex-clean.png';

    const buildings = buildRealisticCityscape();
    let pedestrians = createPedestrians(width, width < 768);

    // Pre-renderizado de cielo y asfalto estáticos en canvas offscreen para no recalcular gradientes cada frame
    const staticSkyCanvas = document.createElement('canvas');
    const buildStaticSky = (w: number, h: number) => {
      const mobile = w < 768;
      const rH = mobile ? 74 : 92;
      const sH = mobile ? 16 : 22;
      const sTopY = h - rH - sH;
      staticSkyCanvas.width = Math.max(1, Math.floor(w));
      staticSkyCanvas.height = Math.max(1, Math.floor(sTopY));
      const sCtx = staticSkyCanvas.getContext('2d');
      if (!sCtx) return;

      const skyGrad = sCtx.createLinearGradient(0, 0, 0, sTopY);
      skyGrad.addColorStop(0, '#091528');
      skyGrad.addColorStop(0.38, '#132747');
      skyGrad.addColorStop(0.7, '#213c63');
      skyGrad.addColorStop(0.88, '#3b3f5c');
      skyGrad.addColorStop(1, '#784e36');
      sCtx.fillStyle = skyGrad;
      sCtx.fillRect(0, 0, w, sTopY);

      const horizonGlow = sCtx.createRadialGradient(
        w * 0.5,
        sTopY - 20,
        20,
        w * 0.5,
        sTopY,
        Math.max(w * 0.72, 480)
      );
      horizonGlow.addColorStop(0, 'rgba(251, 191, 36, 0.32)');
      horizonGlow.addColorStop(0.42, 'rgba(234, 88, 12, 0.14)');
      horizonGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      sCtx.fillStyle = horizonGlow;
      sCtx.fillRect(0, 0, w, sTopY);
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStaticSky(width, height);
      pedestrians = createPedestrians(width, width < 768);
    };
    resize();

    const clouds: VolumetricCloud[] = [
      { x: width * 0.08, yRatio: 0.06, scale: 0.95, speed: 10, alpha: 0.85, variant: 0 },
      { x: width * 0.42, yRatio: 0.11, scale: 1.15, speed: 7.5, alpha: 0.75, variant: 1 },
      { x: width * 0.76, yRatio: 0.07, scale: 0.9, speed: 12, alpha: 0.8, variant: 0 },
    ];

    let planeX = width * 0.12;
    const planeSpeed = 65;

    let nearTruckX = width * 0.18;
    const nearTruckSpeed = 92;

    let farTruckX = width * 0.78;
    const farTruckSpeed = 68;

    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / Math.max(1, width) - 0.5) * 2;
      const ny = (e.clientY / Math.max(1, height) - 0.5) * 2;
      targetMouseX = nx * 16;
      targetMouseY = ny * 7;
    };

    let rafId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderFrame = (now: number) => {
      if (isDisposed) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const timeSec = now / 1000;
      const isMobile = width < 768;

      currentParallaxX += (targetMouseX - currentParallaxX) * Math.min(1, dt * 4.5);
      currentParallaxY += (targetMouseY - currentParallaxY) * Math.min(1, dt * 4.5);

      ctx.clearRect(0, 0, width, height);

      const roadHeight = isMobile ? 74 : 92;
      const sidewalkHeight = isMobile ? 16 : 22;
      const roadTopY = height - roadHeight;
      const sidewalkTopY = roadTopY - sidewalkHeight;

      // =========================================================================
      // 1. CIELO DE CREPÚSCULO URBANO (pre-renderizado en canvas offscreen)
      // =========================================================================
      if (staticSkyCanvas.width > 0 && staticSkyCanvas.height > 0) {
        ctx.drawImage(staticSkyCanvas, 0, 0, width, sidewalkTopY);
      }

      // =========================================================================
      // 2. NUBES VOLUMÉTRICAS DIFUMINADAS
      // =========================================================================
      for (const cloud of clouds) {
        if (!prefersReducedMotion) {
          cloud.x += cloud.speed * dt;
          if (cloud.x - 260 > width) {
            cloud.x = -360;
          }
        }
        const sprite = cloudSprites[cloud.variant % cloudSprites.length];
        const cw = sprite.width * cloud.scale * (isMobile ? 0.75 : 1);
        const ch = sprite.height * cloud.scale * (isMobile ? 0.75 : 1);
        const cx = cloud.x - currentParallaxX * 0.25;
        const cy = height * cloud.yRatio - currentParallaxY * 0.2;

        ctx.save();
        ctx.globalAlpha = cloud.alpha;
        ctx.drawImage(sprite, cx - cw * 0.5, cy - ch * 0.5, cw, ch);
        ctx.restore();
      }

      // =========================================================================
      // 3. AVIÓN CARGUERO 3D AMEX PASANDO EN EL CIELO SUPERIOR
      // =========================================================================
      if (!prefersReducedMotion) {
        planeX += planeSpeed * dt;
        if (planeX > width + 240) {
          planeX = -280;
        }
      }
      const planeY =
        (isMobile ? height * 0.08 : height * 0.1) +
        Math.sin(timeSec * 1.3) * 3.5 -
        currentParallaxY * 0.35;
      const planeScale = isMobile ? 0.74 : 1.08;
      drawAmexCargoPlane3D(
        ctx,
        planeX - currentParallaxX * 0.35,
        planeY,
        planeScale,
        timeSec,
        logoImg
      );

      // =========================================================================
      // 4. SKYLINE CONTINUO EN 3 CAPAS CON VOLUMEN 3D + VITRINAS COMERCIALES
      // =========================================================================
      const bScale = isMobile ? 0.68 : 1.0;

      for (const b of buildings) {
        if (b.layer !== 'far') continue;
        drawBuilding3D(ctx, b, width, sidewalkTopY, bScale, -currentParallaxX * 0.45, timeSec);
      }

      const haze1 = ctx.createLinearGradient(0, sidewalkTopY - 140 * bScale, 0, sidewalkTopY);
      haze1.addColorStop(0, 'rgba(245, 158, 11, 0)');
      haze1.addColorStop(1, 'rgba(245, 158, 11, 0.07)');
      ctx.fillStyle = haze1;
      ctx.fillRect(0, sidewalkTopY - 140 * bScale, width, 140 * bScale);

      for (const b of buildings) {
        if (b.layer !== 'mid') continue;
        drawBuilding3D(ctx, b, width, sidewalkTopY, bScale, -currentParallaxX * 0.75, timeSec);
      }

      for (const b of buildings) {
        if (b.layer !== 'near') continue;
        drawBuilding3D(ctx, b, width, sidewalkTopY, bScale, -currentParallaxX * 1.05, timeSec);
      }

      // =========================================================================
      // 5. VEREDA PEATONAL AMPLIA EN PERSPECTIVA CON BALDOSAS, BANCAS Y PERSONAS
      // =========================================================================
      const sidewalkGrad = ctx.createLinearGradient(0, sidewalkTopY, 0, roadTopY);
      sidewalkGrad.addColorStop(0, '#1e293b');
      sidewalkGrad.addColorStop(0.75, '#334155');
      sidewalkGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = sidewalkGrad;
      ctx.fillRect(0, sidewalkTopY, width, sidewalkHeight);

      // Línea horizontal de baldosas a mitad de la vereda
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, sidewalkTopY + sidewalkHeight * 0.52);
      ctx.lineTo(width, sidewalkTopY + sidewalkHeight * 0.52);
      ctx.stroke();

      // Juntas en perspectiva de las baldosas de la vereda
      const tileSpacing = isMobile ? 28 : 36;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
      ctx.lineWidth = 1;
      for (let tx = -tileSpacing; tx < width + tileSpacing; tx += tileSpacing) {
        const sx = tx - ((currentParallaxX * 1.1) % tileSpacing);
        ctx.beginPath();
        ctx.moveTo(sx, sidewalkTopY);
        ctx.lineTo(sx - 10, roadTopY);
        ctx.stroke();
      }

      // Bordillo elevado de concreto y franja amarilla de precaución vial
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, roadTopY - 3.5, width, 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, roadTopY - 1.5, width, 1.5);

      // Palmeras urbanas y bancas a lo largo de la vereda
      const treePositions = [0.04, 0.16, 0.29, 0.64, 0.73, 0.89, 0.96];
      treePositions.forEach((tr, idx) => {
        drawStreetPalmTree(
          ctx,
          tr * width - currentParallaxX * 1.12,
          sidewalkTopY + 3,
          isMobile ? 0.72 : 0.95,
          timeSec,
          idx * 1.7
        );
      });

      const benchPositions = isMobile ? [0.22, 0.78] : [0.11, 0.36, 0.68, 0.92];
      benchPositions.forEach((br) => {
        drawStreetBench(
          ctx,
          br * width - currentParallaxX * 1.12,
          sidewalkTopY + sidewalkHeight * 0.45,
          isMobile ? 0.8 : 1.0
        );
      });

      // Personas caminando por la vereda (Repartidores AMEX con paquetes + Clientes/Ejecutivos)
      for (const ped of pedestrians) {
        if (!prefersReducedMotion) {
          ped.x += ped.speed * ped.dir * dt;
          if (ped.dir === 1 && ped.x > width + 40) {
            ped.x = -40;
          } else if (ped.dir === -1 && ped.x < -40) {
            ped.x = width + 40;
          }
        }
        const footY = sidewalkTopY + sidewalkHeight * 0.48 + ped.yOffset;
        drawWalkingPedestrian(ctx, ped, footY, timeSec);
      }

      // Pórtico vial de autopista y postes de alumbrado público
      if (!isMobile) {
        drawHighwayGantrySign(
          ctx,
          width * 0.82 - currentParallaxX * 1.15,
          roadTopY,
          0.95
        );
      }

      const lampCount = isMobile ? 5 : 8;
      const lampSpacing = width / lampCount;
      for (let i = 0; i <= lampCount; i++) {
        const lx = i * lampSpacing - currentParallaxX * 1.18;
        const lampTopY = sidewalkTopY - (isMobile ? 42 : 56);

        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(lx, roadTopY - 2);
        ctx.lineTo(lx, lampTopY + 8);
        ctx.quadraticCurveTo(lx, lampTopY, lx + 14, lampTopY - 2);
        ctx.stroke();

        ctx.fillStyle = '#fef9c3';
        ctx.fillRect(lx + 10, lampTopY - 3, 6, 2.5);

        const coneGrad = ctx.createRadialGradient(
          lx + 13,
          lampTopY,
          2,
          lx + 13,
          roadTopY,
          isMobile ? 46 : 68
        );
        coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.62)');
        coneGrad.addColorStop(0.35, 'rgba(251, 191, 36, 0.14)');
        coneGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.arc(lx + 13, lampTopY + 14, isMobile ? 46 : 68, 0, Math.PI * 2);
        ctx.fill();
      }

      // =========================================================================
      // 6. AUTOPISTA / AVENIDA DE DOBLE SENTIDO CON PASO DE CEBRA Y 2 FURGONES
      // =========================================================================
      const roadGrad = ctx.createLinearGradient(0, roadTopY, 0, height);
      roadGrad.addColorStop(0, '#0f172a');
      roadGrad.addColorStop(0.42, '#09101f');
      roadGrad.addColorStop(1, '#04070f');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, roadTopY, width, roadHeight);

      // Paso peatonal (cebra) en perspectiva sobre el asfalto
      const crosswalkX = width * 0.24 - currentParallaxX * 1.2;
      ctx.save();
      ctx.fillStyle = 'rgba(226, 232, 240, 0.24)';
      const stripeCount = 6;
      for (let s = 0; s < stripeCount; s++) {
        const sy = roadTopY + 5 + s * ((roadHeight - 10) / stripeCount);
        const perspectiveShift = s * 3.5;
        ctx.beginPath();
        ctx.moveTo(crosswalkX - perspectiveShift, sy);
        ctx.lineTo(crosswalkX + 28 - perspectiveShift, sy);
        ctx.lineTo(crosswalkX + 26 - perspectiveShift, sy + 5.5);
        ctx.lineTo(crosswalkX - 2 - perspectiveShift, sy + 5.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Reflejos especulares de los faroles sobre el asfalto
      for (let i = 0; i <= lampCount; i++) {
        const lx = i * lampSpacing - currentParallaxX * 1.18 + 13;
        const reflGrad = ctx.createRadialGradient(
          lx,
          roadTopY + roadHeight * 0.35,
          2,
          lx,
          roadTopY + roadHeight * 0.35,
          36
        );
        reflGrad.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
        reflGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = reflGrad;
        ctx.beginPath();
        ctx.ellipse(lx, roadTopY + roadHeight * 0.35, 34, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        farTruckX -= farTruckSpeed * dt;
        if (farTruckX < -240) {
          farTruckX = width + 240;
        }
        nearTruckX += nearTruckSpeed * dt;
        if (nearTruckX > width + 260) {
          nearTruckX = -260;
        }
      }

      // Furgón AMEX 2 (Carril del fondo: circulando de derecha a izquierda)
      if (!isMobile) {
        drawAmexDeliveryTruck3D(
          ctx,
          farTruckX,
          roadTopY + roadHeight * 0.44,
          0.66,
          -1,
          -timeSec * 7.2,
          timeSec + 1.8,
          logoImg
        );
      }

      // Baranda metálica divisoria central (Guardrail)
      const dividerY = roadTopY + roadHeight * 0.47;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, dividerY - 4, width, 4.5);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.fillRect(0, dividerY - 3.5, width, 1.2);
      for (let gx = 0; gx < width; gx += 46) {
        const px = gx - ((currentParallaxX * 1.25) % 46);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px, dividerY - 5, 3, 7);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(px + 0.5, dividerY - 3, 2, 2);
      }

      // Línea discontinua amarilla del carril principal
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.62)';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([30, 26]);
      ctx.lineDashOffset = prefersReducedMotion ? 0 : -timeSec * 65;
      ctx.beginPath();
      ctx.moveTo(0, roadTopY + roadHeight * 0.62);
      ctx.lineTo(width, roadTopY + roadHeight * 0.62);
      ctx.stroke();
      ctx.restore();

      // Furgón AMEX 1 (Carril principal en primer plano: circulando de izquierda a derecha)
      drawAmexDeliveryTruck3D(
        ctx,
        nearTruckX,
        roadTopY + roadHeight * 0.88,
        isMobile ? 0.78 : 0.98,
        1,
        timeSec * 9.0,
        timeSec,
        logoImg
      );

      if (!prefersReducedMotion && !isDisposed) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = 0;
      } else if (!rafId && !prefersReducedMotion && !isDisposed) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    // Una sola llamada inicial (renderFrame ya programa el siguiente requestAnimationFrame)
    renderFrame(performance.now());

    return () => {
      isDisposed = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
