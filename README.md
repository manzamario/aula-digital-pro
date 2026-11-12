# Aula Digital Pro

Plataforma web educativa para secundaria. El estado actual es un prototipo estático: la aplicación persiste datos en el almacenamiento del navegador y no cuenta con un backend ni una base de datos compartida. **No cargar datos personales reales de estudiantes hasta completar los controles de seguridad y privacidad descritos en [`docs/SECURITY_BASELINE.md`](docs/SECURITY_BASELINE.md).**

## Estado y alcance

La interfaz incluye áreas para docentes, alumnos y administración, con cursos, asistencia, materiales, trabajos prácticos y exámenes. La presencia de una pantalla o botón no implica que el flujo esté terminado, sincronizado o protegido. Consultá [`docs/ROADMAP_CONFIABILIDAD.md`](docs/ROADMAP_CONFIABILIDAD.md) para el plan de trabajo y sus criterios de aceptación.

## Ejecución actual

Es un frontend estático. Para probarlo, serví el repositorio mediante un servidor web local o GitHub Pages y abrí `index.html`. Algunas capacidades del navegador, como la cámara, requieren HTTPS o `localhost`. No hay todavía comandos de build, servidor API ni base de datos.

## Principios para el desarrollo

- No considerar la interfaz ni el almacenamiento del navegador como una frontera de seguridad.
- Validar autorización y datos en el servidor antes de persistir o devolver información.
- No usar datos de estudiantes reales mientras la aplicación no tenga autenticación, permisos, almacenamiento y respaldos adecuados.
- Cambios pequeños, revisables y con pruebas; no declarar un módulo confiable hasta verificar sus criterios de aceptación.

## Documentación

- [Línea base de seguridad y privacidad](docs/SECURITY_BASELINE.md)
- [Roadmap de confiabilidad y criterios de aceptación](docs/ROADMAP_CONFIABILIDAD.md)
