import { sendEmail } from './resend';

export interface SendPasswordResetClientEmailOptions {
  email: string;
  nombreCompleto: string;
  resetLink: string;
}

/**
 * Correo institucional exclusivo para restablecimiento de contraseña de clientes en Portal AMEX.
 */
export async function sendPasswordResetClientEmail(options: SendPasswordResetClientEmailOptions) {
  const { email, nombreCompleto, resetLink } = options;

  const subject = `🔑 Restablece tu contraseña — Portal AMEX Courier`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer contraseña - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 560px; width: 100%;">
          
          <!-- Encabezado Institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #ea580c 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #ff5722;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto; max-width: 160px; height: auto;" />
              <span style="display: inline-block; background: rgba(255, 87, 34, 0.2); border: 1px solid rgba(255, 87, 34, 0.4); color: #ffedd5; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                🔐 Seguridad de Acceso • Portal de Clientes
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
                Restablece tu Contraseña
              </h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">
                Solicitud de recuperación de acceso a tu casillero y portal AMEX
              </p>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${nombreCompleto}</strong>,
              </p>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Hemos recibido una solicitud para <strong>restablecer la contraseña</strong> de tu cuenta en el <strong>Portal de Clientes de AMEX Courier</strong> asociada al correo <strong>${email}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Para elegir una nueva contraseña y recuperar tu acceso inmediato, haz clic en el siguiente botón seguro:
              </p>

              <!-- Botón CTA Destacado -->
              <div style="text-align: center; margin: 32px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #ff5722 0%, #ea580c 100%); box-shadow: 0 4px 16px rgba(255, 87, 34, 0.4);">
                      <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 16px 36px; font-size: 15px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.3px;">
                        🔑 Restablecer Mi Contraseña →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Enlace alternativo si no abre el botón -->
              <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-top: 24px; word-break: break-all;">
                <p style="margin: 0 0 6px 0; font-size: 11.5px; color: #64748b; font-weight: 600;">
                  ¿El botón no responde? Copia y pega este enlace seguro en tu navegador:
                </p>
                <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="font-size: 11.5px; color: #0284c7; text-decoration: underline;">
                  ${resetLink}
                </a>
              </div>

              <!-- Nota de seguridad -->
              <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 14px; border-radius: 6px; margin-top: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9a3412;">
                  🔒 <strong>Por tu seguridad:</strong> Este enlace es personal, de un solo uso y expirará pronto. Si tú o el administrador de AMEX Courier no solicitaron este cambio, tu cuenta sigue protegida y puedes ignorar este mensaje con total tranquilidad.
                </p>
              </div>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 11.5px; color: #64748b;">
                AMEX Courier S.A.C. • Portal de Clientes Oficial
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Atención y Consultas: <a href="mailto:soporte@sistemaamexcourier.online" style="color: #64748b; text-decoration: underline;">soporte@sistemaamexcourier.online</a> | Lima, Perú
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: email,
    subject,
    html: htmlContent,
    text: `Hola ${nombreCompleto},\n\nPara restablecer tu contraseña en el Portal de Clientes de AMEX Courier, abre el siguiente enlace en tu navegador:\n\n${resetLink}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`,
  });
}
