'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NumberInput } from '@/components/ui/number-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateInvoiceDto, InvoiceItemDto } from '@/lib/api/invoices';
import { Customer, CreateCustomerDto, customersApi } from '@/lib/api/customers';
import { Product, CreateProductDto, productsApi } from '@/lib/api/products';
import { Establishment } from '@/lib/api/establishments';
import { AlertCircle, Plus, Trash2, UserPlus, PackagePlus, Search, Check } from 'lucide-react';
import { getTaxPercentage } from '@/lib/constants/tax-codes';
import { CustomerDialog } from '@/components/customers/customer-dialog';
import { ProductDialog } from '@/components/products/product-dialog';
import { useToast } from '@/hooks/use-toast';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CreateInvoiceDto) => Promise<void>;
  customers: Customer[];
  products: Product[];
  establishments: Establishment[];
  onCustomerCreated?: () => void;
  onProductCreated?: () => void;
}

interface InvoiceItemWithCalc extends InvoiceItemDto {
  taxPercentageCode?: string;
  subtotal: number;
  taxValue: number;
  total: number;
}

// Formas de pago del SRI
const PAYMENT_METHODS = [
  { code: '01', label: 'Efectivo', description: 'Sin utilización del sistema financiero' },
  { code: '19', label: 'Tarjeta de Crédito', description: 'Visa, Mastercard, etc.' },
  { code: '16', label: 'Tarjeta de Débito', description: 'Débito bancario' },
  { code: '17', label: 'Transferencia / Dinero Electrónico', description: 'Transferencias bancarias' },
  { code: '20', label: 'Otros con Sistema Financiero', description: 'Otros métodos bancarios' },
  { code: '15', label: 'Compensación de Deudas', description: 'Compensación' },
  { code: '18', label: 'Tarjeta Prepago', description: 'Tarjetas prepagadas' },
  { code: '21', label: 'Endoso de Títulos', description: 'Endoso' },
];

// Helper function to get customer display name
const getCustomerDisplayName = (customer: Customer): string => {
  if (customer.businessName) {
    return customer.businessName;
  }
  if (customer.firstName && customer.lastName) {
    return `${customer.firstName} ${customer.lastName}`;
  }
  if (customer.firstName) {
    return customer.firstName;
  }
  if (customer.lastName) {
    return customer.lastName;
  }
  return customer.identification;
};

export function InvoiceDialog({
  open,
  onOpenChange,
  onSave,
  customers,
  products,
  establishments,
  onCustomerCreated,
  onProductCreated,
}: InvoiceDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedEstablishment, setSelectedEstablishment] = useState<string>('');
  const [selectedEmissionPoint, setSelectedEmissionPoint] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [items, setItems] = useState<InvoiceItemWithCalc[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('01');
  const [isRimpe, setIsRimpe] = useState<boolean>(false);

  // Item being added
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [discount, setDiscount] = useState<number>(0);

  // Nested dialogs
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);

  // Customer search/combobox state
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const selectedEstablishmentData = establishments.find(e => e.id === selectedEstablishment);
  const emissionPoints = selectedEstablishmentData?.emissionPoints || [];

  // Filter customers based on search query
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) {
      return customers;
    }

    const query = customerSearchQuery.toLowerCase();
    return customers.filter((customer) => {
      const displayName = getCustomerDisplayName(customer).toLowerCase();
      const identification = customer.identification.toLowerCase();
      const firstName = customer.firstName?.toLowerCase() || '';
      const lastName = customer.lastName?.toLowerCase() || '';

      return (
        displayName.includes(query) ||
        identification.includes(query) ||
        firstName.includes(query) ||
        lastName.includes(query)
      );
    });
  }, [customers, customerSearchQuery]);

  // Get selected customer display name
  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);
  const selectedCustomerDisplay = selectedCustomerData
    ? getCustomerDisplayName(selectedCustomerData)
    : '';

  useEffect(() => {
    if (!open) {
      // Reset form
      setSelectedCustomer('');
      setSelectedEstablishment('');
      setSelectedEmissionPoint('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setItems([]);
      setPaymentMethod('01');
      setIsRimpe(false);
      setSelectedProduct('');
      setQuantity(1);
      setDiscount(0);
      setErrors({});
      setCustomerSearchQuery('');
      setShowCustomerDropdown(false);
    }
  }, [open]);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#customer-combobox-container')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomerDropdown]);

  const calculateItemTotals = (
    unitPrice: number,
    qty: number,
    disc: number,
    taxCode: string
  ): { subtotal: number; taxValue: number; total: number } => {
    const subtotal = unitPrice * qty;
    const subtotalAfterDiscount = subtotal - disc;
    const taxPercentage = getTaxPercentage(taxCode);
    const taxValue = subtotalAfterDiscount * (taxPercentage / 100);
    const total = subtotalAfterDiscount + taxValue;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxValue: Number(taxValue.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  const handleAddItem = () => {
    if (!selectedProduct) {
      setErrors({ ...errors, product: 'Selecciona un producto' });
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    if (quantity <= 0) {
      setErrors({ ...errors, quantity: 'La cantidad debe ser mayor a 0' });
      return;
    }

    const unitPrice = Number(product.unitPrice);
    const totals = calculateItemTotals(unitPrice, quantity, discount, product.taxPercentageCode);

    const newItem: InvoiceItemWithCalc = {
      mainCode: product.mainCode,
      description: product.name,
      quantity,
      unitPrice,
      discount,
      productId: product.id,
      taxPercentageCode: product.taxPercentageCode,
      ...totals,
    };

    setItems([...items, newItem]);
    setSelectedProduct('');
    setQuantity(1);
    setDiscount(0);
    setErrors({ ...errors, product: '', quantity: '', items: '' });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totals = items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      discount: acc.discount + item.discount,
      tax: acc.tax + item.taxValue,
      total: acc.total + item.total,
    }),
    { subtotal: 0, discount: 0, tax: 0, total: 0 }
  );

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedCustomer) {
      newErrors.customer = 'Selecciona un cliente';
    }

    if (!selectedEstablishment) {
      newErrors.establishment = 'Selecciona un establecimiento';
    }

    if (!selectedEmissionPoint) {
      newErrors.emissionPoint = 'Selecciona un punto de emisión';
    }

    if (!issueDate) {
      newErrors.issueDate = 'Ingresa la fecha de emisión';
    }

    if (items.length === 0) {
      newErrors.items = 'Agrega al menos un producto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (sendToSri: boolean = false) => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const invoiceData: CreateInvoiceDto = {
        issueDate,
        customerId: selectedCustomer,
        establishmentId: selectedEstablishment,
        emissionPointId: selectedEmissionPoint,
        items: items.map(({ subtotal, taxValue, total, taxPercentageCode, ...item }) => item),
        metadata: {
          paymentMethod,
          isRimpe,
          source: 'WEB_FACTURACION',
          sendToSri, // Indicar si debe enviar al SRI
        },
      };

      await onSave(invoiceData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (data: CreateCustomerDto) => {
    try {
      const newCustomer = await customersApi.create(data);
      const customerName = getCustomerDisplayName(newCustomer);

      toast({
        title: 'Cliente creado',
        description: `${customerName} ha sido creado exitosamente.`,
      });
      setShowCustomerDialog(false);
      setSelectedCustomer(newCustomer.id);
      if (onCustomerCreated) await onCustomerCreated();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el cliente',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleCreateProduct = async (data: CreateProductDto) => {
    try {
      const newProduct = await productsApi.create(data);
      toast({
        title: 'Producto creado',
        description: `${newProduct.name} ha sido creado exitosamente.`,
      });
      setShowProductDialog(false);
      setSelectedProduct(newProduct.id);
      if (onProductCreated) await onProductCreated();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo crear el producto',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nueva Factura Electrónica</DialogTitle>
          <DialogDescription className="text-base">
            Complete los datos para generar la factura. Todos los campos marcados con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* SECCIÓN 1: Datos Generales */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">1. Datos Generales</h3>
            <div className="grid gap-4 md:grid-cols-2">
            {/* Cliente - Searchable Combobox */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="customer">Cliente *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomerDialog(true)}
                  className="h-7 text-xs"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  Nuevo Cliente
                </Button>
              </div>
              <div id="customer-combobox-container" className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="customer"
                    placeholder={selectedCustomerDisplay || "Buscar por nombre, apellido o identificación..."}
                    value={customerSearchQuery}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className={`pl-9 ${errors.customer ? 'border-red-500' : ''}`}
                  />
                  {selectedCustomer && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomer('');
                        setCustomerSearchQuery('');
                        setErrors({ ...errors, customer: '' });
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100"
                    >
                      ×
                    </Button>
                  )}
                </div>
                {showCustomerDropdown && (customerSearchQuery || !selectedCustomer) && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.length > 0 ? (
                      <div className="py-1">
                        {filteredCustomers.map((customer) => {
                          const displayName = getCustomerDisplayName(customer);
                          const isSelected = selectedCustomer === customer.id;
                          return (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(customer.id);
                                setCustomerSearchQuery('');
                                setShowCustomerDropdown(false);
                                setErrors({ ...errors, customer: '' });
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-slate-100 flex items-center justify-between ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-sm">{displayName}</div>
                                <div className="text-xs text-slate-500">{customer.identification}</div>
                              </div>
                              {isSelected && <Check className="h-4 w-4 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-slate-500">
                        No se encontraron clientes
                      </div>
                    )}
                  </div>
                )}
              </div>
              {errors.customer && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.customer}</span>
                </div>
              )}
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="issueDate">Fecha de Emisión *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={errors.issueDate ? 'border-red-500' : ''}
              />
              {errors.issueDate && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.issueDate}</span>
                </div>
              )}
            </div>

            {/* Establecimiento */}
            <div className="space-y-2">
              <Label htmlFor="establishment">Establecimiento *</Label>
              <Select value={selectedEstablishment} onValueChange={(value) => {
                setSelectedEstablishment(value);
                setSelectedEmissionPoint('');
              }}>
                <SelectTrigger className={errors.establishment ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Seleccionar establecimiento" />
                </SelectTrigger>
                <SelectContent>
                  {establishments.map((est) => (
                    <SelectItem key={est.id} value={est.id}>
                      {est.code} - {est.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.establishment && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.establishment}</span>
                </div>
              )}
            </div>

            {/* Punto de Emisión */}
            <div className="space-y-2">
              <Label htmlFor="emissionPoint">Punto de Emisión *</Label>
              <Select
                value={selectedEmissionPoint}
                onValueChange={setSelectedEmissionPoint}
                disabled={!selectedEstablishment}
              >
                <SelectTrigger className={errors.emissionPoint ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {emissionPoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.emissionPoint && (
                <div className="flex items-center gap-1 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{errors.emissionPoint}</span>
                </div>
              )}
            </div>
            </div>
          </div>

          {/* SECCIÓN 2: Productos */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold text-slate-700 mb-4">2. Productos y Servicios</h3>
            <div className="border rounded-lg p-4 bg-slate-50">
              <h4 className="font-medium mb-4 text-slate-600">Agregar Producto</h4>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="product">Producto</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductDialog(true)}
                    className="h-7 text-xs"
                  >
                    <PackagePlus className="h-3 w-3 mr-1" />
                    Nuevo Producto
                  </Button>
                </div>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${Number(product.unitPrice).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Cantidad</Label>
                <NumberInput
                  id="quantity"
                  value={quantity}
                  onChange={setQuantity}
                  allowDecimals={false}
                  min={1}
                  placeholder="Ej: 5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount">Descuento ($)</Label>
                <NumberInput
                  id="discount"
                  value={discount}
                  onChange={setDiscount}
                  allowDecimals={true}
                  decimalPlaces={2}
                  min={0}
                  placeholder="Ej: 10.50"
                />
              </div>
            </div>
            <Button type="button" onClick={handleAddItem} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Agregar Producto
            </Button>
          </div>

          {/* Items Table */}
          {items.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unit</TableHead>
                    <TableHead className="text-right">Desc.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">${item.unitPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${item.discount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${item.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${item.taxValue.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">${item.total.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

            </div>
          )}

          {/* RESUMEN DE TOTALES - Más visible y claro */}
          {items.length > 0 && (
            <div className="mt-4 bg-white border-2 border-primary/20 rounded-lg shadow-md overflow-hidden">
              <div className="bg-primary/5 px-4 py-2 border-b border-primary/20">
                <h3 className="font-semibold text-primary text-sm uppercase tracking-wide">
                  Resumen de Factura
                </h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex justify-between items-center text-base">
                  <span className="text-slate-600">Subtotal (Base):</span>
                  <span className="font-semibold text-lg">${totals.subtotal.toFixed(2)}</span>
                </div>

                {totals.discount > 0 && (
                  <div className="flex justify-between items-center text-base text-red-600">
                    <span>Descuento:</span>
                    <span className="font-semibold text-lg">-${totals.discount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-base border-t border-dashed border-slate-300 pt-3">
                  <span className="text-slate-700 font-medium">Base Imponible:</span>
                  <span className="font-semibold text-lg">${(totals.subtotal - totals.discount).toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center text-base">
                  <span className="text-slate-600">IVA (15%):</span>
                  <span className="font-semibold text-lg text-blue-600">${totals.tax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center border-t-2 border-primary/30 pt-4 mt-4">
                  <span className="text-xl font-bold text-primary uppercase">Total a Pagar:</span>
                  <span className="text-3xl font-bold text-primary">${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

            {errors.items && (
              <div className="flex items-center gap-1 text-sm text-red-500 mt-2">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.items}</span>
              </div>
            )}
            </div>
          </div>

          {/* SECCIÓN 3: Forma de Pago */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-4">3. Forma de Pago y Opciones</h3>
            <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod" className="text-base font-semibold">
                Forma de Pago *
              </Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue>
                    {PAYMENT_METHODS.find(m => m.code === paymentMethod)?.label || 'Seleccionar forma de pago'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.code} value={method.code} className="py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{method.label}</span>
                        <span className="text-xs text-slate-500">{method.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Método de pago que utilizará el cliente
              </p>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <input
                type="checkbox"
                id="rimpe-checkbox"
                checked={isRimpe}
                onChange={(e) => setIsRimpe(e.target.checked)}
                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
              />
              <label htmlFor="rimpe-checkbox" className="cursor-pointer flex-1">
                <span className="text-sm font-semibold text-slate-700 block">
                  Régimen RIMPE
                </span>
                <span className="text-xs text-slate-500">
                  Contribuyente negocio popular - No sujeto a retención
                </span>
              </label>
            </div>

            {isRimpe && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota RIMPE:</strong> Esta factura incluirá la leyenda "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE"
                  en la información adicional del XML. No se aplicará retención de IVA ni renta.
                </p>
              </div>
            )}
            </div>
          </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Firmar y Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Nested Dialogs */}
      <CustomerDialog
        open={showCustomerDialog}
        onOpenChange={setShowCustomerDialog}
        onSave={handleCreateCustomer}
      />

      <ProductDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onSave={handleCreateProduct}
      />
    </Dialog>
  );
}
