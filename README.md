# Portal de Clientes — AMEX Courier S.A.C.

Plataforma oficial dedicada de Casillero Virtual, Seguimiento en Tiempo Real y Notificaciones para clientes de **AMEX Courier S.A.C.**

---

## 🚀 Arquitectura y Tecnologías

- **Framework:** Next.js (App Router) + React 19 + TypeScript
- **Estilos:** Tailwind CSS v4 + Lucide Icons + FontAwesome
- **Base de Datos & Auth:** Supabase us-west-2 Oregon (`zftkbolgcnnkkdfzmtix`)
  - Aislamiento total de seguridad: No posee credenciales ni acceso al ERP Maestro de Lima.
- **Servicio de Correos:** Resend API (`sistemaamexcourier.online`)
- **Dominio de Producción:** `https://clientes.sistemaamexcourier.online`
- **Demonio Espejo TIB 24/7:** Sincronizador en segundo plano en Hostinger VPS (`worker/tib-mirror-daemon.mjs`)

---

## 📂 Estructura del Proyecto

```
portal-clientes-amex/
├── app/
│   ├── page.tsx                    # Casillero virtual y panel superadmin
│   ├── layout.tsx                  # Layout raíz y metadatos
│   ├── globals.css                 # Estilos globales y Tailwind CSS
│   ├── login/                      # Inicio de sesión con temática dinámica
│   ├── registro/                   # Registro de nuevos usuarios
│   ├── establecer-password/        # Activación de cuenta por correo
│   ├── configurar/[id]/            # Panel Superadmin (palabras clave / consignatarios TIB)
│   └── api/
│       ├── actualizar-usuario/     # Modificación de perfil y alias TIB
│       ├── auth/login/             # Autenticación con puente Superadmin
│       ├── crear-usuario/          # Alta de clientes e invitación por email
│       ├── listado-amex/           # Búsqueda rápida de consignatarios en TIB
│       ├── listar-portal/          # Directorio de clientes registrados
│       ├── reenviar-activacion/    # Reenvío de enlace mágico / recuperación
│       ├── sync-all/               # Sincronización batch de paquetes
│       └── tracking/               # Consulta pública de WR sin sesión
├── components/
│   └── themes/                     # Efectos visuales de temporada (Halloween 60 FPS)
├── lib/
│   ├── email/                      # Plantillas HTML institucionales y cliente Resend
│   ├── portal/                     # Motor de sincronización TIB y matching de clientes
│   ├── supabase/                   # Clientes aislados de Supabase Oregon
│   └── themes/                     # Configuración de temporadas (Halloween / Default)
├── public/                         # Logotipos e infografías institucionales
├── scripts/
│   └── security-check.mjs          # Guardián pre-commit de seguridad y secretos
└── worker/
    └── tib-mirror-daemon.mjs       # Demonio de sincronización 24/7 (Hostinger VPS)
```

---

## ⚙️ Variables de Entorno

Crear el archivo `.env.local` con las siguientes claves:

```env
NEXT_PUBLIC_PORTAL_SUPABASE_URL="https://zftkbolgcnnkkdfzmtix.supabase.co"
NEXT_PUBLIC_PORTAL_SUPABASE_ANON_KEY="..."
PORTAL_SUPABASE_SERVICE_ROLE_KEY="..."
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="AMEX Courier <notificaciones@sistemaamexcourier.online>"
NEXT_PUBLIC_PORTAL_URL="https://clientes.sistemaamexcourier.online"
```

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor local
npm run dev

# Escaneo de seguridad (bloquea commits con secretos)
npm run security-check

# Compilar para producción
npm run build
```

---

## 🛡️ Seguridad Garantizada

Este repositorio cuenta con un **escudo automatizado de seguridad** (`scripts/security-check.mjs`) que se ejecuta antes de cada `git commit` y `git push`. Cualquier intento de almacenar llaves de servicio, tokens de Resend o JWTs en código plano es bloqueado de inmediato.
