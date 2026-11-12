# Roadmap de confiabilidad

Este plan transforma la aplicación estática actual en una plataforma que pueda operarse con controles verificables. El estado inicial es una SPA de HTML/CSS/JavaScript con persistencia en `localStorage`; no hay API ni almacenamiento compartido. Los hitos son secuenciales: no se considera terminado un módulo porque exista su pantalla.

## Hito 0 — Proteger usuarios y estabilizar el alcance

- [x] Documentar el estado técnico y el riesgo de usar datos reales.
- [ ] Mantener producción/demo sin información personal real.
- [ ] Acordar institución piloto, roles, flujos prioritarios, responsable operativo y requerimientos de privacidad.
- [ ] Crear inventario de datos y definir minimización, retención, acceso y eliminación.
- [ ] Identificar despliegue actual y separar claramente demo, staging y producción.

**Aceptación:** existe responsable de producto/operación, datos de prueba ficticios y aprobación de alcance antes de desplegar una API o migrar datos reales.

## Hito 1 — Base de ingeniería y pruebas

- [ ] Dividir el JavaScript monolítico en módulos por dominio, separando UI, reglas y acceso a datos sin cambiar los flujos de golpe.
- [ ] Añadir scripts reproducibles de test, lint y validación; empezar con pruebas unitarias de fechas, asistencia, calificaciones y validadores.
- [ ] Establecer CI para ejecutar pruebas en cada pull request y bloquear merges si fallan.
- [ ] Añadir guía local, configuración de entorno de ejemplo sin secretos y convenciones para cambios/migraciones.
- [ ] Revisar estructura HTML, errores de consola, accesibilidad básica y navegación móvil.

**Aceptación:** una instalación limpia puede ejecutar validaciones mediante comandos documentados; CI informa resultados; los flujos cubiertos tienen pruebas repetibles.

## Hito 2 — Arquitectura de datos y servicio

Propuesta inicial a validar con quien opere y mantenga el sistema: frontend web existente, API versionada en Node.js LTS y PostgreSQL. Elegir framework, ORM, hosting, dominio, costos, región y política de backups antes de implementarlo. La API será la autoridad para identidad, permisos, reglas académicas y persistencia. GitHub Pages puede seguir sirviendo archivos estáticos, pero no reemplaza el backend.

- [ ] Definir modelo: escuelas, usuarios, roles, cursos, matrículas, materias, asistencias, materiales, tareas, entregas, exámenes, preguntas, intentos, notas y auditoría.
- [ ] Definir aislamiento por institución/escuela y reglas de acceso por curso.
- [ ] Crear API con esquemas de entrada, errores consistentes, paginación y OpenAPI.
- [ ] Añadir migraciones, datos de desarrollo ficticios y pruebas de integración.
- [ ] No implementar migración de `localStorage` como importación automática; diseñar exportación, revisión y migración controlada por separado.

**Aceptación:** datos sobreviven a cambio de dispositivo/navegador; migraciones se prueban desde una base vacía y desde la versión previa; endpoints niegan por defecto recursos ajenos.

## Hito 3 — Identidad, permisos y privacidad

- [ ] Registro/invitación docente con verificación institucional; alta de alumnos mediante mecanismo autorizado por la escuela, evitando autoasignación a cursos.
- [ ] Autenticación segura en servidor, recuperación de cuenta, cierre de sesiones y MFA administrativo.
- [ ] Autorización en cada endpoint y validación de pertenencia a escuela/curso.
- [ ] Rate limiting, CSRF, validación de origen y cabeceras/CSP adecuadas.
- [ ] Auditoría de cambios de notas, matrículas, asistencia, roles y administración.
- [ ] Revisar y aprobar retención, exportación, corrección y eliminación de datos personales.

**Aceptación:** pruebas negativas demuestran que un usuario no puede leer ni cambiar datos de otro rol, alumno, curso o institución; secretos y credenciales no aparecen en cliente, logs o repositorio.

## Hito 4 — Completar flujos académicos

### Cursos y matrículas
- [ ] Docente autorizado crea/edita cursos y gestiona alumnos; importación CSV valida columnas, duplicados y errores antes de confirmar.
- [ ] Bajas y cambios conservan historial necesario y no eliminan silenciosamente asistencia/notas relacionadas.

### Asistencia
- [ ] Registro manual con fecha, curso, estado y auditoría; editar requiere permiso y motivo.
- [ ] QR temporal emitido/verificado por servidor, autenticado y ligado al curso; exportación y consulta por rango.
- [ ] Dedupe idempotente y pruebas de concurrencia, expiración y matrícula incorrecta.

### Materiales y trabajos
- [ ] Materiales asociados a curso con permisos; cargas de archivos con límites, tipo seguro y almacenamiento privado.
- [ ] TP con destinatarios, fechas, zona horaria, entregas versionadas, recibo, corrección, feedback y estado tardío.

### Exámenes y notas
- [ ] Publicación explícita de examen para curso; intentos y respuestas guardados en servidor con plazo y reglas claras.
- [ ] Aleatorización/configuración controlada; corrección automática y revisión docente de preguntas abiertas.
- [ ] Libro de calificaciones con historial de cambios, promedio calculado con política explícita y acceso del alumno solo a sus resultados.

**Aceptación:** flujos probados de extremo a extremo desde cuentas con permisos distintos, incluyendo fallas de red, reintentos, duplicados y datos límite.

## Hito 5 — Operación y resiliencia

- [ ] Staging separado y despliegues revisables; migraciones compatibles y plan de rollback.
- [ ] Backups cifrados, retención acordada y restauración probada periódicamente.
- [ ] Logs estructurados sin secretos ni datos personales innecesarios, monitoreo de errores y alertas.
- [ ] Límites de tamaño/tasa, timeouts, manejo de indisponibilidad y salud de dependencias.
- [ ] Procedimiento de incidentes, contactos, revocación y comunicación institucional.
- [ ] Prueba de carga acorde a cantidad real de escuelas/alumnos concurrentes.

**Aceptación:** restauración y rollback ensayados; alertas verificadas; objetivos de disponibilidad y recuperación documentados, no supuestos.

## Hito 6 — Usabilidad, accesibilidad y piloto

- [ ] WCAG 2.2 AA como objetivo de diseño, con revisión automatizada y manual de teclado/lector de pantalla/contraste.
- [ ] Pruebas en celulares y conexiones lentas; estados offline explícitos y sin aparentar que una operación se guardó si no llegó al servidor.
- [ ] Prueba piloto limitada con datos autorizados después de superar la línea base de seguridad.
- [ ] Recoger feedback de docentes/alumnos, priorizar problemas y documentar soporte.

**Aceptación:** el piloto tiene usuarios y soporte definidos, no hay fallos críticos abiertos, privacidad y recuperación aprobadas por responsables, y se verifica cada flujo prioritario con usuarios reales en entorno autorizado.

## Orden de ejecución recomendado

Primero acordar alcance y responsable; luego crear pruebas/CI y API con modelo de datos; a continuación identidad y permisos; después migrar y terminar asistencia, TP, exámenes y notas; finalmente observabilidad, backup/restore, accesibilidad y piloto. No desplegar controles de aula que intenten penalizar cambios de pestaña o salida del navegador como prueba de conducta: son señales poco confiables y pueden perjudicar a estudiantes por fallos del dispositivo o necesidades de accesibilidad.

## Fuera de alcance de una promesa de “100%”

Ningún sistema puede garantizar seguridad, disponibilidad o ausencia total de errores. Cada hito debe tener propietario, evidencia, pruebas y revisión; los riesgos residuales y limitaciones deben comunicarse. Este roadmap no afirma que la aplicación ya cumpla los criterios ni sustituye una revisión legal o de seguridad especializada.
