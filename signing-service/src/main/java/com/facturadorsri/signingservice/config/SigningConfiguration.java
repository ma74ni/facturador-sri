package com.facturadorsri.signingservice.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(SigningProperties.class)
public class SigningConfiguration {
}
