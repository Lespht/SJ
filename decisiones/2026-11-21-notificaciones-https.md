# Notificaciones: seguir con PocketBase, HTTPS con DuckDNS + Caddy y un servicio de avisos aparte

**Fecha:** 2026-11-21 · **Estado:** aceptada

## Contexto

Queremos notificaciones push (mensaje nuevo, plan completado, foto nueva, plan nuevo y recordatorio el
día del plan). Usamos un iPhone y un Android. Web Push pide tres cosas:

1. **HTTPS válido.** Hoy PocketBase atiende por HTTP en `:8090`, al que solo se llega por NordVPN Meshnet.
2. Un **service worker** en la app.
3. Un servidor que **firme y cifre** los avisos. Los hooks JS de PocketBase no traen esa criptografía.

Como la app sigue creciendo, también nos preguntamos si convenía cambiar de plataforma.

## Decisión

- **Seguimos con PocketBase.** Somos dos personas en un PC viejo (Core 2 Quad, 4 GB, disco rígido). Todo lo
  que pedimos hasta ahora entra en PocketBase. Supabase o Appwrite serían demasiado pesados para ese
  hardware, y un backend propio nos haría reescribir el login, los archivos, el tiempo real y las reglas.
- **HTTPS:** un subdominio gratis de DuckDNS que apunta a la IP de Meshnet del servidor, con Caddy delante de
  PocketBase. Caddy saca el certificado de Let's Encrypt con el desafío DNS. Así el servidor sigue sin quedar
  expuesto a internet.
- **Avisos:** un servicio chico en TypeScript con la librería `web-push`. PocketBase le avisa por `localhost`
  cada vez que pasa algo. El recordatorio diario lo dispara el cron de PocketBase.

## Alternativas descartadas

- **Certificado propio instalado en cada celular:** en iPhone es frágil.
- **Cloudflare Tunnel:** expone la app a internet.
- **PocketBase extendido en Go:** deja un solo binario, pero trae un lenguaje nuevo y cambia el deploy.
  Lo retomamos si los servicios aparte empiezan a multiplicarse.

## Cuándo revisarla

Si la usan más personas, si hay que entrar sin Meshnet, o si hay mucho video o fotos en alta. En ese último
caso, el límite está en el hardware, no en PocketBase.
