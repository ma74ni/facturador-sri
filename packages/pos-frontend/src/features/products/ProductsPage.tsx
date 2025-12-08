import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductos, useCategorias, useDeleteProducto } from '@/lib/hooks/useProductos';
import { ProductForm } from './components/ProductForm';
import type { Producto } from '@/lib/types';
import { toast } from 'sonner';

export function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);

  // Queries
  const { data: productos = [], isLoading } = useProductos();
  const { data: categorias = [] } = useCategorias();

  // Mutations
  const deleteProducto = useDeleteProducto();

  // Filtrado
  const filteredProductos = productos.filter((producto) => {
    const matchesSearch =
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.sku.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategoria =
      selectedCategoria === 'all' || producto.categoriaId === selectedCategoria;

    return matchesSearch && matchesCategoria;
  });

  const handleCreate = () => {
    setEditingProducto(null);
    setIsFormOpen(true);
  };

  const handleEdit = (producto: Producto) => {
    setEditingProducto(producto);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (window.confirm(`¿Estás seguro de desactivar el producto "${nombre}"?`)) {
      await deleteProducto.mutateAsync(id);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProducto(null);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-EC', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona el catálogo de productos del sistema
          </p>
        </div>
        <Button onClick={handleCreate} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productos.length}</div>
            <p className="text-xs text-muted-foreground">
              {productos.filter((p) => p.activo).length} activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categorias.length}</div>
            <p className="text-xs text-muted-foreground">
              {categorias.filter((c) => c.activa).length} activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Precio Promedio</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {productos.length > 0
                ? formatCurrency(
                    productos.reduce((sum, p) => sum + Number(p.precioParaServir), 0) /
                      productos.length
                  )
                : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Para servir</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busca y filtra productos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Productos ({filteredProductos.length})</CardTitle>
          <CardDescription>
            Lista completa de productos del sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Cargando productos...
            </div>
          ) : filteredProductos.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || selectedCategoria !== 'all'
                  ? 'No se encontraron productos con los filtros aplicados'
                  : 'No hay productos registrados. Crea uno para empezar.'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Imagen</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProductos.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell>
                        {producto.imagenUrl ? (
                          <img
                            src={producto.imagenUrl}
                            alt={producto.nombre}
                            className="h-12 w-12 rounded object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{producto.nombre}</div>
                          {producto.descripcion && (
                            <div className="text-sm text-muted-foreground line-clamp-1">
                              {producto.descripcion}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {producto.sku}
                        </code>
                      </TableCell>
                      <TableCell>
                        {producto.categoria ? (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: producto.categoria.color,
                              color: producto.categoria.color,
                            }}
                          >
                            {producto.categoria.nombre}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            Sin categoría
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">Servir:</span>
                            <span className="font-mono">{formatCurrency(Number(producto.precioParaServir))}</span>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">Llevar:</span>
                            <span className="font-mono">{formatCurrency(Number(producto.precioParaLlevar))}</span>
                          </div>
                          {producto.precioDelivery && (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">Delivery:</span>
                              <span className="font-mono">{formatCurrency(Number(producto.precioDelivery))}</span>
                            </div>
                          )}
                        </div>
                        {producto.precioIncluyeIVA && (
                          <p className="text-xs text-muted-foreground text-right mt-1">
                            *Incluye IVA
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={producto.activo ? 'default' : 'secondary'}>
                          {producto.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(producto)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(producto.id, producto.nombre)}
                            disabled={deleteProducto.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Form Dialog */}
      <ProductForm
        open={isFormOpen}
        onClose={handleCloseForm}
        producto={editingProducto}
      />
    </div>
  );
}
