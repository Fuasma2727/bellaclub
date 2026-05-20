# BelaClub

Aplicacion Next.js para conectar clientes con prestadores, gestionar perfiles,
verificaciones, saldo, contenido privado y reportes de seguridad.

## Desarrollo

```bash
npm.cmd run dev
```

Abre `http://localhost:3000/prestadores`.

## Validacion

```bash
node_modules\.bin\eslint.cmd app lib components
node_modules\.bin\tsc.cmd --noEmit
npm.cmd run build
```

## Variables de entorno

Configura estas variables en `.env.local` y tambien en produccion:

```txt
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
NEXT_PUBLIC_OWNER_EMAIL=correo-del-dueno@dominio.com

OWNER_EMAIL=correo-del-dueno@dominio.com
# o OWNER_UID=uid-del-dueno

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
```

## Produccion

Antes de publicar:

1. Valida variables criticas:

```bash
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

4. Haz una recarga real pequena y valida que el saldo se acredite.

5. Prueba el flujo completo con dos cuentas:

- prestador crea perfil y sube contenido privado;
- dueno aprueba perfil;
- cliente recarga saldo;
- cliente compra contenido;
- cliente vuelve a abrir el perfil y el contenido sigue desbloqueado;
- cliente reporta perfil y el reporte aparece en el panel admin.

## Seguridad

- Las compras y abonos usan el usuario autenticado desde Firebase Admin.
- El contenido privado se entrega con links temporales firmados.
- El webhook de Wompi valida checksum antes de acreditar saldo.
- Las reglas de Firestore bloquean lectura publica directa de documentos sensibles.
- Los reportes se guardan en Firestore y se revisan desde el panel admin.
- Next envia headers base de seguridad para bloquear iframes, sniffing y
  rastreo de rutas privadas/API.
