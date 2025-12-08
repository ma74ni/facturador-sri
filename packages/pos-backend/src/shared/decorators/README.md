# Authorization Decorators and Guards

Sistema de autorización basado en roles (RBAC) para controlar el acceso a endpoints según el rol del colaborador.

## Arquitectura

El sistema implementa los siguientes principios SOLID:

- **Single Responsibility**: Cada componente tiene una responsabilidad única
  - `@Roles()`: Solo establece metadata de roles requeridos
  - `RolesGuard`: Solo valida roles
  - `@CurrentUser()`: Solo extrae usuario del request

- **Open/Closed**: Extensible para nuevos roles sin modificar código existente

- **Dependency Inversion**: Los guards dependen de abstracciones (Reflector, ExecutionContext)

## Componentes

### 1. Decorator `@Roles(...roles)`

Establece qué roles tienen permiso para acceder a un endpoint.

**Ubicación**: `src/shared/decorators/roles.decorator.ts`

**Uso**:
```typescript
import { Roles } from '@shared/decorators';
import { RolColaborador } from '@prisma/client-pos';

// Un solo rol
@Roles(RolColaborador.ADMINISTRADOR)
@Post('/productos')
async createProducto() { }

// Múltiples roles
@Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
@Patch('/productos-local/:id')
async updateProductoLocal() { }
```

### 2. Guard `RolesGuard`

Valida que el usuario autenticado tenga uno de los roles requeridos.

**Ubicación**: `src/shared/guards/roles.guard.ts`

**Uso**:

#### Aplicar a nivel de controller (protege todos los endpoints)
```typescript
import { UseGuards } from '@nestjs/common';
import { RolesGuard } from '@shared/guards';

@Controller('productos')
@UseGuards(RolesGuard)
export class ProductosController { }
```

#### Aplicar a nivel de endpoint específico
```typescript
@Roles(RolColaborador.ADMINISTRADOR)
@UseGuards(RolesGuard)
@Post()
async create() { }
```

#### Combinar con otros guards (orden importa)
```typescript
// Primero autentica con JwtAuthGuard, luego autoriza con RolesGuard
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
@Patch(':id')
async update() { }
```

### 3. Decorator `@CurrentUser()`

Extrae el usuario autenticado desde el request HTTP.

**Ubicación**: `src/shared/decorators/current-user.decorator.ts`

**Uso**:
```typescript
import { CurrentUser, AuthenticatedUser } from '@shared/decorators';

@Get('/profile')
async getProfile(@CurrentUser() user: AuthenticatedUser) {
  return {
    colaboradorId: user.colaboradorId,
    localId: user.localId,
    rol: user.rol,
  };
}
```

## Flujo de Autorización

1. **Request entrante** → Controller endpoint
2. **AuthGuard** (opcional) → Valida JWT y establece `request.user`
3. **RolesGuard** → Lee metadata de `@Roles()` y compara con `user.rol`
4. **Autorización exitosa** → Ejecuta handler del controller
5. **Handler** → Puede usar `@CurrentUser()` para lógica adicional

```
┌─────────────┐
│  Cliente    │
│  (Request)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  JwtAuthGuard   │  ← Valida token JWT
│  (Autenticación)│  ← Establece request.user
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  RolesGuard     │  ← Lee @Roles metadata
│  (Autorización) │  ← Compara con user.rol
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│  Handler        │  ← Puede usar @CurrentUser()
└─────────────────┘
```

## Ejemplos de Uso por Rol

### ADMINISTRADOR - Gestión de Catálogo Central

```typescript
@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  // Solo ADMINISTRADOR puede crear productos en el catálogo central
  @Roles(RolColaborador.ADMINISTRADOR)
  @Post()
  async createProducto(@Body() dto: CreateProductoDto) {
    // Lógica de creación
  }

  // Solo ADMINISTRADOR puede editar productos centrales
  @Roles(RolColaborador.ADMINISTRADOR)
  @Patch(':id')
  async updateProducto(
    @Param('id') id: string,
    @Body() dto: UpdateProductoDto
  ) {
    // Lógica de actualización
  }

  // Solo ADMINISTRADOR puede eliminar productos
  @Roles(RolColaborador.ADMINISTRADOR)
  @Delete(':id')
  async deleteProducto(@Param('id') id: string) {
    // Lógica de eliminación
  }
}
```

### SUPERVISOR - Gestión de Local Específico

```typescript
@Controller('productos-local')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosLocalController {
  // SUPERVISOR y ADMINISTRADOR pueden editar productos de local
  @Roles(RolColaborador.SUPERVISOR, RolColaborador.ADMINISTRADOR)
  @Patch(':id')
  async updateProductoLocal(
    @Param('id') id: string,
    @Body() dto: UpdateProductoLocalDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    // Validar que SUPERVISOR solo edite su local
    if (user.rol === RolColaborador.SUPERVISOR) {
      const productoLocal = await this.productosService.findProductoLocal(id);

      if (productoLocal.localId !== user.localId) {
        throw new ForbiddenException(
          'No puedes editar productos de otro local'
        );
      }
    }

    // ADMINISTRADOR puede editar cualquier local
    // SUPERVISOR solo llega aquí si es su local
    return this.productosService.updateProductoLocal(id, dto);
  }
}
```

### VENDEDOR - Solo Lectura

```typescript
@Controller('productos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductosController {
  // Todos los roles pueden ver productos
  @Get()
  async findAll() {
    return this.productosService.findAll();
  }

  // Todos los roles pueden ver productos de su local
  @Get('local/:localId')
  async findByLocal(
    @Param('localId') localId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    // VENDEDOR y SUPERVISOR solo pueden ver su local
    if (
      user.rol !== RolColaborador.ADMINISTRADOR &&
      localId !== user.localId
    ) {
      throw new ForbiddenException('No puedes ver productos de otro local');
    }

    return this.productosService.findByLocal(localId);
  }
}
```

## Matriz de Permisos

| Operación | VENDEDOR | SUPERVISOR | ADMINISTRADOR |
|-----------|----------|------------|---------------|
| Ver productos de su local | ✅ | ✅ | ✅ |
| Ver productos de todos los locales | ❌ | ❌ | ✅ |
| Crear producto en catálogo central | ❌ | ❌ | ✅ |
| Editar producto en catálogo central | ❌ | ❌ | ✅ |
| Eliminar producto del catálogo | ❌ | ❌ | ✅ |
| Editar disponibilidad de su local | ❌ | ✅ | ✅ |
| Editar stock de su local | ❌ | ✅ | ✅ |
| Editar precios locales de su local | ❌ | ✅ | ✅ |
| Editar precios locales de otros locales | ❌ | ❌ | ✅ |
| Ver reportes de su local | ❌ | ✅ | ✅ |
| Ver reportes consolidados | ❌ | ❌ | ✅ |

## Testing

### Unit Tests para RolesGuard

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RolColaborador } from '@prisma/client-pos';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockExecutionContext({
      user: { rol: RolColaborador.VENDEDOR },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      RolColaborador.ADMINISTRADOR,
    ]);

    const context = createMockExecutionContext({
      user: { rol: RolColaborador.ADMINISTRADOR },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user does not have required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([
      RolColaborador.ADMINISTRADOR,
    ]);

    const context = createMockExecutionContext({
      user: { rol: RolColaborador.VENDEDOR },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
```

## Troubleshooting

### Error: "No se encontró información del usuario autenticado"

**Causa**: El guard se ejecuta pero `request.user` no está establecido.

**Solución**:
1. Asegúrate de que `JwtAuthGuard` (o similar) se ejecute **antes** de `RolesGuard`
2. Verifica que el middleware de autenticación establezca `request.user`

```typescript
// ❌ Incorrecto - RolesGuard primero
@UseGuards(RolesGuard, JwtAuthGuard)

// ✅ Correcto - JwtAuthGuard primero
@UseGuards(JwtAuthGuard, RolesGuard)
```

### Error: "Se requiere uno de los siguientes roles..."

**Causa**: El usuario está autenticado pero no tiene el rol requerido.

**Solución**:
1. Verificar que el usuario tenga el rol correcto en la base de datos
2. Asegurarse de que el token JWT contenga el rol actualizado

### Endpoint sin protección

**Causa**: Olvidaste aplicar el decorator `@Roles()` o el guard `RolesGuard`.

**Solución**:
```typescript
// ❌ Sin protección
@Post('/productos')
async create() { }

// ✅ Con protección
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolColaborador.ADMINISTRADOR)
@Post('/productos')
async create() { }
```

## Referencias

- [Arquitectura Completa](../../../ROLES_AND_PRICING_ARCHITECTURE.md)
- [Progreso Fase 1](../../../FASE1_PROGRESO.md)
- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
