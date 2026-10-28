---
name: new-api-endpoint
description: Añade un endpoint a facturacion-core y lo conecta con la web (DTO, controlador con guards, servicio con aislamiento por empresa, Swagger, test, cliente de API y hook de React Query). Úsalo al crear o ampliar una ruta de la API.
---

# Nuevo endpoint de punta a punta

Sigue la arquitectura del módulo (`presentation/` → `application/` → `domain/` → `infrastructure/`). Mira un módulo parecido antes de escribir; `payments` es un buen modelo reciente.

## 1. Backend (`packages/facturacion-core/src/modules/<módulo>/`)

1. **DTO** en `application/dto/`: `class-validator` en cada campo, `@ApiProperty` para Swagger. El `ValidationPipe` global usa `whitelist`, así que un campo sin decorador se descarta en silencio.
2. **Lógica de negocio pura** (cálculos, reglas SRI, saldos) en `domain/` como funciones sin Prisma ni Nest, con su `*.spec.ts`.
3. **Servicio** en `application/services/`:
   - Recibe `companyId` como parámetro y **filtra todas las consultas por él**. Para operar por `id`, primero `findFirst({ where: { id, companyId } })` y `NotFoundException` si no existe.
   - Si conecta registros relacionados (cliente, producto, establecimiento), verifica que también sean de la empresa.
   - Usa `$transaction` cuando escribe en varias tablas.
4. **Controlador** en `presentation/controllers/`:
   - `@UseGuards(JwtAuthGuard, ...)` en la clase. Añade `EmailVerifiedGuard` si crea datos de negocio y `RequireModuleGuard` + `@RequireModule(...)` si pertenece a un módulo de pago.
   - El `companyId` sale del usuario autenticado (`req.user.userId` → `user.companyId`), nunca del body/query/params. Hoy cada controlador tiene su `getCompanyId` privado; reutiliza el del controlador.
   - Subidas: `FileInterceptor('file', <constante de shared/http/upload-limits.ts>)`.
   - `@ApiOperation` y `@ApiResponse` en cada ruta.
5. **Tests**: el dominio con casos concretos; el servicio con `PrismaService` mockeado, incluyendo el caso "registro de otra empresa → 404".

## 2. Web (`packages/web-facturacion/`)

1. **Cliente** en `lib/api/<recurso>.ts`: tipos de la respuesta (los `Decimal` de Prisma llegan como **texto**: conviértelos con `Number()` antes de sumar) y funciones que usan `apiClient` de `./client`.
2. **Hook** en `lib/hooks/use-<recurso>.ts` con React Query: claves en un objeto `<recurso>Keys`, `useQuery` con `enabled` si depende de un id, `useMutation` que invalida las claves afectadas y muestra `toast` de éxito/error.
3. **UI**: componentes de `components/ui/`; formularios con React Hook Form + Zod (`lib/validations/`).

## 3. Verificación

```bash
pnpm --filter facturacion-core test
pnpm --filter facturacion-core lint
pnpm --filter web-facturacion type-check
pnpm --filter web-facturacion lint
```

Antes del PR, pide una revisión al agente `tenant-security-reviewer` (y a `sri-compliance-reviewer` si toca emisión).
