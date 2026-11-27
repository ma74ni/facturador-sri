import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Límite de consultas al SRI por empresa, no por IP: las rutas que lo llaman (consultar una clave,
 * registrarla) van a la misma salida que autoriza las facturas de todas las empresas, y una sola
 * empresa no debe poder saturarla. Va después de JwtAuthGuard, así que `req.user` ya existe.
 */
@Injectable()
export class CompanyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: { user?: { companyId?: string }; ip?: string }): Promise<string> {
    const companyId = req.user?.companyId;
    return companyId ? `company:${companyId}` : (req.ip ?? 'unknown');
  }
}
