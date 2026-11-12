# Línea base de seguridad y privacidad

## Estado conocido

La versión actual es una aplicación estática cliente-side. Los datos se guardan en `localStorage`; las credenciales, reglas de acceso y operaciones sensibles se manejan desde JavaScript en el navegador. El hash de contraseña implementado es una función casera y no es apropiado para proteger credenciales. La lógica local de QR no puede demostrar criptográficamente que un código fue emitido por un docente ni impedir que un cliente manipule su propio estado. Un almacenamiento local o una variable de sesión no constituyen autorización confiable.

En particular, no se debe asumir que el control de acceso a vistas, la expiración calculada en el cliente, el bloqueo local de intentos o los datos que la interfaz oculta protegen los datos. El flujo alternativo de búsqueda/selección de alumnos por DNI requiere eliminarse o rediseñarse como asistencia autenticada y verificada por el servidor antes de cualquier uso real.

**Uso seguro hoy:** pruebas locales con datos ficticios. No cargar nombres, DNI, emails, teléfonos, calificaciones, asistencia ni otra información identificable de menores.

## Controles obligatorios antes de un piloto con datos reales

1. **Servicio y persistencia confiables**
   - Incorporar API detrás de HTTPS y base de datos administrada; GitHub Pages puede servir el frontend, pero no es el backend.
   - Configurar secretos únicamente en el entorno de servidor, nunca en HTML, JavaScript público o repositorio.
   - Usar migraciones versionadas, restricciones e índices, transacciones donde corresponda y claves foráneas.
   - Definir copias de seguridad cifradas, retención y una prueba documentada de restauración.

2. **Identidad, autenticación y autorización**
   - Contraseñas con Argon2id (o bcrypt debidamente configurado) en el servidor; migrar credenciales de forma explícita y no conservar el hash casero como mecanismo de seguridad.
   - Sesiones gestionadas por servidor, cookies `HttpOnly`, `Secure`, `SameSite` y protección CSRF para operaciones con estado. Rotar y revocar sesiones al iniciar/cerrar sesión y ante cambios sensibles.
   - Aplicar autorización en cada endpoint y por cada recurso/escuela/curso, no solo al construir menús o vistas.
   - Limitar intentos de autenticación en servidor, registrar señales de abuso sin almacenar contraseñas ni tokens y diseñar recuperación de cuentas segura.
   - Eliminar cualquier acceso automático o selección de identidad basada únicamente en DNI, URL/QR o datos persistidos localmente.

3. **Asistencia por QR**
   - Generar códigos con token impredecible en servidor, vencimiento comprobado en servidor, asociación al curso y política de un solo uso/idempotencia.
   - Exigir identidad autenticada y matrícula vigente. No confiar en nombre de curso, token, hora ni rol provistos por el cliente.
   - Validar expiración, tolerancia a reloj, curso, matrícula, repetición y límites; almacenar el resultado y actor de forma transaccional.
   - Evitar incluir datos personales en el QR. El QR no debe funcionar como credencial de autenticación.

4. **Datos personales y operación**
   - Inventariar campos y justificar cada dato recolectado; minimizar retención y acceso, y documentar eliminación/exportación y respuesta ante incidentes.
   - Restringir acceso administrativo, exigir MFA a administradores y auditar cambios sensibles (actor, acción, recurso, fecha y resultado, sin secretos).
   - Definir responsables, permisos, retención, consentimiento y requisitos legales aplicables con la institución y asesoría correspondiente; este documento no constituye asesoramiento legal ni certificación de cumplimiento.
   - Usar datos ficticios o anonimizados en desarrollo, pruebas, screenshots y reportes.

5. **Seguridad de aplicación y cadena de suministro**
   - Validación de entrada en servidor, consultas parametrizadas, escape contextual al renderizar, política CSP y cabeceras seguras.
   - Revisar dependencias externas/CDN, fijar versiones, minimizar permisos y evaluar integridad/actualizaciones; no enviar a servicios de terceros payloads que puedan revelar información.
   - Evitar `innerHTML` con datos no confiables; no guardar secretos en `localStorage`; comprobar errores sin filtración de datos.
   - Añadir análisis automatizado de dependencias y secretos y un proceso de actualización/revisión.

## Incidentes y recuperación

Antes del piloto, definir quién responde, cómo revocar sesiones/credenciales, cómo preservar registros, cómo informar a la institución y cómo restaurar un backup. Practicar restauración y documentar tiempo objetivo de recuperación y pérdida de datos tolerable. No prometer disponibilidad sin mediciones y responsables operativos.

## Evidencia requerida para levantar el bloqueo de datos reales

- Pruebas de API que demuestren que cada rol solo puede acceder a sus recursos y que solicitudes no autorizadas reciben 401/403.
- Pruebas para QR vencido, manipulado, de otro curso, repetido y válido; las pruebas deben ejecutarse contra el backend real de pruebas, no solo contra funciones JavaScript simuladas.
- Pruebas de contraseñas, sesión, CSRF, recuperación y rate limiting.
- Restauración de backup verificada en entorno aislado.
- Revisión manual de seguridad, privacidad, permisos y flujo de eliminación.
- Despliegue de staging con TLS, secretos fuera del repositorio, alertas y procedimiento de incidentes.

Hasta completar y revisar esta evidencia, mantener el producto en modo demostración con datos ficticios.
