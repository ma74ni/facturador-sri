package com.facturadorsri.signingservice.web;

public class SignResponse {

    private final String signedXml;

    public SignResponse(String signedXml) {
        this.signedXml = signedXml;
    }

    public String getSignedXml() {
        return signedXml;
    }
}
