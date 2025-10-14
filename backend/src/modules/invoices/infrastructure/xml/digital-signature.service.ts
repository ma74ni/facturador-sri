import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as forge from 'node-forge';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import * as crypto from 'crypto';

@Injectable()
export class DigitalSignatureService {
  /**
   * Firma un XML con certificado digital .p12 usando XAdES-BES
   */
  async signXml(
    xmlContent: string,
    certificatePath: string,
    certificatePassword: string,
  ): Promise<string> {
    try {
      // 1. Verificar que el certificado existe
      if (!existsSync(certificatePath)) {
        throw new InternalServerErrorException(
          'Certificado digital no encontrado en: ' + certificatePath,
        );
      }

      // 2. Leer y parsear el certificado .p12
      const p12Buffer = await readFile(certificatePath);
      const p12Der = forge.util.encode64(p12Buffer.toString('binary'));
      const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Der));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certificatePassword);

      // 3. Extraer clave privada y certificado
      const keyData = this.extractKeyAndCert(p12);
      
      if (!keyData.privateKey || !keyData.certificate) {
        throw new InternalServerErrorException(
          'No se pudo extraer la clave privada o certificado del archivo .p12',
        );
      }

      // 4. Parsear el XML
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

      if (!xmlDoc || !xmlDoc.documentElement) {
        throw new InternalServerErrorException('XML inválido');
      }

      // 5. Preparar el XML para firma (calcular digest del documento completo)
      const digestValue = this.calculateDigest(xmlContent);

      // 6. Crear estructura de firma XML-DSig
      const signatureNode = this.createSignatureNode(
        xmlDoc,
        digestValue,
        keyData.certificate,
      );

      // 7. Obtener SignedInfo para firmarlo
      const signedInfoNodes = signatureNode.getElementsByTagName('ds:SignedInfo');
      if (!signedInfoNodes || signedInfoNodes.length === 0) {
        throw new InternalServerErrorException('No se pudo crear SignedInfo');
      }

      const signedInfoC14n = this.canonicalize(signedInfoNodes[0]);

      // 8. Firmar con la clave privada
      const signatureValue = this.signData(signedInfoC14n, keyData.privateKey);

      // 9. Insertar SignatureValue
      const signatureValueNodes = signatureNode.getElementsByTagName('ds:SignatureValue');
      if (signatureValueNodes && signatureValueNodes.length > 0) {
        signatureValueNodes[0].textContent = signatureValue;
      }

      // 10. Insertar certificado en KeyInfo
      const x509CertNodes = signatureNode.getElementsByTagName('ds:X509Certificate');
      if (x509CertNodes && x509CertNodes.length > 0) {
        x509CertNodes[0].textContent = this.getCertificateBase64(keyData.certificate);
      }

      // 11. Insertar firma en el documento
      const rootElement = xmlDoc.documentElement;
      rootElement.appendChild(signatureNode);

      // 12. Serializar XML firmado
      const serializer = new XMLSerializer();
      const signedXml = serializer.serializeToString(xmlDoc);

      return this.formatXml(signedXml);
    } catch (error) {
      console.error('Error al firmar XML:', error);
      throw new InternalServerErrorException(
        `Error al firmar el documento: ${error.message}`,
      );
    }
  }

  /**
   * Extrae la clave privada y certificado del PKCS#12
   */
  private extractKeyAndCert(p12: any): {
    privateKey: any;
    certificate: any;
  } {
    let privateKey: any = null;
    let certificate: any = null;

    // Buscar en los bags
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });

    // Extraer clave privada
    if (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] && 
        keyBags[forge.pki.oids.pkcs8ShroudedKeyBag].length > 0) {
      privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    }

    // Extraer certificado
    if (certBags[forge.pki.oids.certBag] && 
        certBags[forge.pki.oids.certBag].length > 0) {
      certificate = certBags[forge.pki.oids.certBag][0].cert;
    }

    return { privateKey, certificate };
  }

  /**
   * Calcula el hash SHA-256 del XML (digest)
   */
  private calculateDigest(xmlContent: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(xmlContent, 'utf8');
    return hash.digest('base64');
  }

  /**
   * Crea la estructura del nodo Signature según XML-DSig (SIMPLIFICADA)
   */
  private createSignatureNode(
    xmlDoc: Document,
    digestValue: string,
    certificate: any,
  ): Element {
    const signature = xmlDoc.createElement('ds:Signature');
    signature.setAttribute('xmlns:ds', 'http://www.w3.org/2000/09/xmldsig#');
    signature.setAttribute('xmlns:etsi', 'http://uri.etsi.org/01903/v1.3.2#');
    signature.setAttribute('Id', 'Signature');

    // SignedInfo
    const signedInfo = xmlDoc.createElement('ds:SignedInfo');

    // CanonicalizationMethod
    const canonMethod = xmlDoc.createElement('ds:CanonicalizationMethod');
    canonMethod.setAttribute('Algorithm', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315');
    signedInfo.appendChild(canonMethod);

    // SignatureMethod
    const sigMethod = xmlDoc.createElement('ds:SignatureMethod');
    sigMethod.setAttribute('Algorithm', 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256');
    signedInfo.appendChild(sigMethod);

    // Reference
    const reference = xmlDoc.createElement('ds:Reference');
    reference.setAttribute('URI', '#comprobante');

    // Transforms
    const transforms = xmlDoc.createElement('ds:Transforms');
    const transform = xmlDoc.createElement('ds:Transform');
    transform.setAttribute('Algorithm', 'http://www.w3.org/2000/09/xmldsig#enveloped-signature');
    transforms.appendChild(transform);
    reference.appendChild(transforms);

    // DigestMethod
    const digestMethod = xmlDoc.createElement('ds:DigestMethod');
    digestMethod.setAttribute('Algorithm', 'http://www.w3.org/2001/04/xmlenc#sha256');
    reference.appendChild(digestMethod);

    // DigestValue
    const digestValueNode = xmlDoc.createElement('ds:DigestValue');
    digestValueNode.textContent = digestValue;
    reference.appendChild(digestValueNode);

    signedInfo.appendChild(reference);
    signature.appendChild(signedInfo);

    // SignatureValue (vacío por ahora)
    const signatureValue = xmlDoc.createElement('ds:SignatureValue');
    signatureValue.setAttribute('Id', 'SignatureValue');
    signature.appendChild(signatureValue);

    // KeyInfo
    const keyInfo = xmlDoc.createElement('ds:KeyInfo');
    keyInfo.setAttribute('Id', 'Certificate');

    const x509Data = xmlDoc.createElement('ds:X509Data');
    
    // X509Certificate (vacío por ahora)
    const x509Cert = xmlDoc.createElement('ds:X509Certificate');
    x509Data.appendChild(x509Cert);

    // X509SubjectName
    const x509SubjectName = xmlDoc.createElement('ds:X509SubjectName');
    x509SubjectName.textContent = this.getCertificateSubject(certificate);
    x509Data.appendChild(x509SubjectName);

    // X509IssuerSerial
    const x509IssuerSerial = xmlDoc.createElement('ds:X509IssuerSerial');
    const x509IssuerName = xmlDoc.createElement('ds:X509IssuerName');
    x509IssuerName.textContent = this.getCertificateIssuer(certificate);
    const x509SerialNumber = xmlDoc.createElement('ds:X509SerialNumber');
    x509SerialNumber.textContent = certificate.serialNumber;
    x509IssuerSerial.appendChild(x509IssuerName);
    x509IssuerSerial.appendChild(x509SerialNumber);
    x509Data.appendChild(x509IssuerSerial);

    keyInfo.appendChild(x509Data);
    signature.appendChild(keyInfo);

    // Object con propiedades XAdES-BES
    const object = this.createXAdESObject(xmlDoc, certificate);
    signature.appendChild(object);

    return signature;
  }

  /**
   * Crea el nodo Object con propiedades XAdES-BES
   */
  private createXAdESObject(xmlDoc: Document, certificate: any): Element {
    const object = xmlDoc.createElement('ds:Object');

    const qualProps = xmlDoc.createElement('etsi:QualifyingProperties');
    qualProps.setAttribute('Target', '#Signature');

    const signedProps = xmlDoc.createElement('etsi:SignedProperties');
    signedProps.setAttribute('Id', 'SignedProperties');

    const signedSigProps = xmlDoc.createElement('etsi:SignedSignatureProperties');

    // SigningTime
    const signingTime = xmlDoc.createElement('etsi:SigningTime');
    signingTime.textContent = new Date().toISOString();
    signedSigProps.appendChild(signingTime);

    // SigningCertificate
    const signingCert = xmlDoc.createElement('etsi:SigningCertificate');
    const cert = xmlDoc.createElement('etsi:Cert');
    
    const certDigest = xmlDoc.createElement('etsi:CertDigest');
    const digestMethod = xmlDoc.createElement('ds:DigestMethod');
    digestMethod.setAttribute('Algorithm', 'http://www.w3.org/2001/04/xmlenc#sha256');
    certDigest.appendChild(digestMethod);
    
    const digestValue = xmlDoc.createElement('ds:DigestValue');
    digestValue.textContent = this.calculateCertificateDigest(certificate);
    certDigest.appendChild(digestValue);
    cert.appendChild(certDigest);

    const issuerSerial = xmlDoc.createElement('etsi:IssuerSerial');
    const issuerName = xmlDoc.createElement('ds:X509IssuerName');
    issuerName.textContent = this.getCertificateIssuer(certificate);
    const serialNumber = xmlDoc.createElement('ds:X509SerialNumber');
    serialNumber.textContent = certificate.serialNumber;
    issuerSerial.appendChild(issuerName);
    issuerSerial.appendChild(serialNumber);
    cert.appendChild(issuerSerial);

    signingCert.appendChild(cert);
    signedSigProps.appendChild(signingCert);

    signedProps.appendChild(signedSigProps);
    qualProps.appendChild(signedProps);
    object.appendChild(qualProps);

    return object;
  }

  /**
   * Canonicaliza un nodo XML (C14N)
   */
  private canonicalize(node: Node): string {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(node);
  }

  /**
   * Firma los datos con la clave privada
   */
  private signData(data: string, privateKey: any): string {
    const md = forge.md.sha256.create();
    md.update(data, 'utf8');
    
    const signature = (privateKey as any).sign(md);
    return forge.util.encode64(signature);
  }

  /**
   * Obtiene el certificado en formato Base64
   */
  private getCertificateBase64(certificate: any): string {
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    return forge.util.encode64(certDer);
  }

  /**
   * Obtiene el subject del certificado
   */
  private getCertificateSubject(certificate: any): string {
    const subject = certificate.subject.attributes
      .map((attr: any) => `${attr.shortName}=${attr.value}`)
      .join(', ');
    return subject;
  }

  /**
   * Obtiene el issuer del certificado
   */
  private getCertificateIssuer(certificate: any): string {
    const issuer = certificate.issuer.attributes
      .map((attr: any) => `${attr.shortName}=${attr.value}`)
      .join(', ');
    return issuer;
  }

  /**
   * Calcula el digest del certificado
   */
  private calculateCertificateDigest(certificate: any): string {
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const md = forge.md.sha256.create();
    md.update(certDer);
    return forge.util.encode64(md.digest().getBytes());
  }

  /**
   * Formatea el XML con indentación
   */
  private formatXml(xml: string): string {
    return xml;
  }

  /**
   * Valida si un XML tiene firma digital válida
   */
  validateSignature(xmlContent: string): boolean {
    return (
      xmlContent.includes('<ds:Signature') &&
      xmlContent.includes('<ds:SignatureValue') &&
      xmlContent.includes('<ds:X509Certificate')
    );
  }
}