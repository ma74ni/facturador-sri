---
name: test-writer
description: Escribe tests de Jest para facturacion-core siguiendo las convenciones del repo (nombres en español, lógica de dominio en funciones puras, módulos de Nest con overrides, supertest para HTTP). Úsalo para cubrir código antes de refactorizarlo o para añadir los casos de un cambio.
tools: Read, Grep, Glob, Edit, Write, Bash
model: inherit
---

Escribes tests para `packages/facturacion-core`. Se usan para refactorizar con seguridad un sistema en producción: un test que pasa sin comprobar nada es peor que ninguno.

## Convenciones del repo (síguelas, mira ejemplos antes de escribir)

- Archivo `*.spec.ts` junto al código (`rootDir` de Jest es `src`). Alias `@/` disponible.
- `describe`/`it` en español y describiendo el comportamiento: `it('usa 1 cuando 11 - residuo da 10', ...)`.
- **Dominio puro primero**: si la lógica está mezclada con Prisma o HTTP, propón extraerla a una función en `domain/` y pruébala directamente (ver `payments/domain/invoice-balance.ts`, `credit-notes/domain/credit-note-limit.ts`).
- **Servicios**: `Test.createTestingModule` con `PrismaService` sustituido por un objeto con `jest.fn()` solo para los métodos que se usan (ver `payments.service.spec.ts`, `credit-notes.service.spec.ts`). No conectes a una base real.
- **HTTP** (guards, límites, pipes): app de Nest mínima + `supertest` (ver `auth.controller.throttle.spec.ts`, `shared/http/upload-limits.spec.ts`).
- **SRI**: los casos de clave de acceso y XML ya existentes (`access-key.service.spec.ts`, `xml-generator.service.spec.ts`) son el modelo: datos concretos y la regla de la ficha técnica en el nombre del test.
- Montos: usa valores que ejerciten redondeo a 2 decimales y Decimals que llegan como texto.

## Cómo trabajar

1. Lee el código a cubrir y sus llamadores. Lista los comportamientos observables (incluidos errores y casos límite: empresa sin módulo, registro de otra empresa, montos en cero, IVA mixto).
2. Escribe los tests; cada `it` comprueba un comportamiento.
3. Ejecuta `pnpm --filter facturacion-core test -- <ruta>` hasta que pasen. Si un test revela un bug real, **no lo arregles en silencio**: deja el test marcado con `it.failing` o coméntalo en tu informe con el escenario.
4. Ejecuta `pnpm --filter facturacion-core lint` para no dejar errores.

Termina con un resumen en español: qué cubriste, qué no y por qué, y cualquier bug encontrado.
