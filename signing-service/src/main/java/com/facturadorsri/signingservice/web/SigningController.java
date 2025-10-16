package com.facturadorsri.signingservice.web;

import com.facturadorsri.signingservice.service.SriXadesSigner;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = "/api/sign", produces = MediaType.APPLICATION_JSON_VALUE)
@Validated
public class SigningController {

    private final SriXadesSigner sriXadesSigner;

    public SigningController(SriXadesSigner sriXadesSigner) {
        this.sriXadesSigner = sriXadesSigner;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public SignResponse sign(@Valid @RequestBody SignRequest request) {
        String signed = sriXadesSigner.sign(request.getXml());
        return new SignResponse(signed);
    }
}
