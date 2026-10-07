# BelaClub

Aplicacion Next.js para conectar clientes con prestadores, gestionar perfiles,
verificaciones, saldo, contenido privado y reportes de seguridad.

## Desarrollo

```bash
npm.cmd run dev
```

Abre `http://localhost:3010/prestadores`.

El servidor local de BelaClub usa el puerto `3010` para no cruzarse con otros
proyectos, como la herramienta de WhatsApp que suele quedarse viva en
`localhost:3000`. Si necesitas cambiarlo:

```powershell
$env:BELACLUB_DEV_PORT=3011
npm.cmd run dev
```

## Validacion

```bash
node_modules\.bin\eslint.cmd app lib components
node_modules\.bin\tsc.cmd --noEmit
npm.cmd run security:check
npm.cmd run build
```

## Variables de entorno

Configura estas variables en `.env.local` y tambien en produccion:

```txt
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
NEXT_PUBLIC_OWNER_EMAIL=correo-del-dueno@dominio.com

OWNER_EMAIL=correo-del-dueno@dominio.com
# o OWNER_UID=uid-del-dueno
# Opcional: limita panel admin y /api/admin a tu IP publica.
ADMIN_ALLOWED_IPS=203.0.113.10
# Opcional extremo: pone el sitio completo en modo privado por IP.
# No lo actives si quieres que clientes/SEO puedan ver las paginas publicas.
SITE_ALLOWED_IPS=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

BUNNY_API_KEY=
BUNNY_STORAGE_ZONE=
BUNNY_STORAGE_HOST=
BUNNY_CDN_HOST=

PRIVATE_MEDIA_SECRET=clave-larga-random

WOMPI_PUBLIC_KEY=
WOMPI_INTEGRITY_SECRET=
WOMPI_EVENTS_SECRET=

# Wompi Pagos a Terceros / Payouts para retiros automaticos
WOMPI_PAYOUTS_ENV=sandbox
WOMPI_PAYOUTS_API_KEY=
WOMPI_PAYOUTS_USER_PRINCIPAL_ID=
WOMPI_PAYOUTS_ACCOUNT_ID=
WOMPI_PAYOUTS_EVENTS_SECRET=
# Opcional si quieres fijar los bankId en vez de resolverlos con /banks
WOMPI_PAYOUTS_BANCOLOMBIA_BANK_ID=
WOMPI_PAYOUTS_NEQUI_BANK_ID=

# Requerido en produccion para proteger el cobro de mensualidades
CRON_SECRET=
```

## Produccion

Antes de publicar:

1. Valida variables criticas:

```bash
npm.cmd run security:check
npm.cmd run preflight
```

2. Despliega reglas de Firestore:

```bash
firebase deploy --only firestore:rules
```

3. En Wompi configura la URL de eventos:

```txt
https://tu-dominio.com/api/wompi/webhook
```

Para Pagos a Terceros / Payouts configura tambien:

```txt
https://tu-dominio.com/api/wompi/payouts-webhook
```

4. Haz una recarga real pequena y valida que el saldo se acredite.

5. Prueba el flujo completo con dos cuentas:

- prestador crea perfil y sube contenido privado;
- dueno aprueba perfil;
- cliente recarga saldo;
- cliente compra contenido;
- cliente vuelve a abrir el perfil y el contenido sigue desbloqueado;
- cliente reporta perfil y el reporte aparece en el panel admin.
- prestador recarga saldo y el sistema descuenta automaticamente la mensualidad
  cuando este vencida.

## Seguridad

- Las compras y abonos usan el usuario autenticado desde Firebase Admin.
- El contenido privado se entrega con links temporales firmados.
- El webhook de Wompi valida checksum antes de acreditar saldo.
- Las reglas de Firestore bloquean lectura publica directa de documentos sensibles.
- Los reportes se guardan en Firestore y se revisan desde el panel admin.
- `ADMIN_ALLOWED_IPS` bloquea `/admin` y `/api/admin` por IP antes de leer datos.
- `SITE_ALLOWED_IPS` bloquea el sitio completo por IP cuando necesitas modo privado.
- `npm.cmd run security:check` falla si un `.env` queda versionado o si detecta
  secretos obvios dentro de archivos trackeados.
- Next envia headers base de seguridad para bloquear iframes, sniffing y
  rastreo de rutas privadas/API.
- Las mensualidades de prestadores se procesan con un cron del servidor que llama
  `/api/provider-subscriptions/process` usando `Authorization: Bearer CRON_SECRET`.
