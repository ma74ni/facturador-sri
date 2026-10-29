/**
 * Design system del facturador (Material Design 3 sobre Tailwind + Radix).
 *
 * - atoms: piezas indivisibles (botón, campo, etiqueta…).
 * - molecules: combinaciones de átomos con un propósito (tarjeta, diálogo…).
 * - organisms: secciones completas de una pantalla.
 *
 * Los colores, la tipografía y las formas vienen de `tailwind-preset` y `tokens.css`.
 */
export { cn } from './lib/cn';

export { Button, buttonVariants, type ButtonProps } from './atoms/button';
export { Badge, badgeVariants, type BadgeProps } from './atoms/badge';
export { Input, type InputProps } from './atoms/input';
export { NumberInput, type NumberInputProps } from './atoms/number-input';
export { fieldStyles } from './atoms/field-styles';
export { Textarea } from './atoms/textarea';
export { NativeSelect } from './atoms/native-select';
export { Label } from './atoms/label';
export { Spinner, type SpinnerProps } from './atoms/spinner';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './molecules/card';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './molecules/dialog';

export {
  Alert,
  AlertTitle,
  AlertDescription,
  alertVariants,
  type AlertProps,
} from './molecules/alert';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './molecules/table';

export { Pagination, type PaginationProps } from './molecules/pagination';

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './molecules/alert-dialog';

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './molecules/toast';
