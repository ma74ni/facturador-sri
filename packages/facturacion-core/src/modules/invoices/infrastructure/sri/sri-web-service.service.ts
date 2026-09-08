import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as soap from 'soap';
import { DOMParser } from '@xmldom/xmldom';
import { R2StorageService } from '../../../../shared/storage/r2-storage.service';

@Injectable()
export class SriWebServiceService {
  private readonly logger = new Logger(SriWebServiceService.name);
  private readonly receptionUrlTest = process.env.SRI_RECEPTION_URL_TEST;
  private readonly authorizationUrlTest = process.env.SRI_AUTHORIZATION_URL_TEST;
  private readonly receptionUrlProd = process.env.SRI_RECEPTION_URL_PROD;
  private readonly authorizationUrlProd = process.env.SRI_AUTHORIZATION_URL_PROD;

  constructor(private r2Storage: R2StorageService) {}

  /**
   * Extrae la clave de acceso del XML
   */
  private extractAccessKeyFromXml(xmlContent: string): string {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      const claveAccessoNodes = xmlDoc.getElementsByTagName('claveAcceso');
      
      if (claveAccessoNodes && claveAccessoNodes.length > 0) {
        const claveAcceso = claveAccessoNodes[0].textContent || '';
        return claveAcceso;
      }

      throw new Error('No se encontró la clave de acceso en el XML');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Envía un comprobante electrónico al SRI con reintentos
   */
  async sendInvoice(
    xmlContent: string,
    environment: 'TEST' | 'PRODUCTION',
  ): Promise<{
    success: boolean;
    claveAcceso: string;
    estado: string;
    mensaje?: string;
    comprobantes?: any[];
  }> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 segundos entre reintentos

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = environment === 'PRODUCTION'
          ? this.receptionUrlProd
          : this.receptionUrlTest;

        if (!url) {
          throw new InternalServerErrorException(
            `URL del SRI no configurada para ambiente ${environment}`,
          );
        }

        // Extraer clave de acceso del XML antes de enviar
        const claveAcceso = this.extractAccessKeyFromXml(xmlContent);

        this.logger.log(`📤 Intento ${attempt}/${maxRetries} - Enviando comprobante al SRI (clave: ${claveAcceso})`);

        // Crear cliente SOAP
        const client = await soap.createClientAsync(url, {
          disableCache: true,
        });

        // Preparar el XML en Base64
        const xmlBase64 = Buffer.from(xmlContent, 'utf-8').toString('base64');

        // Preparar request según especificación SRI
        const args = {
          xml: xmlBase64,
        };

        // Llamar al método validarComprobante
        const [result] = await client.validarComprobanteAsync(args);

        // Procesar respuesta
        const respuesta = result.RespuestaRecepcionComprobante;

        this.logger.log(`✅ Comprobante enviado exitosamente en intento ${attempt}`);

        return {
          success: respuesta.estado === 'RECIBIDA',
          claveAcceso: respuesta.claveAccesoComprobante || claveAcceso,
          estado: respuesta.estado,
          mensaje: respuesta.comprobantes?.comprobante?.mensajes?.mensaje?.mensaje,
          comprobantes: respuesta.comprobantes,
        };

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isNetworkError = error.message?.includes('ECONNRESET') ||
                               error.message?.includes('ETIMEDOUT') ||
                               error.message?.includes('ENOTFOUND');

        if (isNetworkError && !isLastAttempt) {
          this.logger.warn(`⚠️  Intento ${attempt} falló (${error.message}). Reintentando en ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          continue; // Reintentar
        }

        // Si no es error de red o es el último intento, lanzar error
        this.logger.error(`❌ Error en intento ${attempt}/${maxRetries}: ${error.message}`);
        throw new InternalServerErrorException(
          `Error al enviar al SRI después de ${attempt} intentos: ${error.message}`,
        );
      }
    }

    // Este código nunca debería ejecutarse, pero TypeScript lo requiere
    throw new InternalServerErrorException('Error inesperado al enviar al SRI');
  }

  /**
   * Helper para esperar entre reintentos
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Consulta la autorización de un comprobante en el SRI con reintentos
   */
  async checkAuthorization(
    accessKey: string,
    environment: 'TEST' | 'PRODUCTION',
  ): Promise<{
    estado: string;
    numeroAutorizacion?: string;
    fechaAutorizacion?: Date;
    ambiente: string;
    mensajes?: any[];
  }> {
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = environment === 'PRODUCTION'
          ? this.authorizationUrlProd
          : this.authorizationUrlTest;

        if (!url) {
          throw new InternalServerErrorException(
            `URL de autorización del SRI no configurada para ambiente ${environment}`,
          );
        }

        if (!accessKey || accessKey.length !== 49) {
          throw new InternalServerErrorException(
            `Clave de acceso inválida: '${accessKey}' (longitud: ${accessKey?.length || 0})`,
          );
        }

        this.logger.log(`🔍 Intento ${attempt}/${maxRetries} - Consultando autorización (clave: ${accessKey})`);

        // Crear cliente SOAP
        const client = await soap.createClientAsync(url, {
          disableCache: true,
        });

        // Preparar request
        const args = {
          claveAccesoComprobante: accessKey,
        };

        // Llamar al método autorizacionComprobante
        const [result] = await client.autorizacionComprobanteAsync(args);

        // Procesar respuesta
        const autorizaciones = result.RespuestaAutorizacionComprobante?.autorizaciones?.autorizacion;

        if (!autorizaciones || autorizaciones.length === 0) {
          return {
            estado: 'NO_AUTORIZADA',
            ambiente: environment,
            mensajes: [],
          };
        }

        const autorizacion = Array.isArray(autorizaciones)
          ? autorizaciones[0]
          : autorizaciones;

        this.logger.log(`✅ Autorización consultada exitosamente en intento ${attempt}`);

        return {
          estado: autorizacion.estado,
          numeroAutorizacion: autorizacion.numeroAutorizacion,
          fechaAutorizacion: autorizacion.fechaAutorizacion
            ? new Date(autorizacion.fechaAutorizacion)
            : undefined,
          ambiente: autorizacion.ambiente,
          mensajes: autorizacion.mensajes?.mensaje || [],
        };

      } catch (error) {
        const isLastAttempt = attempt === maxRetries;
        const isNetworkError = error.message?.includes('ECONNRESET') ||
                               error.message?.includes('ETIMEDOUT') ||
                               error.message?.includes('ENOTFOUND');

        if (isNetworkError && !isLastAttempt) {
          this.logger.warn(`⚠️  Intento ${attempt} falló (${error.message}). Reintentando en ${retryDelay}ms...`);
          await this.sleep(retryDelay);
          continue;
        }

        this.logger.error(`❌ Error en intento ${attempt}/${maxRetries}: ${error.message}`);
        throw new InternalServerErrorException(
          `Error al consultar autorización después de ${attempt} intentos: ${error.message}`,
        );
      }
    }

    // Este código nunca debería ejecutarse, pero TypeScript lo requiere
    throw new InternalServerErrorException('Error inesperado al consultar autorización');
  }

  /**
   * Proceso completo: Enviar y autorizar
   */
  async sendAndAuthorize(
    xmlPath: string,
    environment: 'TEST' | 'PRODUCTION',
    // ~28s de sondeo de autorización (antes 15s): celcer (ambiente PRUEBAS)
    // suele tardar más. Se mantiene por debajo de ~50s totales para no chocar
    // con el timeout del cliente que llama a /send-to-sri.
    maxRetries: number = 7,
    retryDelay: number = 4000,
  ): Promise<{
    sent: boolean;
    authorized: boolean;
    authorizationNumber?: string;
    authorizationDate?: Date;
    errors?: string[];
  }> {
    const errors: string[] = [];

    try {
      // 1. Descargar XML desde R2
      const xmlContent = await this.r2Storage.downloadXml(xmlPath);

      // 2. Extraer clave de acceso
      const claveAcceso = this.extractAccessKeyFromXml(xmlContent);

      // 3. Enviar al SRI
      this.logger.log(`📤 Enviando comprobante al SRI (clave: ${claveAcceso})`);
      const sendResult = await this.sendInvoice(xmlContent, environment);

      this.logger.log(`📋 Respuesta de recepción SRI: ${JSON.stringify({
        success: sendResult.success,
        estado: sendResult.estado,
        mensaje: sendResult.mensaje
      })}`);

      if (!sendResult.success) {
        this.logger.error(`❌ Error en recepción SRI: ${sendResult.mensaje || 'Desconocido'}`);
        errors.push(`Error en recepción: ${sendResult.mensaje || 'Desconocido'}`);
        return {
          sent: false,
          authorized: false,
          errors,
        };
      }

      // 4. Esperar y consultar autorización (con reintentos)
      this.logger.log(`⏳ Consultando autorización (máximo ${maxRetries} intentos)...`);
      for (let i = 0; i < maxRetries; i++) {

        await this.sleep(retryDelay);

        this.logger.log(`🔄 Intento ${i + 1}/${maxRetries} de consulta de autorización...`);
        const authResult = await this.checkAuthorization(
          claveAcceso, // Usar la clave extraída del XML
          environment,
        );

        this.logger.log(`📋 Estado de autorización: ${authResult.estado}`);

        if (authResult.estado === 'AUTORIZADO') {
          this.logger.log(`✅ Comprobante AUTORIZADO: ${authResult.numeroAutorizacion}`);
          return {
            sent: true,
            authorized: true,
            authorizationNumber: authResult.numeroAutorizacion,
            authorizationDate: authResult.fechaAutorizacion,
          };
        }

        if (authResult.estado === 'NO_AUTORIZADO' || authResult.estado === 'RECHAZADA') {
          const mensajes = authResult.mensajes?.map((m: any) => m.mensaje || m.informacionAdicional).join(', ');
          this.logger.error(`❌ Comprobante RECHAZADO: ${mensajes}`);
          this.logger.error(`📋 Mensajes completos del SRI:`, JSON.stringify(authResult.mensajes, null, 2));
          errors.push(`Comprobante rechazado: ${mensajes}`);

          return {
            sent: true,
            authorized: false,
            errors,
          };
        }
      }

      // Si llegamos aquí, se agotaron los reintentos
      errors.push('Se agotó el tiempo de espera para la autorización');
      return {
        sent: true,
        authorized: false,
        errors,
      };

    } catch (error) {
      errors.push(error.message);
      return {
        sent: false,
        authorized: false,
        errors,
      };
    }
  }
}