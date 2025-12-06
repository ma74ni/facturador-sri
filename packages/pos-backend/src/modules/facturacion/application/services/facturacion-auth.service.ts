import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@shared/prisma/prisma.service";
import { FacturacionApiService } from "../../infrastructure/facturacion-api.service";

@Injectable()
export class FacturacionAuthService {
  private readonly logger = new Logger(FacturacionAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facturacionApi: FacturacionApiService
  ) {}

  /**
   * Get token for a given turno (shift)
   * Returns the token from the turno if valid, otherwise from service account
   * @param turnoId - Turno ID
   * @returns JWT token
   */
  async getTokenForTurno(turnoId: string): Promise<string> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        colaborador: true,
      },
    });

    if (!turno) {
      throw new Error("Turno no encontrado");
    }

    // If turno has a token and it's still valid, use it
    if (turno.facturacionToken && turno.facturacionTokenExpiry) {
      const now = new Date();
      if (now < turno.facturacionTokenExpiry) {
        // Token still valid
        return turno.facturacionToken;
      } else {
        this.logger.warn(
          `Token expirado para turno ${turnoId}, intentando renovar...`
        );
        // Token expired, try to renew if possible
        if (turno.colaborador.facturacionEmail) {
          // Cannot auto-renew without password - will need to re-login
          // For now, use service account
          this.logger.warn(
            "Token expirado y no se puede renovar automáticamente"
          );
        }
      }
    }

    // No token or expired - use service account token
    return ""; // Will trigger service account usage in FacturacionApiService
  }

  /**
   * Authenticate colaborador and store token in turno
   * @param turnoId - Turno ID
   * @param email - User email
   * @param password - User password
   */
  async authenticateTurno(
    turnoId: string,
    email: string,
    password: string
  ): Promise<void> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        colaborador: true,
      },
    });

    if (!turno) {
      throw new Error("Turno no encontrado");
    }

    try {
      // Login to facturacion-core
      const authResponse = await this.facturacionApi.login(email, password);

      // Get token expiry
      const tokenExpiry = this.facturacionApi.getTokenExpiry(
        authResponse.access_token
      );

      // Update turno with token
      await this.prisma.turno.update({
        where: { id: turnoId },
        data: {
          facturacionToken: authResponse.access_token,
          facturacionTokenExpiry: tokenExpiry,
        },
      });

      // Update colaborador with email if not set
      if (!turno.colaborador.facturacionEmail) {
        await this.prisma.colaborador.update({
          where: { id: turno.colaboradorId },
          data: {
            facturacionEmail: email,
            facturacionUserId: authResponse.user.id,
            requiresFacturacionAuth: true,
          },
        });
      }

      this.logger.log(
        `✅ Turno ${turnoId} autenticado con facturacion-core (${email})`
      );
    } catch (error) {
      this.logger.error(`Error autenticando turno ${turnoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a turno has a valid token
   * @param turnoId - Turno ID
   * @returns true if turno has a valid token
   */
  async hasValidToken(turnoId: string): Promise<boolean> {
    const turno = await this.prisma.turno.findUnique({
      where: { id: turnoId },
      select: {
        facturacionToken: true,
        facturacionTokenExpiry: true,
      },
    });

    if (!turno || !turno.facturacionToken || !turno.facturacionTokenExpiry) {
      return false;
    }

    const now = new Date();
    return now < turno.facturacionTokenExpiry;
  }

  /**
   * Clear token from turno (on turno close or logout)
   * @param turnoId - Turno ID
   */
  async clearTurnoToken(turnoId: string): Promise<void> {
    await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        facturacionToken: null,
        facturacionTokenExpiry: null,
      },
    });

    this.logger.log(`Token eliminado del turno ${turnoId}`);
  }

  /**
   * Get token for active turno in a local
   * @param localId - Local ID
   * @returns JWT token or null
   */
  async getTokenForActiveLocal(localId: string): Promise<string | null> {
    const activeTurno = await this.prisma.turno.findFirst({
      where: {
        localId,
        estado: "ABIERTO",
      },
      orderBy: {
        horaApertura: "desc",
      },
    });

    if (!activeTurno) {
      return null;
    }

    return this.getTokenForTurno(activeTurno.id);
  }
}
