package com.facturadorsri.signingservice.web;

import jakarta.validation.constraints.NotBlank;

public class SignRequest {

    @NotBlank(message = "El XML a firmar es obligatorio")
    private String xml;

    public String getXml() {
        return xml;
    }

    public void setXml(String xml) {
        this.xml = xml;
    }
}
