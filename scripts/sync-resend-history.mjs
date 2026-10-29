import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].replace(/['"\r\n]/g, '').trim() : '';
};

const resend = new Resend(get('RESEND_API_KEY'));
const supabase = createClient(
  get('NEXT_PUBLIC_PORTAL_SUPABASE_URL'),
  get('PORTAL_SUPABASE_SERVICE_ROLE_KEY')
);

async function sync() {
  console.log('Fetching emails from Resend API...');
  const res = await resend.emails.list();
  if (res.error) {
    console.error('Error fetching Resend emails:', res.error);
    return;
  }
  const emails = res.data?.data || [];
  console.log(`Fetched ${emails.length} emails from Resend.`);

  // Get already synced resend_ids from portal_eventos_uso
  const { data: existingEvents } = await supabase
    .from('portal_eventos_uso')
    .select('detalles')
    .eq('tipo_evento', 'EMAIL_ENVIADO');

  const existingResendIds = new Set();
  for (const ev of existingEvents || []) {
    if (ev.detalles?.resend_id) {
      existingResendIds.add(ev.detalles.resend_id);
    }
  }

  let insertedCount = 0;

  for (const em of emails) {
    if (existingResendIds.has(em.id)) {
      continue;
    }

    const recipient = Array.isArray(em.to) ? em.to[0] : em.to;
    const cleanEmail = (recipient || '').toLowerCase().trim();

    // Check if WR is in subject
    const wrMatch = (em.subject || '').match(/\[(WR\d+)\]/i);
    const wr = wrMatch ? wrMatch[1].toUpperCase() : null;

    const { error } = await supabase.from('portal_eventos_uso').insert({
      usuario_email: cleanEmail,
      tipo_evento: 'EMAIL_ENVIADO',
      detalles: {
        asunto: em.subject,
        resend_id: em.id,
        wr: wr || undefined,
      },
      dispositivo: 'Servidor',
      navegador: 'Resend API',
      creado_en: em.created_at,
    });

    if (!error) {
      insertedCount++;
      existingResendIds.add(em.id);
      console.log(`+ Synced email to ${cleanEmail}: "${em.subject}" (${em.created_at})`);
    } else {
      console.error(`- Error inserting ${em.id}:`, error.message);
    }
  }

  console.log(`\nSuccessfully synced ${insertedCount} historical emails from Resend into portal_eventos_uso!`);
}

sync().catch(console.error);
