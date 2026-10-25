import { sendEmail } from './resend';

export interface SendWelcomeClientEmailOptions {
  email: string;
  nombreCompleto: string;
  activationLink: string;
}

/**
 * Correo limpio y exclusivo para activación y definición de contraseña de clientes del Portal AMEX.
 */
export async function sendWelcomeClientEmail(options: SendWelcomeClientEmailOptions) {
  const { email, nombreCompleto, activationLink } = options;

  const subject = `🔐 Activa tu cuenta en AMEX Courier — Define tu contraseña`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Activa tu cuenta en AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 560px; width: 100%;">
          
          <!-- Encabezado Institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #065f46 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #10b981;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto; max-width: 160px; height: auto;" />
              <span style="display: inline-block; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                🔐 Activación de Casillero • Portal de Clientes
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
                ¡Bienvenido a AMEX Courier!
              </h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">
                Tu acceso al casillero virtual y seguimiento de paquetes está listo.
              </p>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${nombreCompleto}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Has sido registrado en el <strong>Portal de Clientes de AMEX Courier</strong> con el correo <strong>${email}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Para comenzar a rastrear tus envíos en tiempo real y visualizar tus paquetes, por favor activa tu cuenta definiendo tu contraseña personal de acceso:
              </p>

              <!-- Botón CTA Destacado -->
              <div style="text-align: center; margin: 32px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);">
                      <a href="${activationLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 36px; font-size: 15px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px;">
                        🔑 Definir Mi Contraseña y Activar Cuenta →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Enlace alternativo si no abre el botón -->
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-top: 24px; word-break: break-all;">
                <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #64748b; font-weight: 600;">
                  ¿El botón no responde? Copia y pega este enlace en tu navegador:
                </p>
                <a href="${activationLink}" target="_blank" rel="noopener noreferrer" style="font-size: 11.5px; color: #0284c7; text-decoration: underline;">
                  ${activationLink}
                </a>
              </div>

              <!-- Nota de seguridad -->
              <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
                🔒 Por tu seguridad, este enlace es personal y confidencial. AMEX Courier nunca te solicitará tu contraseña por teléfono ni correo.
              </p>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11.5px; color: #64748b;">
                AMEX Courier S.A.C. • Portal de Clientes Oficial
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Si tú no solicitaste este registro, puedes ignorar este mensaje con total seguridad.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject,
    html: htmlContent,
  });
}
