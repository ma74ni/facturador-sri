import type { Categoria } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CategoriaGridProps {
  categorias: Categoria[];
  selectedCategoriaId?: string;
  onSelectCategoria: (categoria: Categoria) => void;
}

export function CategoriaGrid({
  categorias,
  selectedCategoriaId,
  onSelectCategoria,
}: CategoriaGridProps) {
  const categoriasActivas = categorias.filter((c) => c.activa);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {categoriasActivas.map((categoria) => (
        <button
          key={categoria.id}
          onClick={() => onSelectCategoria(categoria)}
          className={cn(
            'flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200',
            'hover:scale-105 hover:shadow-lg',
            'border-2',
            selectedCategoriaId === categoria.id
              ? 'border-primary bg-primary/10 shadow-md'
              : 'border-border bg-card hover:border-primary/50'
          )}
          style={{
            borderColor:
              selectedCategoriaId === categoria.id
                ? categoria.color
                : undefined,
          }}
        >
          {categoria.icono && (
            <span className="text-4xl mb-2">{categoria.icono}</span>
          )}
          <span className="text-sm font-medium text-center">
            {categoria.nombre}
          </span>
        </button>
      ))}
    </div>
  );
}
