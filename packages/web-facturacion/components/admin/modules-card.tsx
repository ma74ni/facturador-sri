'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useProductModules, useUpdateCompanyModules } from '@/lib/hooks/use-platform-admin';

interface ModulesCardProps {
  companyId: string;
  enabledModules: string[];
}

/** Módulos de producto de una empresa (aparecen en su menú y habilitan su API). */
export function ModulesCard({ companyId, enabledModules }: ModulesCardProps) {
  const { data: catalog = [], isLoading } = useProductModules();
  const update = useUpdateCompanyModules(companyId);
  const [selected, setSelected] = useState<string[]>(enabledModules);

  // Por contenido, no por referencia: un refetch del detalle no borra lo que se está editando.
  const savedKey = enabledModules.join(',');
  useEffect(() => {
    setSelected(savedKey ? savedKey.split(',') : []);
  }, [savedKey]);

  const changed =
    selected.length !== enabledModules.length || selected.some((key) => !enabledModules.includes(key));

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Módulos</CardTitle>
        <CardDescription>Funciones adicionales que aparecen en el menú de la empresa.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-3">
            {catalog.map((module) => (
              <li key={module.key}>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(module.key)}
                    onChange={() => toggle(module.key)}
                    disabled={update.isPending}
                  />
                  <span>
                    <span className="font-medium">{module.name}</span>
                    <span className="block text-muted-foreground">{module.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {changed && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => update.mutate(selected)} disabled={update.isPending}>
              {update.isPending ? 'Guardando...' : 'Guardar módulos'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelected(enabledModules)} disabled={update.isPending}>
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
