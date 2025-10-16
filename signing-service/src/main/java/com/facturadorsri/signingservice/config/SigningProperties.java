package com.facturadorsri.signingservice.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "sri.signing")
public class SigningProperties {

    /**
     * Ruta al archivo PKCS#12 (.p12) que contiene el certificado emitido por el SRI.
     */
    @NotBlank
    private String keystorePath;

    /**
     * Contraseña del archivo PKCS#12.
     */
    @NotBlank
    private String keystorePassword;

    /**
     * Alias del certificado a utilizar dentro del keystore.
     */
    @NotBlank
    private String certificateAlias;

    /**
     * Identificador de la política de firma definida por el SRI.
     */
    @NotBlank
    private String policyIdentifier = "https://facturaelectronica.sri.gob.ec/firma/v2/politicafirma.xml";

    /**
     * Algoritmo del digest de la política de firma.
     */
    @NotBlank
    private String policyDigestAlgorithm = "http://www.w3.org/2000/09/xmldsig#sha1";

    /**
     * Valor del digest (Base64) de la política de firma del SRI.
     */
    @NotBlank
    private String policyDigestValue = "Ohixl6upD6av8N7pEvDABhEL6hM=";

    public String getKeystorePath() {
        return keystorePath;
    }

    public void setKeystorePath(String keystorePath) {
        this.keystorePath = keystorePath;
    }

    public String getKeystorePassword() {
        return keystorePassword;
    }

    public void setKeystorePassword(String keystorePassword) {
        this.keystorePassword = keystorePassword;
    }

    public String getCertificateAlias() {
        return certificateAlias;
    }

    public void setCertificateAlias(String certificateAlias) {
        this.certificateAlias = certificateAlias;
    }

    public String getPolicyIdentifier() {
        return policyIdentifier;
    }

    public void setPolicyIdentifier(String policyIdentifier) {
        this.policyIdentifier = policyIdentifier;
    }

    public String getPolicyDigestAlgorithm() {
        return policyDigestAlgorithm;
    }

    public void setPolicyDigestAlgorithm(String policyDigestAlgorithm) {
        this.policyDigestAlgorithm = policyDigestAlgorithm;
    }

    public String getPolicyDigestValue() {
        return policyDigestValue;
    }

    public void setPolicyDigestValue(String policyDigestValue) {
        this.policyDigestValue = policyDigestValue;
    }
}
