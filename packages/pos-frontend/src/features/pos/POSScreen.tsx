import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function POSScreen() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Punto de Venta</h1>
        <p className="text-muted-foreground">Gestiona las ventas y pedidos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShoppingCart className="mr-2 h-5 w-5" />
            Sistema POS
          </CardTitle>
          <CardDescription>
            Pantalla principal del punto de venta - En desarrollo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Próximamente</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              La pantalla de punto de venta estará disponible en la siguiente fase del desarrollo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
