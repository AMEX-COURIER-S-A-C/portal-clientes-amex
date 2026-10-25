import { Resend } from 'resend';

// Inicializar cliente Resend con API Key del entorno
const apiKey = process.env.RESEND_API_KEY || process.env.API_KEY_RESEND || '';
export const resend = apiKey ? new Resend(apiKey) : null;

// Dominio único verificado en Resend para envíos: sistemaamexcourier.online
const envFrom = process.env.RESEND_FROM_EMAIL || '';
export const DEFAULT_FROM_EMAIL =
  envFrom.includes('sistemaamexcourier.online')
    ? envFrom
    : 'AMEX Courier <notificaciones@sistemaamexcourier.online>';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

/**
 * Servicio unificado para envío de correos transaccionales en AMEX Courier.
 */
export async function sendEmail(options: SendEmailOptions) {
  if (!resend) {
    console.warn('⚠️ [Resend Service] RESEND_API_KEY no está configurada en las variables de entorno.');
    return { success: false, error: 'RESEND_API_KEY no configurada' };
  }

  // Asegurar que el remitente siempre use el dominio verificado en Resend
  let fromAddress = DEFAULT_FROM_EMAIL;
  if (!fromAddress.includes('sistemaamexcourier.online')) {
    fromAddress = 'AMEX Courier <notificaciones@sistemaamexcourier.online>';
  }

  // Asegurar que replyTo no contenga un dominio no verificado
  const replyToAddress =
    options.replyTo && options.replyTo.includes('sistemaamexcourier.online')
      ? options.replyTo
      : 'notificaciones@sistemaamexcourier.online';

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: Array.isArray(options.to) ? options.to : [options.to],
      replyTo: replyToAddress,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });

    if (error) {
      console.error('❌ [Resend Service] Error al enviar email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('❌ [Resend Service] Excepción en envío:', err);
    return { success: false, error: err.message || 'Error desconocido al enviar email' };
  }
}
