import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as soap from 'soap';
import { readFile } from 'fs/promises';
import { DOMParser } from '@xmldom/xmldom';

@Injectable()
export class SriWebServiceService {
  private readonly receptionUrlTest = process.env.SRI_RECEPTION_URL_TEST;
  private readonly authorizationUrlTest = process.env.SRI_AUTHORIZATION_URL_TEST;
  private readonly receptionUrlProd = process.env.SRI_RECEPTION_URL_PROD;
  private readonly authorizationUrlProd = process.env.SRI_AUTHORIZATION_URL_PROD;

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
        console.log(`🔑 Clave de acceso extraída del XML: ${claveAcceso} (longitud: ${claveAcceso.length})`);
        return claveAcceso;
      }
      
      throw new Error('No se encontró la clave de acceso en el XML');
    } catch (error) {
      console.error('Error extrayendo clave de acceso:', error);
      throw error;
    }
  }

  /**
   * Envía un comprobante electrónico al SRI
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
    try {
      const url = environment === 'PRODUCTION' 
        ? this.receptionUrlProd 
        : this.receptionUrlTest;

      if (!url) {
        throw new InternalServerErrorException(
          `URL del SRI no configurada para ambiente ${environment}`,
        );
      }

      console.log(`📤 Enviando factura al SRI (${environment})...`);
      console.log(`🔗 URL: ${url}`);

      // Extraer clave de acceso del XML antes de enviar
      const claveAcceso = this.extractAccessKeyFromXml(xmlContent);

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

      console.log('📥 Respuesta del SRI:', JSON.stringify(result, null, 2));

      // Procesar respuesta
      const respuesta = result.RespuestaRecepcionComprobante;

      return {
        success: respuesta.estado === 'RECIBIDA',
        claveAcceso: respuesta.claveAccesoComprobante || claveAcceso, // Usar la del XML si no viene en respuesta
        estado: respuesta.estado,
        mensaje: respuesta.comprobantes?.comprobante?.mensajes?.mensaje?.mensaje,
        comprobantes: respuesta.comprobantes,
      };

    } catch (error) {
      console.error('❌ Error enviando al SRI:', error);
      throw new InternalServerErrorException(
        `Error al enviar al SRI: ${error.message}`,
      );
    }
  }

  /**
   * Consulta la autorización de un comprobante en el SRI
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

      console.log(`🔍 Consultando autorización en SRI (${environment})...`);
      console.log(`🔗 URL: ${url}`);
      console.log(`🔑 Clave de acceso: ${accessKey} (longitud: ${accessKey.length})`);

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

      console.log('📥 Respuesta autorización:', JSON.stringify(result, null, 2));

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
      console.error('❌ Error consultando autorización:', error);
      throw new InternalServerErrorException(
        `Error al consultar autorización: ${error.message}`,
      );
    }
  }

  /**
   * Proceso completo: Enviar y autorizar
   */
  async sendAndAuthorize(
    xmlPath: string,
    environment: 'TEST' | 'PRODUCTION',
    maxRetries: number = 5,
    retryDelay: number = 3000,
  ): Promise<{
    sent: boolean;
    authorized: boolean;
    authorizationNumber?: string;
    authorizationDate?: Date;
    errors?: string[];
  }> {
    const errors: string[] = [];

    try {
      // 1. Leer XML
      const xmlContent = await readFile(xmlPath, 'utf-8');

      // 2. Extraer clave de acceso
      const claveAcceso = this.extractAccessKeyFromXml(xmlContent);
      console.log(`📋 Procesando factura con clave: ${claveAcceso}`);

      // 3. Enviar al SRI
      const sendResult = await this.sendInvoice(xmlContent, environment);

      if (!sendResult.success) {
        errors.push(`Error en recepción: ${sendResult.mensaje || 'Desconocido'}`);
        return {
          sent: false,
          authorized: false,
          errors,
        };
      }

      console.log(`✅ Comprobante RECIBIDO por el SRI`);

      // 4. Esperar y consultar autorización (con reintentos)
      for (let i = 0; i < maxRetries; i++) {
        console.log(`⏳ Intento ${i + 1}/${maxRetries} - Consultando autorización...`);

        await this.sleep(retryDelay);

        const authResult = await this.checkAuthorization(
          claveAcceso, // Usar la clave extraída del XML
          environment,
        );

        if (authResult.estado === 'AUTORIZADO') {
          console.log(`✅ Comprobante AUTORIZADO`);
          console.log(`📄 Número: ${authResult.numeroAutorizacion}`);
          console.log(`📅 Fecha: ${authResult.fechaAutorizacion}`);

          return {
            sent: true,
            authorized: true,
            authorizationNumber: authResult.numeroAutorizacion,
            authorizationDate: authResult.fechaAutorizacion,
          };
        }

        if (authResult.estado === 'NO_AUTORIZADO' || authResult.estado === 'RECHAZADA') {
          const mensajes = authResult.mensajes?.map((m: any) => m.mensaje || m.informacionAdicional).join(', ');
          errors.push(`Comprobante rechazado: ${mensajes}`);
          console.error(`❌ Comprobante NO AUTORIZADO: ${mensajes}`);
          
          return {
            sent: true,
            authorized: false,
            errors,
          };
        }

        console.log(`⏳ Estado: ${authResult.estado}, reintentando...`);
      }

      // Si llegamos aquí, se agotaron los reintentos
      errors.push('Se agotó el tiempo de espera para la autorización');
      return {
        sent: true,
        authorized: false,
        errors,
      };

    } catch (error) {
      console.error('❌ Error en proceso de envío/autorización:', error);
      errors.push(error.message);
      return {
        sent: false,
        authorized: false,
        errors,
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}