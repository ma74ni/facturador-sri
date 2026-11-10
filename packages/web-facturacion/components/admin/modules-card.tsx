'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@facturador-sri/ui';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProductModules, useUpdateCompanyModules } from '@/lib/hooks/use-platform-admin';
import { enabledDependents, missingRequirements } from '@/lib/product-modules';
import type { ProductModule } from '@/lib/api/platform-admin';

interface ModulesCardProps {
  companyId: string;
  enabledModules: string[];
}

/** Lo que pide confirmar apagar un módulo del que dependen otros encendidos. */
interface PendingDisable {
  item: ProductModule;
  dependents: ProductModule[];
}

/**
 * Módulos de producto de una empresa (aparecen en su menú y habilitan su API). Los que requieren a
 * otro se muestran debajo de él y no se pueden encender sin él; apagar uno del que dependen otros
 * pide confirmar que se apagan también.
 */
export function ModulesCard({ companyId, enabledModules }: ModulesCardProps) {
  const { data: catalog = [], isLoading } = useProductModules();
  const update = useUpdateCompanyModules(companyId);
  const [selected, setSelected] = useState<string[]>(enabledModules);
  const [pending, setPending] = useState<PendingDisable | null>(null);

  // Por contenido, no por referencia: un refetch del detalle no borra lo que se está editando.
  const savedKey = enabledModules.join(',');
  useEffect(() => {
    setSelected(savedKey ? savedKey.split(',') : []);
  }, [savedKey]);

  const changed =
    selected.length !== enabledModules.length ||
    selected.some((key) => !enabledModules.includes(key));

  const byKey = new Map(catalog.map((item) => [item.key, item]));
  const nameOf = (key: string) => byKey.get(key)?.name ?? key;

  const toggle = (item: ProductModule) => {
    if (!selected.includes(item.key)) {
      setSelected((current) => [...current, item.key]);
      return;
    }
    const dependents = enabledDependents(item.key, selected, catalog);
    if (dependents.length > 0) {
      setPending({ item, dependents: dependents.map((key) => byKey.get(key)!).filter(Boolean) });
      return;
    }
    setSelected((current) => current.filter((key) => key !== item.key));
  };

  const confirmDisable = () => {
    if (!pending) return;
    const off = new Set([pending.item.key, ...pending.dependents.map((item) => item.key)]);
    setSelected((current) => current.filter((key) => !off.has(key)));
    setPending(null);
  };

  // Primero los módulos base; cada uno con los que dependen de él debajo.
  const roots = catalog.filter((item) => item.requires.length === 0);
  const childrenOf = (key: string) =>
    catalog.filter((item) => item.requires.length > 0 && item.requires[0] === key);

  const renderModule = (item: ProductModule) => {
    const missing = missingRequirements(item, selected);
    const blocked = missing.length > 0 && !selected.includes(item.key);
    return (
      <label
        className={`flex items-start gap-3 text-body-md ${blocked ? 'cursor-not-allowed opacity-[0.6]' : 'cursor-pointer'}`}
      >
        <input
          type="checkbox"
          className="mt-1 accent-primary"
          checked={selected.includes(item.key)}
          onChange={() => toggle(item)}
          disabled={update.isPending || blocked}
        />
        <span>
          <span className="text-title-sm text-on-surface">{item.name}</span>
          <span className="block text-body-sm text-on-surface-variant">
            {item.description}
            {item.requires.length > 0 && <> Requiere {item.requires.map(nameOf).join(' y ')}.</>}
          </span>
        </span>
      </label>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Módulos</CardTitle>
        <CardDescription>
          Funciones adicionales que aparecen en el menú de la empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-on-surface-variant" />
        ) : (
          <ul className="space-y-3">
            {roots.map((root) => (
              <li key={root.key} className="space-y-3">
                {renderModule(root)}
                {childrenOf(root.key).length > 0 && (
                  <ul className="ml-2 space-y-3 border-l border-outline-variant pl-5">
                    {childrenOf(root.key).map((child) => (
                      <li key={child.key}>{renderModule(child)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {changed && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update.mutate(selected)} disabled={update.isPending}>
              {update.isPending ? 'Guardando...' : 'Guardar módulos'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(enabledModules)}
              disabled={update.isPending}
            >
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Apagar {pending?.item.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              También se apagan los módulos que lo necesitan:{' '}
              {pending?.dependents.map((item) => item.name).join(', ')}. Los datos no se borran:
              vuelven a aparecer si los enciendes de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisable}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
