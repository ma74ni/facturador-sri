import { Module } from '@nestjs/common';
import { ProductosService } from './application/services/productos.service';
import { CategoriasService } from './application/services/categorias.service';
import { ModificadoresService } from './application/services/modificadores.service';
import { PrecioResolverService } from './application/services/precio-resolver.service';
import { ProductosController } from './presentation/controllers/productos.controller';
import { CategoriasController } from './presentation/controllers/categorias.controller';
import { ModificadoresController } from './presentation/controllers/modificadores.controller';

@Module({
  controllers: [
    ProductosController,
    CategoriasController,
    ModificadoresController,
  ],
  providers: [
    ProductosService,
    CategoriasService,
    ModificadoresService,
    PrecioResolverService,
  ],
  exports: [
    ProductosService,
    CategoriasService,
    ModificadoresService,
    PrecioResolverService,
  ],
})
export class ProductosModule {}
