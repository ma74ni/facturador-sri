import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Store, User, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { localesApi } from '@/lib/api/locales';
import { colaboradoresApi } from '@/lib/api/colaboradores';
import { useSessionStore } from '@/store/sessionStore';

export function LoginScreen() {
  const navigate = useNavigate();
  const { setLocal, setColaborador } = useSessionStore();

  const [selectedLocalId, setSelectedLocalId] = useState<string>('');
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>('');
  const [pin, setPin] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Cargar locales
  const { data: locales, isLoading: isLoadingLocales } = useQuery({
    queryKey: ['locales'],
    queryFn: localesApi.getAll,
  });

  // Cargar colaboradores del local seleccionado
  const { data: colaboradores, isLoading: isLoadingColaboradores } = useQuery({
    queryKey: ['colaboradores', selectedLocalId],
    queryFn: () => colaboradoresApi.getByLocal(selectedLocalId),
    enabled: !!selectedLocalId,
  });

  const handleLogin = async () => {
    if (!selectedLocalId || !selectedColaboradorId || !pin) {
      toast.error('Por favor complete todos los campos');
      return;
    }

    if (pin.length !== 4) {
      toast.error('El PIN debe tener 4 dígitos');
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await colaboradoresApi.validatePin(selectedColaboradorId, pin);

      if (!isValid) {
        toast.error('PIN incorrecto');
        setPin('');
        return;
      }

      const local = locales?.find((l) => l.id === selectedLocalId);
      const colaborador = colaboradores?.find((c) => c.id === selectedColaboradorId);

      if (local && colaborador) {
        setLocal(local);
        setColaborador(colaborador);
        toast.success(`Bienvenido ${colaborador.nombre} ${colaborador.apellido}`);
        navigate('/turno');
      }
    } catch (error: any) {
      console.error('Error validating PIN:', error);
      toast.error(error.response?.data?.message || 'Error al validar el PIN');
    } finally {
      setIsValidating(false);
    }
  };

  const handlePinKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Sistema POS</CardTitle>
          <CardDescription>Heladería - Punto de Venta</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Selección de Local */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              <Store className="mb-1 mr-2 inline h-4 w-4" />
              Local
            </label>
            <Select
              value={selectedLocalId}
              onValueChange={(value) => {
                setSelectedLocalId(value);
                setSelectedColaboradorId('');
              }}
              disabled={isLoadingLocales}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un local" />
              </SelectTrigger>
              <SelectContent>
                {locales?.map((local) => (
                  <SelectItem key={local.id} value={local.id}>
                    {local.nombre} - {local.ciudad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selección de Colaborador */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              <User className="mb-1 mr-2 inline h-4 w-4" />
              Colaborador
            </label>
            <Select
              value={selectedColaboradorId}
              onValueChange={setSelectedColaboradorId}
              disabled={!selectedLocalId || isLoadingColaboradores}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione un colaborador" />
              </SelectTrigger>
              <SelectContent>
                {colaboradores?.map((colaborador) => (
                  <SelectItem key={colaborador.id} value={colaborador.id}>
                    {colaborador.nombre} {colaborador.apellido} - {colaborador.rol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              <KeyRound className="mb-1 mr-2 inline h-4 w-4" />
              PIN (4 dígitos)
            </label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyPress={handlePinKeyPress}
              placeholder="••••"
              disabled={!selectedColaboradorId}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          {/* Botón de Login */}
          <Button
            onClick={handleLogin}
            disabled={!selectedLocalId || !selectedColaboradorId || !pin || isValidating}
            className="w-full"
            size="lg"
          >
            {isValidating ? 'Validando...' : 'Iniciar Sesión'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
