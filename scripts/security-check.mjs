#!/usr/bin/env node
/**
 * AMEX COURIER - GUARDIÁN DE SEGURIDAD PRE-COMMIT (PORTAL CLIENTES)
 * 
 * Escanea archivos en el repositorio para detectar fugas accidentales de secretos:
 * - JWTs de Supabase (especialmente Service Role Keys)
 * - Claves API de Resend (re_...)
 * - Claves privadas RSA/PEM
 * - Variables de entorno críticas hardcodeadas
 * 
 * Se ejecuta automáticamente antes de cada git commit.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SECRET_PATTERNS = [
  {
    name: 'Supabase JWT / Service Role Token',
    regex: /eyJ[a-zA-Z0-9_\-]{15,}\.eyJ[a-zA-Z0-9_\-]{15,}\.[a-zA-Z0-9_\-]{15,}/g,
  },
  {
    name: 'Resend API Key',
    regex: /\bre_[a-zA-Z0-9]{24,}\b/g,
  },
  {
    name: 'Clave Privada PEM/RSA',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: 'Contraseña o Credencial en URL de PostgreSQL',
    regex: /postgres(ql)?:\/\/[^:]+:[^@\s]{6,}@[^:\s]+:[0-9]+/g,
  },
  {
    name: 'Company Email Password / Hardcoded Password Literal',
    regex: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
  },
  {
    name: 'TIB or Service Password Fallback',
    regex: /(TIB_API_PASSWORD|TIB_PASSWORD|VPS_ROOT_PASSWORD)\s*\|\|\s*['"][^'"]+['"]/gi,
  },
];

// Archivos o extensiones permitidas / ignoradas
const IGNORE_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.example',
  'package-lock.json',
  'security-check.mjs',
];

const IGNORE_DIRS = [
  'node_modules',
  '.git',
  '.next',
  '.gemini',
];

function getStagedOrTrackedFiles() {
  try {
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    if (staged.length > 0) return staged;

    const diff = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    if (diff.length > 0) return diff;

    return execSync('git ls-files', { encoding: 'utf8' })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runCheck() {
  console.log('🛡️ [AMEX SECURITY SHIELD] Escaneando archivos en busca de secretos expuestos...');
  const files = getStagedOrTrackedFiles();
  let violations = [];

  for (const file of files) {
    if (!file || !fs.existsSync(file)) continue;

    const baseName = path.basename(file);
    if (IGNORE_FILES.includes(baseName)) continue;
    if (IGNORE_DIRS.some((dir) => file.startsWith(dir + '/') || file.startsWith(dir + '\\'))) continue;

    const ext = path.extname(file).toLowerCase();
    const textExts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.sql', '.yaml', '.yml', '.ps1', '.sh'];
    if (!textExts.includes(ext)) continue;

    let content = '';
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      const matches = content.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          if (
            match.includes('your-api-key') ||
            match.includes('YOUR_KEY') ||
            match.includes('example') ||
            (match.includes('<') && match.includes('>')) ||
            match.includes('tu-') ||
            match.includes('dummy') ||
            match.includes('placeholder')
          ) continue;
          violations.push({
            file,
            secretType: pattern.name,
            snippet: match.slice(0, 14) + '...' + match.slice(-6),
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error('\n❌❌❌ ALERTA CRÍTICA DE SEGURIDAD ❌❌❌');
    console.error('Se detectaron credenciales o tokens en texto plano que NO deben ser subidos al repositorio:');
    for (const v of violations) {
      console.error(`  - Archivo: ${v.file}`);
      console.error(`    Tipo:    ${v.secretType}`);
      console.error(`    Token:   ${v.snippet}\n`);
    }
    console.error('Por favor reemplaza estos valores con process.env.NOMBRE_VARIABLE.');
    process.exit(1);
  }

  console.log('✅ [AMEX SECURITY SHIELD] 100% Limpio. No se detectaron secretos ni tokens expuestos.\n');
  process.exit(0);
}

runCheck();
