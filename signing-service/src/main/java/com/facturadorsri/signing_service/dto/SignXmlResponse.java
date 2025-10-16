package com.facturadorsri.signing_service.dto;

/**
 * DTO para la respuesta de firma de XML
 */
public class SignXmlResponse {
    
    private boolean success;
    private String signedXml;
    private String errorMessage;
    private CertificateInfo certificateInfo;

    // Constructores
    public SignXmlResponse() {}

    public SignXmlResponse(boolean success, String signedXml, String errorMessage, CertificateInfo certificateInfo) {
        this.success = success;
        this.signedXml = signedXml;
        this.errorMessage = errorMessage;
        this.certificateInfo = certificateInfo;
    }

    // Builder estático
    public static SignXmlResponseBuilder builder() {
        return new SignXmlResponseBuilder();
    }

    // Getters y Setters
    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }
    
    public String getSignedXml() { return signedXml; }
    public void setSignedXml(String signedXml) { this.signedXml = signedXml; }
    
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public CertificateInfo getCertificateInfo() { return certificateInfo; }
    public void setCertificateInfo(CertificateInfo certificateInfo) { this.certificateInfo = certificateInfo; }

    // Clase Builder
    public static class SignXmlResponseBuilder {
        private boolean success;
        private String signedXml;
        private String errorMessage;
        private CertificateInfo certificateInfo;

        public SignXmlResponseBuilder success(boolean success) {
            this.success = success;
            return this;
        }
        
        public SignXmlResponseBuilder signedXml(String signedXml) {
            this.signedXml = signedXml;
            return this;
        }
        
        public SignXmlResponseBuilder errorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            return this;
        }
        
        public SignXmlResponseBuilder certificateInfo(CertificateInfo certificateInfo) {
            this.certificateInfo = certificateInfo;
            return this;
        }
        
        public SignXmlResponse build() {
            return new SignXmlResponse(success, signedXml, errorMessage, certificateInfo);
        }
    }

    // Clase interna CertificateInfo
    public static class CertificateInfo {
        private String subject;
        private String issuer;
        private String serialNumber;
        private String validFrom;
        private String validTo;

        // Constructores
        public CertificateInfo() {}

        public CertificateInfo(String subject, String issuer, String serialNumber, String validFrom, String validTo) {
            this.subject = subject;
            this.issuer = issuer;
            this.serialNumber = serialNumber;
            this.validFrom = validFrom;
            this.validTo = validTo;
        }

        // Builder estático
        public static CertificateInfoBuilder builder() {
            return new CertificateInfoBuilder();
        }

        // Getters y Setters
        public String getSubject() { return subject; }
        public void setSubject(String subject) { this.subject = subject; }
        
        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
        
        public String getSerialNumber() { return serialNumber; }
        public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }
        
        public String getValidFrom() { return validFrom; }
        public void setValidFrom(String validFrom) { this.validFrom = validFrom; }
        
        public String getValidTo() { return validTo; }
        public void setValidTo(String validTo) { this.validTo = validTo; }

        // Clase Builder
        public static class CertificateInfoBuilder {
            private String subject;
            private String issuer;
            private String serialNumber;
            private String validFrom;
            private String validTo;

            public CertificateInfoBuilder subject(String subject) {
                this.subject = subject;
                return this;
            }
            
            public CertificateInfoBuilder issuer(String issuer) {
                this.issuer = issuer;
                return this;
            }
            
            public CertificateInfoBuilder serialNumber(String serialNumber) {
                this.serialNumber = serialNumber;
                return this;
            }
            
            public CertificateInfoBuilder validFrom(String validFrom) {
                this.validFrom = validFrom;
                return this;
            }
            
            public CertificateInfoBuilder validTo(String validTo) {
                this.validTo = validTo;
                return this;
            }
            
            public CertificateInfo build() {
                return new CertificateInfo(subject, issuer, serialNumber, validFrom, validTo);
            }
        }
    }
}