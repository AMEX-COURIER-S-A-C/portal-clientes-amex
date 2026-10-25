'use client';

import React, { useEffect, useRef } from 'react';

type SpriteKind = 'skull' | 'pumpkin' | 'bat' | 'ghost' | 'ember';

interface FallingItem {
  kind: SpriteKind;
  x: number;
  y: number;
  size: number;
  depth: number; // 0.42 (lejos) a 1.05 (cerca)
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  angle: number;
  vAngle: number;
  alpha: number;
  ox: number;
  oy: number;
  vx: number;
  vyOffset: number;
}

interface NavigatingWitch {
  x: number;
  y: number;
  baseY: number;
  vx: number;
  dir: 1 | -1;
  scale: number;
  wavePhase: number;
  waveSpeed: number;
  waveAmp: number;
  cooldown: number;
  active: boolean;
}

interface NightCloud {
  x: number;
  y: number;
  vx: number;
  scale: number;
  alpha: number;
}

interface MagicSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  decay: number;
  color: string;
}

/**
 * 1. LUNA DE COSECHA / SANGRE AAA (Pre-renderizada 280x280)
 * Incluye corona atmosférica, gradiente cálido y cráteres lunares detallados.
 */
function createHarvestMoonSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 280;
  c.height = 280;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const cx = 140;
  const cy = 140;

  // Halo atmosférico externo
  const outerGlow = ctx.createRadialGradient(cx, cy, 38, cx, cy, 138);
  outerGlow.addColorStop(0, 'rgba(251, 146, 60, 0.42)');
  outerGlow.addColorStop(0.35, 'rgba(234, 88, 12, 0.18)');
  outerGlow.addColorStop(0.7, 'rgba(168, 85, 247, 0.08)');
  outerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 138, 0, Math.PI * 2);
  ctx.fill();

  // Disco lunar principal
  const moonGrad = ctx.createRadialGradient(cx - 16, cy - 18, 8, cx, cy, 54);
  moonGrad.addColorStop(0, '#fffbeb');
  moonGrad.addColorStop(0.45, '#fde68a');
  moonGrad.addColorStop(0.8, '#fb923c');
  moonGrad.addColorStop(1, '#c2410c');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = moonGrad;
  ctx.fill();
  ctx.clip();

  // Mares y cráteres lunares sutiles
  ctx.fillStyle = 'rgba(154, 52, 18, 0.16)';
  const craters = [
    { x: cx - 18, y: cy - 12, rx: 14, ry: 11, rot: 0.2 },
    { x: cx + 16, y: cy - 18, rx: 10, ry: 8, rot: -0.3 },
    { x: cx + 12, y: cy + 14, rx: 16, ry: 12, rot: 0.4 },
    { x: cx - 14, y: cy + 20, rx: 9, ry: 7, rot: -0.1 },
    { x: cx - 2, y: cy + 2, rx: 8, ry: 8, rot: 0 },
  ];
  for (const cr of craters) {
    ctx.beginPath();
    ctx.ellipse(cr.x, cr.y, cr.rx, cr.ry, cr.rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Anillo de luz perimetral
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();

  return c;
}

/**
 * 2. NUBE NOCTURNA ILUMINADA POR LA LUNA (Pre-renderizada 300x100)
 */
function createNightCloudSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 300;
  c.height = 100;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const grad = ctx.createLinearGradient(0, 20, 0, 85);
  grad.addColorStop(0, 'rgba(251, 146, 60, 0.22)');
  grad.addColorStop(0.3, 'rgba(30, 18, 52, 0.68)');
  grad.addColorStop(1, 'rgba(9, 5, 18, 0.0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(25, 75);
  ctx.quadraticCurveTo(45, 42, 85, 48);
  ctx.quadraticCurveTo(115, 22, 160, 34);
  ctx.quadraticCurveTo(200, 18, 235, 46);
  ctx.quadraticCurveTo(268, 48, 280, 75);
  ctx.closePath();
  ctx.fill();

  return c;
}

/**
 * 3. CALAVERA 3D DETALLADA CON FUEGO MÍSTICO EN LAS CUENCAS (96x96)
 */
function createSkullSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(48, 48);
  ctx.shadowColor = 'rgba(168, 85, 247, 0.5)';
  ctx.shadowBlur = 12;

  // Sombreado volumétrico 3D del cráneo
  const skullGrad = ctx.createRadialGradient(-7, -12, 4, 0, 2, 30);
  skullGrad.addColorStop(0, '#ffffff');
  skullGrad.addColorStop(0.55, '#e2e8f0');
  skullGrad.addColorStop(0.85, '#94a3b8');
  skullGrad.addColorStop(1, '#475569');
  ctx.fillStyle = skullGrad;

  // Silueta anatómica con pómulos y mandíbula
  ctx.beginPath();
  ctx.moveTo(-19, -4);
  ctx.bezierCurveTo(-23, -24, 23, -24, 19, -4);
  // Pómulo derecho
  ctx.quadraticCurveTo(22, 2, 16, 7);
  // Mandíbula derecha
  ctx.lineTo(12, 18);
  ctx.quadraticCurveTo(11, 23, 6, 23);
  ctx.lineTo(-6, 23);
  ctx.quadraticCurveTo(-11, 23, -12, 18);
  // Pómulo izquierdo
  ctx.lineTo(-16, 7);
  ctx.quadraticCurveTo(-22, 2, -19, -4);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  // Grieta sutil en la frente
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(5, -20);
  ctx.lineTo(2, -13);
  ctx.lineTo(6, -10);
  ctx.stroke();

  // Cuencas oculares profundas
  ctx.fillStyle = '#090414';
  ctx.beginPath();
  ctx.ellipse(-7.5, -2, 5.2, 5.8, -0.14, 0, Math.PI * 2);
  ctx.ellipse(7.5, -2, 5.2, 5.8, 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Fuego místico naranja/violeta dentro de los ojos
  const eyeGlowL = ctx.createRadialGradient(-7.5, -2, 0.5, -7.5, -2, 4.5);
  eyeGlowL.addColorStop(0, '#fef08a');
  eyeGlowL.addColorStop(0.5, '#f97316');
  eyeGlowL.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = eyeGlowL;
  ctx.beginPath();
  ctx.arc(-7.5, -2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  const eyeGlowR = ctx.createRadialGradient(7.5, -2, 0.5, 7.5, -2, 4.5);
  eyeGlowR.addColorStop(0, '#fef08a');
  eyeGlowR.addColorStop(0.5, '#f97316');
  eyeGlowR.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = eyeGlowR;
  ctx.beginPath();
  ctx.arc(7.5, -2, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Cavidad nasal piriforme (doble lóbulo)
  ctx.fillStyle = '#090414';
  ctx.beginPath();
  ctx.moveTo(0, 2.5);
  ctx.lineTo(-3.2, 9.5);
  ctx.quadraticCurveTo(0, 8, 3.2, 9.5);
  ctx.closePath();
  ctx.fill();

  // Dientes tallados con separación realista
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-9, 16.5);
  ctx.lineTo(9, 16.5);
  ctx.stroke();

  for (let x = -6; x <= 6; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x, 13.5);
    ctx.lineTo(x, 22);
    ctx.stroke();
  }

  return c;
}

/**
 * 4. CALABAZA JACK-O'-LANTERN TALLADA CON FUEGO INTERNO (96x96)
 */
function createPumpkinSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 96;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(48, 50);
  ctx.shadowColor = 'rgba(249, 115, 22, 0.6)';
  ctx.shadowBlur = 14;

  // Tallo retorcido + zarcillo verde
  ctx.fillStyle = '#14532d';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, -18);
  ctx.quadraticCurveTo(-2, -30, 6, -28);
  ctx.quadraticCurveTo(3, -22, 4, -18);
  ctx.closePath();
  ctx.fill();

  // Gajos laterales y centrales con volumen 3D
  const drawLobe = (cx: number, rx: number, ry: number, dark: boolean) => {
    const g = ctx.createRadialGradient(cx - 2, -6, 2, cx, 0, ry + 4);
    g.addColorStop(0, dark ? '#f97316' : '#fb923c');
    g.addColorStop(0.65, dark ? '#c2410c' : '#ea580c');
    g.addColorStop(1, '#7c2d12');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLobe(-13, 10, 16, true);
  drawLobe(13, 10, 16, true);
  drawLobe(-7, 11, 18, false);
  drawLobe(7, 11, 18, false);
  drawLobe(0, 11, 19, false);

  ctx.shadowBlur = 0;

  // Fuego interno brillante para ojos, nariz y sonrisa dentada
  const fireGrad = ctx.createLinearGradient(0, -10, 0, 14);
  fireGrad.addColorStop(0, '#ffffff');
  fireGrad.addColorStop(0.4, '#fef08a');
  fireGrad.addColorStop(1, '#f97316');
  ctx.fillStyle = fireGrad;

  // Ojos triangulares angulados
  ctx.beginPath();
  ctx.moveTo(-13, -3);
  ctx.lineTo(-7, -11);
  ctx.lineTo(-2.5, -2);
  ctx.closePath();

  ctx.moveTo(2.5, -2);
  ctx.lineTo(7, -11);
  ctx.lineTo(13, -3);
  ctx.closePath();

  // Nariz triangular
  ctx.moveTo(0, -1);
  ctx.lineTo(-2.5, 3.5);
  ctx.lineTo(2.5, 3.5);
  ctx.closePath();
  ctx.fill();

  // Sonrisa dentada clásica de Halloween
  ctx.beginPath();
  ctx.moveTo(-14, 5);
  ctx.lineTo(-9, 8);
  ctx.lineTo(-6, 5.5);
  ctx.lineTo(-2, 9);
  ctx.lineTo(2, 9);
  ctx.lineTo(6, 5.5);
  ctx.lineTo(9, 8);
  ctx.lineTo(14, 5);
  ctx.lineTo(10, 12.5);
  ctx.lineTo(5, 11);
  ctx.lineTo(0, 14);
  ctx.lineTo(-5, 11);
  ctx.lineTo(-10, 12.5);
  ctx.closePath();
  ctx.fill();

  return c;
}

/**
 * 5. FANTASMA ESPECTRAL TRANSLÚCIDO (90x100)
 */
function createGhostSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 90;
  c.height = 100;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(45, 48);
  ctx.shadowColor = 'rgba(192, 132, 252, 0.55)';
  ctx.shadowBlur = 12;

  const gGrad = ctx.createLinearGradient(0, -26, 0, 28);
  gGrad.addColorStop(0, 'rgba(248, 250, 252, 0.9)');
  gGrad.addColorStop(0.6, 'rgba(216, 180, 254, 0.55)');
  gGrad.addColorStop(1, 'rgba(168, 85, 247, 0.05)');
  ctx.fillStyle = gGrad;

  ctx.beginPath();
  ctx.arc(0, -10, 16, Math.PI, 0, false);
  ctx.quadraticCurveTo(18, 8, 20, 24);
  // Pliegues inferiores flotantes
  ctx.quadraticCurveTo(14, 17, 10, 25);
  ctx.quadraticCurveTo(5, 18, 0, 26);
  ctx.quadraticCurveTo(-5, 18, -10, 25);
  ctx.quadraticCurveTo(-14, 17, -20, 24);
  ctx.quadraticCurveTo(-18, 8, -16, -10);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#090414';
  ctx.beginPath();
  ctx.ellipse(-5.5, -10, 2.6, 3.6, 0, 0, Math.PI * 2);
  ctx.ellipse(5.5, -10, 2.6, 3.6, 0, 0, Math.PI * 2);
  ctx.ellipse(0, -3, 2.2, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * 6. MURCIÉLAGO VAMPIRO DETALLADO (96x64)
 */
function createBatSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(48, 32);
  ctx.shadowColor = 'rgba(168, 85, 247, 0.55)';
  ctx.shadowBlur = 8;

  const wingGrad = ctx.createLinearGradient(-36, -10, 36, 12);
  wingGrad.addColorStop(0, '#0f0720');
  wingGrad.addColorStop(0.5, '#1e1b4b');
  wingGrad.addColorStop(1, '#0f0720');
  ctx.fillStyle = wingGrad;
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(-4, -13);
  ctx.lineTo(-6, -5);
  // Ala izquierda con membranas festoneadas
  ctx.bezierCurveTo(-18, -18, -32, -12, -40, -2);
  ctx.quadraticCurveTo(-30, 1, -26, 10);
  ctx.quadraticCurveTo(-17, 3, -12, 11);
  ctx.quadraticCurveTo(-6, 5, 0, 12);
  // Ala derecha
  ctx.quadraticCurveTo(6, 5, 12, 11);
  ctx.quadraticCurveTo(17, 3, 26, 10);
  ctx.quadraticCurveTo(30, 1, 40, -2);
  ctx.bezierCurveTo(32, -12, 18, -18, 6, -5);
  ctx.lineTo(4, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fb923c';
  ctx.beginPath();
  ctx.arc(-2.4, -3.5, 1.3, 0, Math.PI * 2);
  ctx.arc(2.4, -3.5, 1.3, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * 7. BRUJA AAA EN ESCOBA + GATO NEGRO + FAROL ENCENDIDO (220x140)
 */
function createWitchSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 140;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.translate(110, 78);
  ctx.shadowColor = 'rgba(249, 115, 22, 0.45)';
  ctx.shadowBlur = 12;

  // 1. Vara de madera retorcida de la escoba
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-62, 18);
  ctx.quadraticCurveTo(-10, 10, 25, 2);
  ctx.quadraticCurveTo(50, -4, 72, -10);
  ctx.stroke();

  // 2. Cerdas frondosas de la escoba atrás + amarre dorado
  const bristleGrad = ctx.createLinearGradient(-95, 12, -55, 26);
  bristleGrad.addColorStop(0, '#451a03');
  bristleGrad.addColorStop(0.6, '#92400e');
  bristleGrad.addColorStop(1, '#b45309');
  ctx.fillStyle = bristleGrad;
  ctx.beginPath();
  ctx.moveTo(-58, 17);
  ctx.quadraticCurveTo(-78, 6, -96, 12);
  ctx.lineTo(-90, 19);
  ctx.lineTo(-98, 24);
  ctx.lineTo(-88, 28);
  ctx.quadraticCurveTo(-74, 32, -56, 21);
  ctx.closePath();
  ctx.fill();

  // Amarre dorado del cepillo
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-58, 14);
  ctx.lineTo(-56, 23);
  ctx.stroke();

  // 3. Silueta de la Bruja (Capa al viento, vestido, brazos sujetando la escoba y sombrero con hebilla)
  ctx.fillStyle = '#070312';
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
  ctx.lineWidth = 1.2;

  // Capa ondeante
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.bezierCurveTo(-30, -12, -48, 2, -54, 14);
  ctx.quadraticCurveTo(-36, 10, -26, 18);
  ctx.quadraticCurveTo(-12, 12, 4, 16);
  ctx.lineTo(14, 4);
  ctx.lineTo(6, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Torso y brazos inclinados hacia adelante
  ctx.beginPath();
  ctx.moveTo(-4, -16);
  ctx.lineTo(12, -18);
  ctx.lineTo(24, -2);
  ctx.lineTo(18, 0);
  ctx.lineTo(8, -10);
  ctx.lineTo(2, 6);
  ctx.closePath();
  ctx.fill();

  // Sombrero puntiagudo curvado hacia atrás
  ctx.beginPath();
  ctx.moveTo(-18, -22);
  ctx.quadraticCurveTo(4, -24, 24, -26);
  ctx.lineTo(10, -29);
  ctx.bezierCurveTo(4, -48, -8, -56, -24, -54);
  ctx.quadraticCurveTo(-12, -44, -8, -28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cinta púrpura y hebilla dorada en el sombrero
  ctx.fillStyle = '#9333ea';
  ctx.fillRect(-7, -30, 15, 3.5);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 1.3;
  ctx.strokeRect(2, -31, 4.5, 5);

  // 4. Gatito negro sentado en la parte delantera de la escoba
  ctx.fillStyle = '#05020a';
  ctx.beginPath();
  // Cuerpo y lomo arqueado del gato
  ctx.ellipse(42, -5, 7, 9, -0.2, 0, Math.PI * 2);
  // Cabeza del gato
  ctx.arc(47, -14, 5, 0, Math.PI * 2);
  ctx.fill();
  // Orejitas puntiagudas
  ctx.beginPath();
  ctx.moveTo(44, -17);
  ctx.lineTo(45, -23);
  ctx.lineTo(48, -18);
  ctx.moveTo(48, -18);
  ctx.lineTo(51, -22);
  ctx.lineTo(51, -16);
  ctx.fill();
  // Cola curvada del gato
  ctx.strokeStyle = '#05020a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(36, -2);
  ctx.bezierCurveTo(28, -10, 30, -20, 35, -18);
  ctx.stroke();
  // Ojos brillantes del gato
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(49, -14.5, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // 5. Farol mágico colgando de la punta delantera de la escoba
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(71, -10);
  ctx.lineTo(71, 2);
  ctx.stroke();

  const lanternGlow = ctx.createRadialGradient(71, 6, 1, 71, 6, 16);
  lanternGlow.addColorStop(0, '#ffffff');
  lanternGlow.addColorStop(0.35, '#fb923c');
  lanternGlow.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = lanternGlow;
  ctx.beginPath();
  ctx.arc(71, 6, 16, 0, Math.PI * 2);
  ctx.fill();

  return c;
}

/**
 * 8. HORIZONTE NOCTURNO PARALLAX (Bosque encantado, cementerio con lápidas/tumbas, cruces góticas y rejas)
 * Pre-renderizado una sola vez al tamaño de la ventana.
 */
function createHorizonSprite(width: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const w = Math.max(width + 160, 1440);
  const h = 230;
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  // 1. Niebla atmosférica de fondo en el horizonte
  const mistGrad = ctx.createLinearGradient(0, 10, 0, h);
  mistGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
  mistGrad.addColorStop(0.55, 'rgba(88, 28, 135, 0.18)');
  mistGrad.addColorStop(1, 'rgba(5, 2, 12, 0.96)');
  ctx.fillStyle = mistGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Colinas lejanas + Silueta de Castillo / Capilla Gótica
  ctx.fillStyle = '#0b0518';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 140);
  ctx.quadraticCurveTo(w * 0.18, 98, w * 0.36, 146);
  ctx.quadraticCurveTo(w * 0.52, 170, w * 0.68, 134);
  ctx.quadraticCurveTo(w * 0.85, 92, w, 142);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Silueta de capilla/torre gótica lejana en el costado izquierdo (x ~ 14%)
  const tx = w * 0.14;
  ctx.fillStyle = '#090414';
  ctx.beginPath();
  ctx.moveTo(tx - 28, 140);
  ctx.lineTo(tx - 24, 82);
  ctx.lineTo(tx - 30, 82);
  ctx.lineTo(tx - 12, 46);
  ctx.lineTo(tx - 2, 78);
  ctx.lineTo(tx + 8, 56);
  ctx.lineTo(tx + 22, 82);
  ctx.lineTo(tx + 18, 140);
  ctx.closePath();
  ctx.fill();

  // Ventanitas iluminadas cálidas en la capilla lejana
  ctx.fillStyle = 'rgba(251, 146, 60, 0.78)';
  ctx.fillRect(tx - 15, 82, 4, 7);
  ctx.fillRect(tx - 9, 82, 4, 7);
  ctx.fillRect(tx + 5, 90, 3.5, 6);

  // Helper: Lápida Clásica Redondeada con "RIP" y bisel iluminado por la luna
  const drawArchTombstone = (
    x: number,
    y: number,
    scale: number,
    tilt: number,
    withRip = true
  ) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);

    // Sombra/piedra de la lápida
    const stoneGrad = ctx.createLinearGradient(-16, -44, 16, 4);
    stoneGrad.addColorStop(0, '#1e1b2e');
    stoneGrad.addColorStop(0.5, '#110c1d');
    stoneGrad.addColorStop(1, '#07040e');
    ctx.fillStyle = stoneGrad;
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.34)';
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-16, -24);
    ctx.arc(0, -24, 16, Math.PI, 0, false);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Base escalonada de piedra
    ctx.fillStyle = '#090514';
    ctx.fillRect(-20, 0, 40, 6);

    // Grieta sutil en el borde
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, -34);
    ctx.lineTo(5, -27);
    ctx.lineTo(8, -22);
    ctx.stroke();

    if (withRip) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
      ctx.font = '900 8.5px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('R.I.P', 0, -20);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, -14);
      ctx.lineTo(8, -14);
      ctx.moveTo(-6, -10);
      ctx.lineTo(6, -10);
      ctx.stroke();
    }

    ctx.restore();
  };

  // Helper: Cruz Gótica / Celta de Cementerio sobre Pedestal
  const drawCrossTombstone = (x: number, y: number, scale: number, tilt: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#120b20';
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.32)';
    ctx.lineWidth = 1.15;

    // Pedestal
    ctx.fillRect(-13, -8, 26, 10);

    // Cruz vertical y brazos
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(-4, -30);
    ctx.lineTo(-14, -30);
    ctx.lineTo(-14, -37);
    ctx.lineTo(-4, -37);
    ctx.lineTo(-4, -48);
    ctx.lineTo(4, -48);
    ctx.lineTo(4, -37);
    ctx.lineTo(14, -37);
    ctx.lineTo(14, -30);
    ctx.lineTo(4, -30);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Aro celta sutil
    ctx.beginPath();
    ctx.arc(0, -33.5, 7.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  };

  // Helper: Tramo de Reja de Hierro Forjado de Cementerio
  const drawCemeteryFence = (startX: number, baseY: number, posts: number, tilt: number) => {
    ctx.save();
    ctx.translate(startX, baseY);
    ctx.rotate(tilt);
    ctx.strokeStyle = 'rgba(19, 12, 34, 0.95)';
    ctx.fillStyle = '#090414';
    ctx.lineWidth = 1.6;

    const totalW = posts * 10;
    // Travesaños horizontales
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(totalW, -8);
    ctx.moveTo(0, -22);
    ctx.lineTo(totalW, -22);
    ctx.stroke();

    // Barrotes verticales con punta de lanza
    for (let i = 0; i <= posts; i++) {
      const px = i * 10;
      ctx.beginPath();
      ctx.moveTo(px, 2);
      ctx.lineTo(px, -27);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px, -31);
      ctx.lineTo(px - 2.2, -26);
      ctx.lineTo(px + 2.2, -26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  // Helper: Vela / Fuego Fatuo al pie de una lápida
  const drawGraveCandle = (x: number, y: number) => {
    const glow = ctx.createRadialGradient(x, y - 4, 1, x, y - 4, 18);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    glow.addColorStop(0.4, 'rgba(249, 115, 22, 0.45)');
    glow.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 4, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x, y - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
  };

  // 3. Dibujar rejas y lápidas distribuidas en las colinas (izquierda, centro y derecha)
  drawCemeteryFence(w * 0.04, 152, 7, -0.06);
  drawArchTombstone(w * 0.08, 154, 0.95, -0.08, true);
  drawCrossTombstone(w * 0.115, 146, 0.88, 0.06);
  drawGraveCandle(w * 0.092, 154);

  drawArchTombstone(w * 0.21, 132, 0.82, 0.09, true);
  drawCrossTombstone(w * 0.245, 138, 0.78, -0.07);
  drawCemeteryFence(w * 0.26, 142, 6, 0.08);
  drawArchTombstone(w * 0.31, 148, 1.05, -0.05, true);
  drawGraveCandle(w * 0.322, 149);

  // Sector central-bajo
  drawCrossTombstone(w * 0.42, 162, 0.85, 0.05);
  drawArchTombstone(w * 0.46, 166, 0.92, -0.09, true);
  drawArchTombstone(w * 0.56, 162, 0.9, 0.07, true);
  drawGraveCandle(w * 0.548, 163);
  drawCrossTombstone(w * 0.61, 154, 0.84, -0.06);

  // Sector derecho
  drawCemeteryFence(w * 0.69, 140, 7, -0.08);
  drawArchTombstone(w * 0.75, 132, 1.08, 0.06, true);
  drawGraveCandle(w * 0.738, 134);
  drawCrossTombstone(w * 0.79, 126, 0.96, -0.08);
  drawArchTombstone(w * 0.84, 128, 0.86, 0.11, false);
  drawCemeteryFence(w * 0.86, 132, 6, 0.06);
  drawArchTombstone(w * 0.92, 146, 1.0, -0.07, true);

  // 4. Árboles retorcidos de otoño en ambos bordes
  const drawDeadTree = (baseX: number, baseY: number, scale: number, flip: number) => {
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.scale(flip * scale, scale);
    ctx.strokeStyle = '#05020a';
    ctx.lineCap = 'round';

    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-6, -45, 4, -95);
    ctx.stroke();

    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, -55);
    ctx.quadraticCurveTo(-28, -75, -48, -98);
    ctx.moveTo(2, -72);
    ctx.quadraticCurveTo(26, -92, 44, -112);
    ctx.moveTo(3, -88);
    ctx.quadraticCurveTo(-14, -112, -22, -130);
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-28, -78);
    ctx.lineTo(-34, -96);
    ctx.moveTo(24, -90);
    ctx.lineTo(36, -92);
    ctx.stroke();
    ctx.restore();
  };

  drawDeadTree(90, 172, 1.15, 1);
  drawDeadTree(w - 100, 174, 1.2, -1);

  // 5. Niebla baja envolviendo la base de las lápidas
  const groundFog = ctx.createLinearGradient(0, 118, 0, 185);
  groundFog.addColorStop(0, 'rgba(168, 85, 247, 0)');
  groundFog.addColorStop(0.5, 'rgba(147, 51, 234, 0.14)');
  groundFog.addColorStop(1, 'rgba(4, 2, 9, 0.85)');
  ctx.fillStyle = groundFog;
  ctx.fillRect(0, 118, w, 68);

  // 6. Primer plano oscuro en la base con tumbas cercanas en silueta
  ctx.fillStyle = '#040209';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, 168);
  ctx.quadraticCurveTo(w * 0.25, 152, w * 0.5, 172);
  ctx.quadraticCurveTo(w * 0.75, 186, w, 160);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Lápidas en primerísimo plano (silueta oscura con borde violeta/ámbar)
  drawArchTombstone(w * 0.16, 174, 1.12, 0.05, true);
  drawCrossTombstone(w * 0.88, 172, 1.08, -0.06);

  return c;
}

/**
 * Escena Cinematográfica AAA de Halloween acelerada por GPU (60/120 FPS sin lag).
 * Todos los elementos complejos se pre-renderizan una sola vez en texturas en memoria.
 */
export function HalloweenBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Pre-renderizar todas las texturas en memoria (0 recálculo vectorial por frame)
    const moonSprite = createHarvestMoonSprite();
    const cloudSprite = createNightCloudSprite();
    const skullSprite = createSkullSprite();
    const pumpkinSprite = createPumpkinSprite();
    const ghostSprite = createGhostSprite();
    const batSprite = createBatSprite();
    const witchSprite = createWitchSprite();
    let horizonSprite = createHorizonSprite(width);

    const updateSize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      horizonSprite = createHorizonSprite(width);
    };
    updateSize();

    // Nubes nocturnas cruzando frente a la luna
    const clouds: NightCloud[] = [
      { x: width * 0.72, y: height * 0.12, vx: -0.22, scale: 1.05, alpha: 0.75 },
      { x: width * 0.86, y: height * 0.2, vx: 0.16, scale: 0.85, alpha: 0.6 },
      { x: width * 0.18, y: height * 0.15, vx: 0.18, scale: 0.9, alpha: 0.45 },
    ];

    // Partículas en 3 capas de profundidad (calaveras 3D, calabazas, fantasmas, murciélagos y brasas)
    const itemCount = width < 768 ? 20 : 34;
    const kinds: SpriteKind[] = ['skull', 'pumpkin', 'bat', 'ghost', 'pumpkin', 'skull', 'ember'];
    const items: FallingItem[] = Array.from({ length: itemCount }, (_, i) => {
      const depth = 0.45 + (i % 3) * 0.28;
      const kind = kinds[i % kinds.length];
      return {
        kind,
        x: Math.random() * width,
        y: Math.random() * height,
        size: (kind === 'ember' ? 3.5 : kind === 'ghost' ? 44 : 40) * depth,
        depth,
        vy: (0.38 + Math.random() * 0.52) * depth,
        swayAmp: 16 + Math.random() * 24,
        swayFreq: 0.008 + Math.random() * 0.01,
        phase: Math.random() * Math.PI * 2,
        angle: (Math.random() - 0.5) * 0.3,
        vAngle: (Math.random() - 0.5) * 0.005,
        alpha: 0.32 + depth * 0.52,
        ox: 0,
        oy: 0,
        vx: 0,
        vyOffset: 0,
      };
    });

    // Brujas navegando en escoba con gatito y farol
    const witches: NavigatingWitch[] = [
      {
        x: -140,
        y: height * 0.2,
        baseY: height * 0.2,
        vx: 1.55,
        dir: 1,
        scale: 0.82,
        wavePhase: 0,
        waveSpeed: 0.022,
        waveAmp: 20,
        cooldown: 5,
        active: true,
      },
      {
        x: width + 160,
        y: height * 0.62,
        baseY: height * 0.62,
        vx: -1.25,
        dir: -1,
        scale: 0.6,
        wavePhase: 1.8,
        waveSpeed: 0.018,
        waveAmp: 15,
        cooldown: 160,
        active: false,
      },
    ];

    const sparks: MagicSpark[] = [];

    const mouse = {
      x: width * 0.5,
      y: height * 0.5,
      lastX: width * 0.5,
      lastY: height * 0.5,
      targetParallaxX: 0,
      targetParallaxY: 0,
      parallaxX: 0,
      parallaxY: 0,
      active: false,
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.targetParallaxX = (e.clientX / width - 0.5) * 32;
      mouse.targetParallaxY = (e.clientY / height - 0.5) * 20;
      mouse.active = true;

      // Estela mágica sutil al mover el cursor
      const moveDist = Math.hypot(mouse.x - mouse.lastX, mouse.y - mouse.lastY);
      if (moveDist > 14 && sparks.length < 70) {
        mouse.lastX = mouse.x;
        mouse.lastY = mouse.y;
        sparks.push({
          x: mouse.x + (Math.random() - 0.5) * 8,
          y: mouse.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.7,
          vy: -0.4 - Math.random() * 0.7,
          radius: 1.4 + Math.random() * 1.8,
          alpha: 0.75,
          decay: 0.022,
          color: Math.random() > 0.4 ? '#fb923c' : '#c084fc',
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('resize', updateSize, { passive: true });

    let rafId = 0;
    let isHidden = document.visibilityState === 'hidden';

    const handleVisibility = () => {
      isHidden = document.visibilityState === 'hidden';
      if (!isHidden && !rafId) {
        rafId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    let tick = 0;

    const render = () => {
      if (isHidden) {
        rafId = 0;
        return;
      }
      tick += 1;
      ctx.clearRect(0, 0, width, height);

      // Suavizar parallax 3D
      mouse.parallaxX += (mouse.targetParallaxX - mouse.parallaxX) * 0.06;
      mouse.parallaxY += (mouse.targetParallaxY - mouse.parallaxY) * 0.06;

      // 1. Dibujar Luna de Cosecha AAA arriba a la derecha
      const moonX = width * 0.84 - mouse.parallaxX * 0.28;
      const moonY = height * 0.18 - mouse.parallaxY * 0.28;
      ctx.drawImage(moonSprite, moonX - 140, moonY - 140);

      // 2. Nubes nocturnas deslizándose lentamente frente a la luna
      for (const cl of clouds) {
        cl.x += cl.vx;
        if (cl.x > width + 220) cl.x = -220;
        if (cl.x < -220) cl.x = width + 220;

        ctx.save();
        ctx.globalAlpha = cl.alpha;
        ctx.translate(cl.x - mouse.parallaxX * 0.38, cl.y - mouse.parallaxY * 0.38);
        ctx.scale(cl.scale, cl.scale);
        ctx.drawImage(cloudSprite, -150, -50);
        ctx.restore();
      }

      // 3. Horizonte Cinematográfico Parallax en la base de la pantalla
      ctx.save();
      ctx.drawImage(
        horizonSprite,
        -80 - mouse.parallaxX * 0.55,
        height - 210 - mouse.parallaxY * 0.25
      );
      ctx.restore();

      // 4. Actualizar y dibujar Brujas AAA navegando + estela de fuego fatuo
      for (const w of witches) {
        if (!w.active) {
          w.cooldown -= 1;
          if (w.cooldown <= 0) {
            w.active = true;
            w.dir = Math.random() > 0.42 ? 1 : -1;
            w.scale = 0.58 + Math.random() * 0.28;
            w.vx = w.dir * (1.25 + Math.random() * 0.6);
            w.x = w.dir === 1 ? -140 : width + 140;
            w.baseY = height * (0.14 + Math.random() * 0.54);
            w.y = w.baseY;
          }
          continue;
        }

        w.x += w.vx;
        w.wavePhase += w.waveSpeed;
        w.y = w.baseY + Math.sin(w.wavePhase) * w.waveAmp;

        if (tick % 2 === 0 && sparks.length < 70) {
          sparks.push({
            x: w.x - w.dir * 68 * w.scale,
            y: w.y + 18 * w.scale,
            vx: -w.vx * 0.22 + (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.3) * 0.55,
            radius: 1.5 + Math.random() * 2.2,
            alpha: 0.82,
            decay: 0.014 + Math.random() * 0.008,
            color: Math.random() > 0.35 ? '#fb923c' : '#c084fc',
          });
        }

        ctx.save();
        ctx.translate(
          w.x - mouse.parallaxX * 0.48,
          w.y - mouse.parallaxY * 0.48
        );
        const tilt = Math.cos(w.wavePhase) * 0.07 * w.dir;
        ctx.rotate(tilt);
        ctx.scale(w.dir * w.scale, w.scale);
        ctx.globalAlpha = 0.86;
        ctx.drawImage(witchSprite, -110, -78);
        ctx.restore();

        if ((w.dir === 1 && w.x > width + 160) || (w.dir === -1 && w.x < -160)) {
          w.active = false;
          w.cooldown = 140 + Math.floor(Math.random() * 200);
        }
      }

      // 5. Dibujar chispas mágicas (de las brujas y del cursor)
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;
        if (s.alpha <= 0.02) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 6. Dibujar calaveras 3D, calabazas talladas, fantasmas y murciélagos
      for (const item of items) {
        item.y += item.vy;
        item.phase += item.swayFreq;
        item.angle += item.vAngle;

        if (item.y > height + 70) {
          item.y = -60;
          item.x = Math.random() * width;
          item.ox = 0;
          item.oy = 0;
        }

        const swayX = Math.sin(item.phase) * item.swayAmp;
        const drawX = item.x + swayX + item.ox - mouse.parallaxX * item.depth;
        const drawY = item.y + item.oy - mouse.parallaxY * item.depth;

        if (mouse.active) {
          const dx = drawX - mouse.x;
          const dy = drawY - mouse.y;
          const distSq = dx * dx + dy * dy;
          const minDist = 145;
          if (distSq < minDist * minDist && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = ((minDist - dist) / minDist) * 0.9 * item.depth;
            item.vx += (dx / dist) * force;
            item.vyOffset += (dy / dist) * force;
          }
        }

        item.vx *= 0.9;
        item.vyOffset *= 0.9;
        item.ox += item.vx;
        item.oy += item.vyOffset;
        item.ox *= 0.96;
        item.oy *= 0.96;

        ctx.save();
        ctx.globalAlpha = item.alpha;
        ctx.translate(drawX, drawY);

        if (item.kind === 'ember') {
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(0, 0, item.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (item.kind === 'bat') {
          const wingFlap = 0.86 + Math.sin(item.phase * 4.8) * 0.18;
          ctx.rotate(Math.sin(item.phase) * 0.16);
          ctx.scale((item.size / 48) * wingFlap, item.size / 48);
          ctx.drawImage(batSprite, -48, -32);
        } else if (item.kind === 'ghost') {
          ctx.rotate(Math.sin(item.phase * 0.8) * 0.14);
          const s = item.size / 52;
          ctx.scale(s, s);
          ctx.drawImage(ghostSprite, -45, -48);
        } else if (item.kind === 'skull') {
          ctx.rotate(item.angle + Math.sin(item.phase * 0.7) * 0.12);
          const s = item.size / 50;
          ctx.scale(s, s);
          ctx.drawImage(skullSprite, -48, -48);
        } else {
          ctx.rotate(item.angle + Math.cos(item.phase * 0.7) * 0.1);
          const s = item.size / 50;
          ctx.scale(s, s);
          ctx.drawImage(pumpkinSprite, -48, -50);
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', updateSize);
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
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/**
 * Telarañas vectoriales de alta precisión, araña animada y decoración de esquina
 * para la tarjeta principal del Login.
 */
export function HalloweenCornerWebs() {
  return (
    <>
      <style>{`
        @keyframes amexSpiderBob {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, 16px, 0); }
        }
      `}</style>
      {/* Telaraña esquina superior izquierda */}
      <svg
        aria-hidden="true"
        width="130"
        height="130"
        viewBox="0 0 130 130"
        fill="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          opacity: 0.3,
          zIndex: 3,
        }}
      >
        <path
          d="M0 0 L130 0 M0 0 L122 44 M0 0 L102 78 M0 0 L78 102 M0 0 L44 122 M0 0 L0 130"
          stroke="#fb923c"
          strokeWidth="1.15"
        />
        <path
          d="M26 0 Q24 12 18 18 Q12 24 0 26 M54 0 Q48 24 38 38 Q24 48 0 54 M84 0 Q74 38 58 58 Q38 74 0 84 M114 0 Q100 52 78 78 Q52 100 0 114"
          stroke="#c084fc"
          strokeWidth="1.05"
          fill="none"
        />
      </svg>

      {/* Telaraña esquina superior derecha + arañita colgante */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 130,
          height: 155,
          pointerEvents: 'none',
          zIndex: 3,
        }}
      >
        <svg
          width="130"
          height="130"
          viewBox="0 0 130 130"
          fill="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            transform: 'scaleX(-1)',
            opacity: 0.28,
          }}
        >
          <path
            d="M0 0 L130 0 M0 0 L122 44 M0 0 L102 78 M0 0 L78 102 M0 0 L44 122 M0 0 L0 130"
            stroke="#fb923c"
            strokeWidth="1.15"
          />
          <path
            d="M26 0 Q24 12 18 18 Q12 24 0 26 M54 0 Q48 24 38 38 Q24 48 0 54 M84 0 Q74 38 58 58 Q38 74 0 84 M114 0 Q100 52 78 78 Q52 100 0 114"
            stroke="#c084fc"
            strokeWidth="1.05"
            fill="none"
          />
        </svg>

        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'amexSpiderBob 4s ease-in-out infinite',
            willChange: 'transform',
          }}
        >
          <div
            style={{
              width: 1.2,
              height: 40,
              background: 'linear-gradient(180deg, rgba(251,146,60,0.5), rgba(192,132,252,0.75))',
            }}
          />
          <i
            className="fa-solid fa-spider"
            style={{
              fontSize: 14,
              color: '#fb923c',
              filter: 'drop-shadow(0 2px 8px rgba(249, 115, 22, 0.7))',
            }}
          />
        </div>
      </div>
    </>
  );
}
