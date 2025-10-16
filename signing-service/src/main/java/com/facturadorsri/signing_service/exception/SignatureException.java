package com.facturadorsri.signing_service.exception;

/**
 * Excepción personalizada para errores de firma digital
 */
public class SignatureException extends Exception {
    
    public SignatureException(String message) {
        super(message);
    }
    
    public SignatureException(String message, Throwable cause) {
        super(message, cause);
    }
}