package com.facturadorsri.signing_service.controller;

import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.facturadorsri.signing_service.dto.SignXmlRequest;
import com.facturadorsri.signing_service.dto.SignXmlResponse;
import com.facturadorsri.signing_service.exception.SignatureException;
import com.facturadorsri.signing_service.service.SignatureService;

/**
 * Controlador REST para operaciones de firma digital XML
 */
@RestController
@RequestMapping("/api/v1/signature")
public class SignatureController {

    private static final Logger log = LoggerFactory.getLogger(SignatureController.class);
    private final SignatureService signatureService;

    // Constructor manual (en lugar de @RequiredArgsConstructor de Lombok)
    public SignatureController(SignatureService signatureService) {
        this.signatureService = signatureService;
    }

    /**
     * Endpoint principal para firmar documentos XML
     * 
     * @param request Solicitud con XML, certificado y contraseña
     * @return XML firmado con información del certificado
     */
    @PostMapping("/sign")
    public ResponseEntity<SignXmlResponse> signXml(@Valid @RequestBody SignXmlRequest request) {
        try {
            log.info("Recibida solicitud de firma digital");
            
            // Firmar el XML
            String signedXml = signatureService.signXml(
                    request.getXmlContent(),
                    request.getCertificateBase64(),
                    request.getCertificatePassword()
            );
            
            // Obtener información del certificado
            SignXmlResponse.CertificateInfo certInfo = signatureService.getCertificateInfo(
                    request.getCertificateBase64(),
                    request.getCertificatePassword()
            );
            
            SignXmlResponse response = SignXmlResponse.builder()
                    .success(true)
                    .signedXml(signedXml)
                    .certificateInfo(certInfo)
                    .build();
            
            log.info("Firma digital completada exitosamente");
            return ResponseEntity.ok(response);
            
        } catch (SignatureException e) {
            log.error("Error de firma: {}", e.getMessage());
            SignXmlResponse response = SignXmlResponse.builder()
                    .success(false)
                    .errorMessage(e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            
        } catch (Exception e) {
            log.error("Error inesperado: {}", e.getMessage(), e);
            SignXmlResponse response = SignXmlResponse.builder()
                    .success(false)
                    .errorMessage("Error interno del servidor: " + e.getMessage())
                    .build();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    /**
     * Endpoint de health check
     */
    @GetMapping("/health")
    public ResponseEntity<HealthResponse> health() {
        return ResponseEntity.ok(new HealthResponse("OK", "XML Signature Service is running"));
    }

    /**
     * Endpoint para verificar información de un certificado sin firmar
     */
    @PostMapping("/certificate/info")
    public ResponseEntity<SignXmlResponse.CertificateInfo> getCertificateInfo(
            @RequestBody CertificateInfoRequest request) {
        try {
            SignXmlResponse.CertificateInfo info = signatureService.getCertificateInfo(
                    request.certificateBase64(),  // ← Usar certificateBase64() no getCertificateBase64()
                    request.password()             // ← Usar password() no getPassword()
            );
            return ResponseEntity.ok(info);
        } catch (Exception e) {
            log.error("Error al obtener información del certificado: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    // DTOs internos
    public record HealthResponse(String status, String message) {}
    
    public record CertificateInfoRequest(String certificateBase64, String password) {}
}