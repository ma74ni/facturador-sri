# Facturador SRI

Sistema de facturación electrónica conforme al SRI de Ecuador: generación de XML (v2.32), firma XAdES-BES, envío y autorización ante el SRI, RIDE en PDF y envío por email. Multi-empresa.

## Estructura

```
facturador-sri/
├── packages/
│   ├── facturacion-core/   # API NestJS + Prisma (Render)
│   └── web-facturacion/    # Web Next.js (Netlify)
├── signing-service/        # Microservicio Java de firma XAdES-BES (Render)
├── render.yaml             # Servicios de Render (producción y dev)
├── PRODUCCION.md           # Ambientes, dominios y paso a producción
└── DEPLOY-RENDER.md        # Despliegue en Render
```

El POS de la heladería vive en su propio repositorio (`new-lattia-pos`) y consume la API de este.

## Desarrollo local

Requisitos: Node ≥ 18, pnpm ≥ 8, Docker.

```bash
pnpm install
docker compose up -d                                   # PostgreSQL en :5432
(cd signing-service && docker compose up -d)           # firma en :18081
cp .env-example packages/facturacion-core/.env         # completar valores
echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1" > packages/web-facturacion/.env.local

cd packages/facturacion-core
pnpm prisma:generate && pnpm prisma:migrate && pnpm prisma:seed
cd ../..

pnpm dev:core   # API en http://localhost:3000/api/v1 (Swagger en /api/docs)
pnpm dev:web    # Web en http://localhost:3001
```

## Comandos

```bash
pnpm build:all
pnpm test:all
pnpm lint:all
pnpm --filter facturacion-core test:cov
pnpm --filter web-facturacion type-check
```

## Documentación

- [CLAUDE.md](CLAUDE.md): arquitectura y convenciones del código.
- [packages/facturacion-core/README.md](packages/facturacion-core/README.md)
- [packages/web-facturacion/README.md](packages/web-facturacion/README.md)
- [signing-service/README.md](signing-service/README.md)
