package com.facturadorsri.signingservice.service;

import com.facturadorsri.signingservice.config.SigningProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;
import xades4j.algorithms.SigAndDataAlgoPair;
import xades4j.algorithms.SignatureAlgorithm;
import xades4j.algorithms.xml.XmlDigestAlgorithm;
import xades4j.production.DataObjectDesc;
import xades4j.production.DataObjectReference;
import xades4j.production.EnvelopedSignatureTransform;
import xades4j.production.ExclusiveCanonicalXMLTransform;
import xades4j.production.SignedDataObjects;
import xades4j.production.XadesBesSigningProfile;
import xades4j.production.XadesSigner;
import xades4j.production.XadesSigningProfile;
import xades4j.properties.DataObjectFormatProperty;
import xades4j.properties.SignaturePolicyBase;
import xades4j.properties.SignaturePolicyIdentifierProperty;
import xades4j.providers.AlgorithmsProviderEx;
import xades4j.providers.BasicSignatureOptionsProvider;
import xades4j.providers.KeyingDataProvider;
import xades4j.providers.SignaturePolicyInfoProvider;
import xades4j.providers.impl.FileSystemKeyStoreKeyingDataProvider;
import xades4j.providers.impl.KeyStoreKeyingDataProvider.SigningCertSelector;
import xades4j.providers.impl.PasswordProvider;
import xades4j.providers.impl.DirectPasswordProvider;
import xades4j.utils.DOMHelper;

import javax.annotation.PostConstruct;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.security.Security;
import java.util.List;
import java.util.Base64;
import javax.xml.crypto.dsig.CanonicalizationMethod;

@Service
public class SriXadesSigner {

    private static final Logger LOGGER = LoggerFactory.getLogger(SriXadesSigner.class);
    private static final String DEFAULT_DOCUMENT_ID = "comprobante";

    private final SigningProperties signingProperties;

    public SriXadesSigner(SigningProperties signingProperties) {
        this.signingProperties = signingProperties;
    }

    @PostConstruct
    void registerSecurityProvider() {
        try {
            Class<?> providerClass = Class.forName("org.bouncycastle.jce.provider.BouncyCastleProvider");
            if (Security.getProvider("BC") == null) {
                Security.addProvider((java.security.Provider) providerClass.getDeclaredConstructor().newInstance());
            }
        } catch (ReflectiveOperationException e) {
            LOGGER.warn("No fue posible registrar BouncyCastle como proveedor de seguridad", e);
        }
    }

    public String sign(String xml) {
        try {
            Document document = parseXml(xml);
            Element elementToSign = document.getDocumentElement();
            ensureIdAttribute(elementToSign);

            KeyingDataProvider keyingDataProvider = createKeyingDataProvider();
            XadesSigningProfile profile = new XadesBesSigningProfile(keyingDataProvider)
                    .withBasicSignatureOptionsProvider(new SriSignatureOptionsProvider())
                    .withAlgorithmsProviderEx(new SriAlgorithmsProvider())
                    .withSignaturePolicyProvider(new SriSignaturePolicyProvider(signingProperties));

            XadesSigner signer = profile.newSigner();

            DataObjectDesc dataObject = new DataObjectReference("#" + elementToSign.getAttribute("Id"))
                    .withTransform(new EnvelopedSignatureTransform())
                    .withTransform(new ExclusiveCanonicalXMLTransform())
                    .withDataObjectFormat(new DataObjectFormatProperty("text/xml"));

            SignedDataObjects signedDataObjects = new SignedDataObjects(dataObject);
            signer.sign(signedDataObjects, elementToSign);

            return DOMHelper.nodeToString(document.getDocumentElement(), true);
        } catch (Exception e) {
            throw new SigningException("No se pudo firmar el XML", e);
        }
    }

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        disableExternalEntities(factory);

        DocumentBuilder builder = factory.newDocumentBuilder();
        try (StringReader reader = new StringReader(xml)) {
            return builder.parse(new InputSource(reader));
        }
    }

    private void disableExternalEntities(DocumentBuilderFactory factory) {
        try {
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        } catch (Exception ignored) {
            LOGGER.debug("No se pudo deshabilitar DOCTYPE", ignored);
        }
        try {
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        } catch (Exception ignored) {
            LOGGER.debug("No se pudo deshabilitar external-general-entities", ignored);
        }
        try {
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        } catch (Exception ignored) {
            LOGGER.debug("No se pudo deshabilitar external-parameter-entities", ignored);
        }
        try {
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
        } catch (Exception ignored) {
            LOGGER.debug("No se pudo deshabilitar load-external-dtd", ignored);
        }
    }

    private void ensureIdAttribute(Element element) {
        if (!element.hasAttribute("Id")) {
            element.setAttribute("Id", DEFAULT_DOCUMENT_ID);
        }
        element.setIdAttribute("Id", true);
    }

    private KeyingDataProvider createKeyingDataProvider() throws GeneralSecurityException {
        PasswordProvider passwordProvider = new DirectPasswordProvider(signingProperties.getKeystorePassword().toCharArray());
        SigningCertSelector selector = new SigningCertSelector() {
            @Override
            public String selectCertificate(List<String> aliases, KeyStore keyStore) throws GeneralSecurityException {
                return aliases.stream()
                        .filter(alias -> alias.equalsIgnoreCase(signingProperties.getCertificateAlias()))
                        .findFirst()
                        .orElseThrow(() -> new GeneralSecurityException("Alias " + signingProperties.getCertificateAlias()
                                + " no encontrado en el certificado"));
            }
        };

        return new FileSystemKeyStoreKeyingDataProvider(
                "PKCS12",
                signingProperties.getKeystorePath(),
                passwordProvider,
                (alias, keyStore) -> signingProperties.getKeystorePassword().toCharArray(),
                selector,
                true);
    }

    private static class SriSignatureOptionsProvider implements BasicSignatureOptionsProvider {
        @Override
        public boolean includeSigningCertificate() {
            return true;
        }

        @Override
        public boolean includeDigestValueInSignedInfoReferences() {
            return true;
        }

        @Override
        public String getSignedInfoCanonicalizationAlgorithm() {
            return CanonicalizationMethod.EXCLUSIVE;
        }
    }

    private static class SriAlgorithmsProvider implements AlgorithmsProviderEx {
        @Override
        public SignatureAlgorithm getSignatureAlgorithm(String keyType) {
            return SignatureAlgorithm.RSA_SHA256;
        }

        @Override
        public XmlDigestAlgorithm getDigestAlgorithm(String dataObjectUri, List<DataObjectDesc> dataObjects) {
            return XmlDigestAlgorithm.SHA256;
        }

        @Override
        public SigAndDataAlgoPair getSignatureAndDataAlgorithms(String keyType) {
            return new SigAndDataAlgoPair(SignatureAlgorithm.RSA_SHA256, XmlDigestAlgorithm.SHA256);
        }

        @Override
        public String getCanonicalizationAlgorithmForTimeStampProperties() {
            return XmlDigestAlgorithm.C14N_EXCL_OMIT_COMMENTS.getUri();
        }

        @Override
        public String getDigestAlgorithmForReferenceProperties() {
            return XmlDigestAlgorithm.SHA256.getUri();
        }
    }

    private static class SriSignaturePolicyProvider implements SignaturePolicyInfoProvider {
        private final SigningProperties signingProperties;

        private SriSignaturePolicyProvider(SigningProperties signingProperties) {
            this.signingProperties = signingProperties;
        }

        @Override
        public SignaturePolicyBase getSignaturePolicy() {
            byte[] digest = Base64.getDecoder().decode(signingProperties.getPolicyDigestValue());
            return new SignaturePolicyIdentifierProperty(
                    signingProperties.getPolicyIdentifier(),
                    signingProperties.getPolicyDigestAlgorithm(),
                    digest);
        }

        @Override
        public boolean isPolicyImplied() {
            return false;
        }
    }

    public static class SigningException extends RuntimeException {
        public SigningException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
