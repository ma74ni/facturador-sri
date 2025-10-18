package com.facturadorsri.signing_service.service;

import com.facturadorsri.signing_service.dto.SignXmlResponse;
import com.facturadorsri.signing_service.exception.SignatureException;
import org.slf4j.Logger;  
import org.slf4j.LoggerFactory;
import org.apache.xml.security.Init;
import org.apache.xml.security.signature.XMLSignature;
import org.apache.xml.security.transforms.Transforms;
import org.apache.xml.security.utils.Constants;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;
import java.util.Enumeration;
import java.util.TimeZone;


@Service
public class SignatureService {

    private static final Logger log = LoggerFactory.getLogger(SignatureService.class);
    private static final String XADES_NAMESPACE = "http://uri.etsi.org/01903/v1.3.2#";
    private static final String DSIG_NAMESPACE = "http://www.w3.org/2000/09/xmldsig#";
    
    static {
        // Inicializar Apache Santuario
        Init.init();
        // Agregar Bouncy Castle como provider
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
    }

    /**
     * Firma un documento XML con XAdES-BES
     * 
     * @param xmlContent Contenido XML sin firmar
     * @param certificateBase64 Certificado PKCS#12 en Base64
     * @param password Contraseña del certificado
     * @return XML firmado
     */
    public String signXml(String xmlContent, String certificateBase64, String password) 
        throws SignatureException {
    try {
        log.info("Iniciando proceso de firma digital XAdES-BES");
        
        // 1. Parsear el XML
        Document document = parseXmlString(xmlContent);
        
        // 2. Cargar certificado y clave privada
        byte[] certificateBytes = Base64.getDecoder().decode(certificateBase64);
        KeyStore keyStore = loadKeyStore(certificateBytes, password);
        
        // 3. Obtener alias, clave privada y certificado
        String alias = getFirstAlias(keyStore);
        PrivateKey privateKey = (PrivateKey) keyStore.getKey(alias, password.toCharArray());
        X509Certificate certificate = (X509Certificate) keyStore.getCertificate(alias);
        
        log.info("Certificado cargado - Subject: {}", certificate.getSubjectDN().getName());
        
        // 4. Crear estructura de firma XMLDSig
        XMLSignature xmlSignature = createXMLSignature(document, privateKey, certificate);
        
        // 5. Agregar PRIMERA referencia: al documento completo (#comprobante)
        addDocumentReference(xmlSignature, document);
        
        // 6. Agregar elementos XAdES (SignedProperties)
        addXAdESElements(document, xmlSignature.getElement(), certificate);
        
        // 7. Agregar SEGUNDA referencia: a SignedProperties (REQUERIDO POR SRI)
        addSignedPropertiesReference(xmlSignature, document);
        
        // 8. AHORA SÍ firmar el documento con ambas referencias
        xmlSignature.sign(privateKey);
        
        // 9. Convertir documento a string
        String signedXml = documentToString(document);
        
        log.info("Documento firmado exitosamente con XAdES-BES");
        return signedXml;
        
    } catch (Exception e) {
        log.error("Error al firmar XML: {}", e.getMessage(), e);
        throw new SignatureException("Error al firmar el documento XML: " + e.getMessage(), e);
    }
}

    /**
     * Crea la estructura XMLSignature según el estándar
     */
    private XMLSignature createXMLSignature(Document document, PrivateKey privateKey, 
                                       X509Certificate certificate) throws Exception {
    Element rootElement = document.getDocumentElement();
    
    // Crear XMLSignature con algoritmo RSA-SHA256
    XMLSignature signature = new XMLSignature(document, "",
            XMLSignature.ALGO_ID_SIGNATURE_RSA_SHA256,
            Transforms.TRANSFORM_C14N_OMIT_COMMENTS);
    
    signature.setId("Signature");
    
    // Agregar certificado al KeyInfo
    signature.addKeyInfo(certificate);
    
    // Insertar firma como último hijo del elemento raíz
    rootElement.appendChild(signature.getElement());
    
    return signature;
}

    /**
     * Agrega la referencia al documento completo
     */
    private void addDocumentReference(XMLSignature signature, Document document) throws Exception {
    // Obtener el id del comprobante (atributo id del elemento raíz)
    String referenceId = document.getDocumentElement().getAttribute("id");
    if (referenceId == null || referenceId.isEmpty()) {
        referenceId = "comprobante";
    }
    
    // IMPORTANTE: Registrar el atributo 'id' como tipo ID en el DOM
    document.getDocumentElement().setIdAttribute("id", true);
    
    Transforms transforms = new Transforms(document);
    transforms.addTransform(Transforms.TRANSFORM_ENVELOPED_SIGNATURE);
    
    // Agregar referencia al comprobante con URI="#comprobante"
    signature.addDocument("#" + referenceId, transforms, 
        "http://www.w3.org/2001/04/xmlenc#sha256");
}

    /**
     * Agrega los elementos específicos de XAdES-BES
     */
    private void addXAdESElements(Document document, Element signatureElement, 
                                 X509Certificate certificate) throws Exception {
        
        // Crear elemento Object que contendrá QualifyingProperties
        Element objectElement = document.createElementNS(DSIG_NAMESPACE, "ds:Object");
        objectElement.setAttribute("Id", "Object");
        
        // Crear QualifyingProperties
        Element qualifyingProperties = document.createElementNS(XADES_NAMESPACE, "etsi:QualifyingProperties");
        qualifyingProperties.setAttribute("Target", "#Signature");
        
        // Crear SignedProperties
        Element signedProperties = document.createElementNS(XADES_NAMESPACE, "etsi:SignedProperties");
        signedProperties.setAttribute("Id", "SignedProperties");
        
        // Crear SignedSignatureProperties
        Element signedSigProps = document.createElementNS(XADES_NAMESPACE, "etsi:SignedSignatureProperties");
        
        // Agregar SigningTime
        addSigningTime(document, signedSigProps);
        
        // Agregar SigningCertificate
        addSigningCertificate(document, signedSigProps, certificate);
        
        // Ensamblar estructura
        signedSigProps.appendChild(document.createElementNS(XADES_NAMESPACE, "etsi:SignedDataObjectProperties"));
        signedProperties.appendChild(signedSigProps);
        qualifyingProperties.appendChild(signedProperties);
        objectElement.appendChild(qualifyingProperties);
        
        // Agregar Object al final de Signature
        signatureElement.appendChild(objectElement);
    }

    /**
 * Agrega la segunda referencia requerida: SignedProperties
 * Debe llamarse DESPUÉS de crear el elemento SignedProperties
 */
private void addSignedPropertiesReference(XMLSignature signature, Document document) throws Exception {
    // Registrar el atributo 'Id' del elemento SignedProperties
    Element signedProps = (Element) document.getElementsByTagNameNS(
        XADES_NAMESPACE, "SignedProperties").item(0);
    
    if (signedProps != null) {
        signedProps.setIdAttribute("Id", true);
        
        // Crear transformación C14N para las propiedades
        Transforms transforms = new Transforms(document);
        transforms.addTransform(Transforms.TRANSFORM_C14N_OMIT_COMMENTS);
        
        // Agregar referencia a SignedProperties con Type específico de XAdES
        signature.addDocument(
            "#SignedProperties",
            transforms,
            "http://www.w3.org/2001/04/xmlenc#sha256",
            null,
            "http://uri.etsi.org/01903#SignedProperties"
        );
    }
}

    /**
     * Agrega el tiempo de firma (SigningTime)
     */
    private void addSigningTime(Document document, Element parent) {
        Element signingTime = document.createElementNS(XADES_NAMESPACE, "etsi:SigningTime");
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX");
        sdf.setTimeZone(TimeZone.getTimeZone("America/Guayaquil"));
        signingTime.setTextContent(sdf.format(new Date()));
        
        parent.appendChild(signingTime);
    }

    /**
     * Agrega información del certificado firmante
     */
    private void addSigningCertificate(Document document, Element parent, 
                                      X509Certificate certificate) throws Exception {
        Element signingCert = document.createElementNS(XADES_NAMESPACE, "etsi:SigningCertificate");
        Element cert = document.createElementNS(XADES_NAMESPACE, "etsi:Cert");
        
        // CertDigest
        Element certDigest = document.createElementNS(XADES_NAMESPACE, "etsi:CertDigest");
        Element digestMethod = document.createElementNS(DSIG_NAMESPACE, "ds:DigestMethod");
        digestMethod.setAttribute("Algorithm", "http://www.w3.org/2000/09/xmldsig#sha1");
        
        Element digestValue = document.createElementNS(DSIG_NAMESPACE, "ds:DigestValue");
        digestValue.setTextContent(calculateCertificateDigest(certificate));
        
        certDigest.appendChild(digestMethod);
        certDigest.appendChild(digestValue);
        
        // IssuerSerial
        Element issuerSerial = document.createElementNS(XADES_NAMESPACE, "etsi:IssuerSerial");
        Element x509IssuerName = document.createElementNS(DSIG_NAMESPACE, "ds:X509IssuerName");
        x509IssuerName.setTextContent(certificate.getIssuerDN().getName());
        
        Element x509SerialNumber = document.createElementNS(DSIG_NAMESPACE, "ds:X509SerialNumber");
        x509SerialNumber.setTextContent(certificate.getSerialNumber().toString());
        
        issuerSerial.appendChild(x509IssuerName);
        issuerSerial.appendChild(x509SerialNumber);
        
        // Ensamblar
        cert.appendChild(certDigest);
        cert.appendChild(issuerSerial);
        signingCert.appendChild(cert);
        parent.appendChild(signingCert);
    }

    /**
     * Calcula el digest SHA-1 del certificado
     */
    private String calculateCertificateDigest(X509Certificate certificate) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-1");
        byte[] digest = md.digest(certificate.getEncoded());
        return Base64.getEncoder().encodeToString(digest);
    }

    /**
     * Carga un keystore PKCS#12
     */
    private KeyStore loadKeyStore(byte[] certificateBytes, String password) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("PKCS12", "BC");
        keyStore.load(new ByteArrayInputStream(certificateBytes), password.toCharArray());
        return keyStore;
    }

    /**
     * Obtiene el primer alias del keystore
     */
    private String getFirstAlias(KeyStore keyStore) throws Exception {
        Enumeration<String> aliases = keyStore.aliases();
        if (!aliases.hasMoreElements()) {
            throw new SignatureException("No se encontraron alias en el certificado");
        }
        return aliases.nextElement();
    }

    /**
     * Parsea un string XML a Document
     */
    private Document parseXmlString(String xmlContent) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        
        Document document = builder.parse(new ByteArrayInputStream(xmlContent.getBytes("UTF-8")));
        
        // Registrar el atributo 'id' como tipo ID en el elemento raíz
        Element root = document.getDocumentElement();
        if (root.hasAttribute("id")) {
            root.setIdAttribute("id", true);
        }
        
        return document;
    }

    /**
     * Convierte un Document a String
     */
    private String documentToString(Document document) throws Exception {
        TransformerFactory tf = TransformerFactory.newInstance();
        Transformer transformer = tf.newTransformer();
        StringWriter writer = new StringWriter();
        transformer.transform(new DOMSource(document), new StreamResult(writer));
        return writer.getBuffer().toString();
    }

    /**
     * Obtiene información del certificado para la respuesta
     */
    public SignXmlResponse.CertificateInfo getCertificateInfo(String certificateBase64, String password) 
            throws Exception {
        byte[] certificateBytes = Base64.getDecoder().decode(certificateBase64);
        KeyStore keyStore = loadKeyStore(certificateBytes, password);
        String alias = getFirstAlias(keyStore);
        X509Certificate certificate = (X509Certificate) keyStore.getCertificate(alias);
        
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        
        return SignXmlResponse.CertificateInfo.builder()
                .subject(certificate.getSubjectDN().getName())
                .issuer(certificate.getIssuerDN().getName())
                .serialNumber(certificate.getSerialNumber().toString())
                .validFrom(sdf.format(certificate.getNotBefore()))
                .validTo(sdf.format(certificate.getNotAfter()))
                .build();
    }
}