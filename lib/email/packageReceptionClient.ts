import { sendEmail } from './resend';

export interface SendPackageReceptionEmailOptions {
  email: string;
  nombreCompleto: string;
  wr: string;
  tracking?: string | null;
  pesoKg?: number | null;
  tipoEmpaque?: string | null;
  fotoUrl?: string | null;
}

/**
 * Notificación automática por correo electrónico al cliente cuando un nuevo paquete
 * arriba y es recibido en el almacén de Miami.
 */
export async function sendPackageReceptionEmail(options: SendPackageReceptionEmailOptions) {
  const { email, nombreCompleto, wr, tracking, pesoKg, tipoEmpaque, fotoUrl } = options;

  const subject = `📦 ¡Tu paquete ha llegado a nuestro almacén de Miami! [${wr}]`;

  const trackingText = tracking && tracking !== '—' ? tracking : 'Sin Tracking Asignado';
  const pesoText = pesoKg != null && pesoKg > 0 ? `${Number(pesoKg).toFixed(2)} kg` : 'Por registrar';
  const tipoText = tipoEmpaque || 'Caja / Paquete';
  const portalUrl = 'https://clientes.sistemaamexcourier.online/clientes';

  const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Paquete Recibido en Miami - AMEX Courier</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b1329; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="580" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.35); max-width: 580px; width: 100%;">
          
          <!-- Encabezado Institucional Naranja / Azul AMEX -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e2229 0%, #0f172a 60%, #ff5722 100%); padding: 36px 30px; text-align: center; border-bottom: 3px solid #ff5722;">
              <img src="https://www.sistemaamexcourier.online/images/logo-amex-clean.png" alt="AMEX Courier" width="160" style="display: block; margin: 0 auto 14px auto; max-width: 160px; height: auto;" />
              <span style="display: inline-block; background: rgba(255, 87, 34, 0.2); border: 1px solid rgba(255, 87, 34, 0.4); color: #ffccbc; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
                ✈️ Recepción en Miami • Casillero Virtual
              </span>
              <h1 style="color: #ffffff; margin: 0; font-size: 23px; font-weight: 900; letter-spacing: -0.5px;">
                ¡Tu paquete ya está en Miami!
              </h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 13.5px;">
                Hemos recibido y registrado tu paquete en nuestro almacén para su próximo despacho a Lima.
              </p>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hola <strong>${nombreCompleto}</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Te confirmamos que tu compra o envío acaba de ingresar físicamente a nuestras instalaciones de Miami bajo el siguiente registro:
              </p>

              <!-- Tarjeta de Detalle del Paquete -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Número de Warehouse (WR)</span>
                    <div style="font-size: 17px; font-weight: 900; color: #ff5722; font-family: monospace; margin-top: 2px;">
                      ${wr}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Número de Tracking Original</span>
                    <div style="font-size: 13.5px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">
                      ${trackingText}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px; border-bottom: 1px solid #e2e8f0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="50%" style="vertical-align: top;">
                          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Peso Registrado</span>
                          <div style="font-size: 14px; font-weight: 800; color: #1e293b; margin-top: 2px;">
                            ${pesoText}
                          </div>
                        </td>
                        <td width="50%" style="vertical-align: top;">
                          <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Tipo de Embalaje</span>
                          <div style="font-size: 14px; font-weight: 700; color: #475569; text-transform: uppercase; margin-top: 2px;">
                            ${tipoText}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 20px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Estado Actual</span>
                    <div style="margin-top: 4px;">
                      <span style="display: inline-block; background-color: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; letter-spacing: 0.4px;">
                        ● RECIBIDO MIAMI
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              ${
                fotoUrl
                  ? `
              <div style="margin: 20px 0; text-align: center;">
                <p style="font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: 600;">
                  Foto de verificación tomada en almacén:
                </p>
                <img src="${fotoUrl}" alt="Foto del paquete" style="max-width: 100%; border-radius: 8px; border: 1px solid #e2e8f0; max-height: 240px; object-fit: cover;" />
              </div>`
                  : ''
              }

              <!-- Botón CTA al Portal -->
              <div style="text-align: center; margin: 28px 0 16px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); box-shadow: 0 4px 14px rgba(255, 87, 34, 0.4);">
                      <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 34px; font-size: 14.5px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
                        Ver Paquete en mi Portal →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12.5px; line-height: 1.5; color: #64748b; text-align: center;">
                Te mantendremos informado en cada etapa del trayecto hasta su llegada y entrega en Lima.
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
                Recibiste este correo porque estás registrado en el servicio de casillero virtual de AMEX Courier.
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
  });
}
