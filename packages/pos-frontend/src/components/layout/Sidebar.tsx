import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package, Receipt, BarChart3, Settings, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Punto de Venta', href: '/pos', icon: ShoppingCart },
  { name: 'Órdenes', href: '/ordenes', icon: Receipt },
  { name: 'Productos', href: '/productos', icon: Package },
  { name: 'Deliveries', href: '/deliveries', icon: Truck },
  { name: 'Reportes', href: '/reportes', icon: BarChart3 },
  { name: 'Configuración', href: '/configuracion', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:bg-background lg:pt-16">
      <nav className="flex flex-1 flex-col p-4">
        <ul className="flex flex-1 flex-col gap-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-x-3 rounded-lg p-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
