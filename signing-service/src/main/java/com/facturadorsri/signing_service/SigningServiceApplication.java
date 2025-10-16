package com.facturadorsri.signing_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SigningServiceApplication {

	public static void main(String[] args) {
		java.security.Security.addProvider(new org.bouncycastle.jce.provider.BouncyCastleProvider());
        
        SpringApplication.run(SigningServiceApplication.class, args);
	}

}
