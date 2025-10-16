package com.facturadorsri.signing_service.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * DTO para la solicitud de firma de XML
 */
public class SignXmlRequest {
    
    @NotBlank(message = "El contenido XML es obligatorio")
    private String xmlContent;
    
    @NotBlank(message = "El certificado es obligatorio")
    private String certificateBase64;
    
    @NotBlank(message = "La contraseña del certificado es obligatoria")
    private String certificatePassword;

    // Constructor vacío
    public SignXmlRequest() {}

    // Constructor completo
    public SignXmlRequest(String xmlContent, String certificateBase64, String certificatePassword) {
        this.xmlContent = xmlContent;
        this.certificateBase64 = certificateBase64;
        this.certificatePassword = certificatePassword;
    }

    // Getters y Setters
    public String getXmlContent() {
        return xmlContent;
    }

    public void setXmlContent(String xmlContent) {
        this.xmlContent = xmlContent;
    }

    public String getCertificateBase64() {
        return certificateBase64;
    }

    public void setCertificateBase64(String certificateBase64) {
        this.certificateBase64 = certificateBase64;
    }

    public String getCertificatePassword() {
        return certificatePassword;
    }

    public void setCertificatePassword(String certificatePassword) {
        this.certificatePassword = certificatePassword;
    }
}