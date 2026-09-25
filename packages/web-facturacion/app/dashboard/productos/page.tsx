'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, DollarSign, Package, Loader2 } from 'lucide-react';
import { Product, CreateProductDto } from '@/lib/api/products';
import { ProductDialog } from '@/components/products/product-dialog';
import { useTaxCodes, getTaxLabel } from '@/lib/hooks/use-tax-codes';
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@/lib/hooks/use-products';
import { usePagination } from '@/lib/hooks/use-pagination';
import { Pagination } from '@/components/ui/pagination';
import { FilterBar, FilterField } from '@/components/ui/filter-bar';
import { NativeSelect } from '@/components/ui/native-select';

type ProductSort = 'recent' | 'name' | 'priceAsc' | 'priceDesc';

// Margen sobre el costo: (precio - costo) / costo
function getPricing(product: Product) {
  const unitPrice = Number(product.unitPrice);
  const cost = product.cost ? Number(product.cost) : null;
  const margen = cost ? ((unitPrice - cost) / cost) * 100 : null;
  return { unitPrice, cost, margen };
}

function getMargenColor(margen: number) {
  return margen > 30 ? 'text-green-600' : margen > 15 ? 'text-yellow-600' : 'text-red-600';
}

export default function ProductosPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [taxFilter, setTaxFilter] = useState('all');
  const [sortBy, setSortBy] = useState<ProductSort>('recent');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | undefined>();
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // React Query hooks
  const { data: products = [], isLoading } = useProducts();
  const { data: taxCodesData } = useTaxCodes();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const handleCreate = () => {
    setSelectedProduct(undefined);
    setDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setDialogOpen(true);
  };

  const handleSave = async (data: CreateProductDto) => {
    try {
      if (selectedProduct) {
        await updateProduct.mutateAsync({ id: selectedProduct.id, data });
      } else {
        await createProduct.mutateAsync(data);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled by mutation hooks
      throw error;
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;

    try {
      await deleteProduct.mutateAsync(productToDelete.id);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (error) {
      // Error handled by mutation hook
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  // Solo los tipos de IVA que efectivamente usa algún producto
  const taxOptions = Array.from(new Set(products.map((p) => p.taxPercentageCode))).sort();

  const filteredProducts = products.filter(product => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(searchLower) ||
      product.mainCode.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower);
    const matchesTax = taxFilter === 'all' || product.taxPercentageCode === taxFilter;
    return matchesSearch && matchesTax;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'es');
      case 'priceAsc':
        return Number(a.unitPrice) - Number(b.unitPrice);
      case 'priceDesc':
        return Number(b.unitPrice) - Number(a.unitPrice);
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  const clearFilters = () => {
    setSearchTerm('');
    setTaxFilter('all');
  };

  const pagination = usePagination(filteredProducts, 10, `${searchTerm}|${taxFilter}|${sortBy}`);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Administra tu catálogo de productos y servicios
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      {/* Productos Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Catálogo de Productos (
            {filteredProducts.length === products.length
              ? products.length
              : `${filteredProducts.length} de ${products.length}`}
            )
          </CardTitle>
          <CardDescription>
            Todos los productos y servicios registrados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {products.length > 0 && (
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Buscar por nombre, código o descripción..."
              activeCount={taxFilter !== 'all' ? 1 : 0}
              onClear={clearFilters}
            >
              <FilterField label="IVA">
                <NativeSelect value={taxFilter} onChange={(e) => setTaxFilter(e.target.value)}>
                  <option value="all">Todos</option>
                  {taxOptions.map((code) => (
                    <option key={code} value={code}>
                      {getTaxLabel(taxCodesData?.taxCodes || [], code)}
                    </option>
                  ))}
                </NativeSelect>
              </FilterField>
              <FilterField label="Ordenar por">
                <NativeSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as ProductSort)}>
                  <option value="recent">Más recientes</option>
                  <option value="name">Nombre (A–Z)</option>
                  <option value="priceAsc">Menor precio</option>
                  <option value="priceDesc">Mayor precio</option>
                </NativeSelect>
              </FilterField>
            </FilterBar>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-slate-100 p-6 mb-4">
                <Package className="h-12 w-12 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {products.length === 0
                  ? 'No hay productos registrados'
                  : 'No se encontraron resultados'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {products.length === 0
                  ? 'Agrega productos o servicios a tu catálogo para poder incluirlos en las facturas.'
                  : 'Ningún producto coincide con la búsqueda o los filtros'}
              </p>
              {products.length === 0 ? (
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primer Producto
                </Button>
              ) : (
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Vista mobile: una card por producto */}
              <div className="md:hidden space-y-3">
                {pagination.pageItems.map((product) => {
                  const { unitPrice, cost, margen } = getPricing(product);
                  return (
                    <div key={product.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">{product.mainCode}</p>
                          <p className="font-medium text-sm break-words">{product.name}</p>
                        </div>
                        <p className="font-semibold text-sm flex-shrink-0">${unitPrice.toFixed(2)}</p>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {getTaxLabel(taxCodesData?.taxCodes || [], product.taxPercentageCode)}
                          </Badge>
                          {cost !== null && <span>Costo: ${cost.toFixed(2)}</span>}
                          {margen !== null && (
                            <span className={getMargenColor(margen)}>Margen: {margen.toFixed(1)}%</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(product)}
                            className="h-9 w-9 p-0"
                            aria-label="Editar producto"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(product)}
                            className="h-9 w-9 p-0"
                            aria-label="Eliminar producto"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vista desktop: tabla */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="hidden lg:table-cell">IVA</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.pageItems.map((product) => {
                      const { unitPrice, cost, margen } = getPricing(product);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs text-muted-foreground">
                                {product.mainCode}
                              </span>
                              <span className="font-medium text-sm">
                                {product.name}
                              </span>
                              {/* IVA debajo del nombre cuando no hay columna IVA */}
                              <div className="lg:hidden">
                                <Badge variant="outline" className="text-xs">
                                  {getTaxLabel(taxCodesData?.taxCodes || [], product.taxPercentageCode)}
                                </Badge>
                              </div>
                              <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                {cost !== null && <span>Costo: ${cost.toFixed(2)}</span>}
                                {margen !== null && (
                                  <span className={getMargenColor(margen)}>Margen: {margen.toFixed(1)}%</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {product.description || '-'}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant="outline">
                              {getTaxLabel(taxCodesData?.taxCodes || [], product.taxPercentageCode)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm">
                            ${unitPrice.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                                className="h-9 w-9 p-0"
                                aria-label="Editar producto"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(product)}
                                className="h-9 w-9 p-0"
                                aria-label="Eliminar producto"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <Pagination {...pagination} onPageChange={pagination.setPage} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      {products.length > 0 && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Productos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
              <p className="text-xs text-muted-foreground">
                productos registrados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Precio Promedio
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${products.length > 0 ? (products.reduce((sum, p) => sum + Number(p.unitPrice), 0) / products.length).toFixed(2) : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                precio venta
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Costo Promedio
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${products.filter(p => p.cost).length > 0
                  ? (products.reduce((sum, p) => sum + Number(p.cost || 0), 0) / products.filter(p => p.cost).length).toFixed(2)
                  : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                costo promedio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Con IVA 15%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {products.filter(p => ['2', '3'].includes(p.taxPercentageCode)).length}
              </div>
              <p className="text-xs text-muted-foreground">
                productos gravados
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        product={selectedProduct}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el producto{' '}
              <strong>{productToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
