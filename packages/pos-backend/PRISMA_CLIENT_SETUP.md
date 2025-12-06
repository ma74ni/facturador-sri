# Prisma Client Setup for pos-backend

## Problem

When multiple NestJS applications in a monorepo use different Prisma schemas, they conflict because both try to use the same Prisma Client at `node_modules/@prisma/client`. When one service regenerates its client, it overwrites the other's client, causing TypeScript errors like:

```
Property 'turno' does not exist on type 'PrismaService'
Property 'colaborador' does not exist on type 'PrismaService'
```

## Solution: Custom Prisma Client Location

The solution is to generate each Prisma Client in a separate location. This prevents conflicts and allows both services to coexist in the same monorepo.

## Implementation Steps

### 1. Configure Custom Output in `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client-pos"  // Custom location
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Update `PrismaService` Import

File: `src/shared/prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../node_modules/.prisma/client-pos';  // Custom import

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // ... rest of the service
}
```

### 3. Add TypeScript Path Alias

File: `tsconfig.json`

Add the following to the `compilerOptions.paths` section:

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"],
      "@prisma/client": ["node_modules/.prisma/client-pos"]  // Add this line
    }
  }
}
```

### 4. Create Webpack Configuration

File: `webpack.config.js` (create this file in the root of pos-backend)

```javascript
module.exports = function (options, webpack) {
  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve.alias,
        '@prisma/client': require.resolve('./node_modules/.prisma/client-pos'),
      },
    },
  };
};
```

### 5. Update NestJS CLI Configuration

File: `nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "webpack": true,
    "webpackConfigPath": "webpack.config.js",  // Add these two lines
    "tsConfigPath": "tsconfig.json"
  }
}
```

### 6. Regenerate Prisma Client

After making these changes, regenerate the Prisma Client:

```bash
cd packages/pos-backend
pnpm prisma:generate
```

This will generate the client at `node_modules/.prisma/client-pos` instead of the default location.

## Why This Works

1. **Custom Output**: The `output` setting in `schema.prisma` tells Prisma to generate the client in a custom location.
2. **TypeScript Alias**: The `tsconfig.json` path alias allows TypeScript to resolve `@prisma/client` imports correctly at compile time.
3. **Webpack Alias**: The `webpack.config.js` alias ensures the correct client is loaded at runtime when the application is bundled.
4. **NestJS CLI**: The `nest-cli.json` configuration tells NestJS to use the custom webpack config during the build process.

## Verification

After setup, you should be able to:

1. ✅ Import types from `@prisma/client` without errors
2. ✅ Use `PrismaService` with all your models (turno, colaborador, order, etc.)
3. ✅ Run both facturacion-core and pos-backend without conflicts
4. ✅ Build and run both services simultaneously

## Common Issues

### TypeScript Still Shows Errors

If TypeScript still shows errors after setup:

1. Restart your TypeScript server in VS Code (Cmd+Shift+P → "TypeScript: Restart TS Server")
2. Rebuild the project: `pnpm build`
3. Check that `node_modules/.prisma/client-pos` exists and contains the generated files

### Runtime Import Errors

If you get runtime errors about missing Prisma Client:

1. Make sure you ran `pnpm prisma:generate` after making the changes
2. Verify that `webpack.config.js` is in the root of pos-backend
3. Check that `nest-cli.json` has the webpack configuration

## Database Schema Separation

Note that pos-backend uses a separate PostgreSQL schema (`pos`) from facturacion-core (`public`):

- **facturacion-core**: `postgresql://...?schema=public`
- **pos-backend**: `postgresql://...?schema=pos`

This allows both services to use the same database but with separate tables, avoiding naming conflicts.

## References

- Prisma Custom Output: https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/generating-prisma-client#using-a-custom-output-path
- NestJS Webpack Configuration: https://docs.nestjs.com/cli/monorepo#cli-properties
