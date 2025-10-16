package com.facturadorsri.signingservice.web;

import com.facturadorsri.signingservice.service.SriXadesSigner;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = SigningController.class)
class SigningControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SriXadesSigner sriXadesSigner;

    @Test
    void shouldReturnSignedXml() throws Exception {
        when(sriXadesSigner.sign(anyString())).thenReturn("<xml firmada/>");

        mockMvc.perform(post("/api/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"xml\":\"<xml/>\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.signedXml").value("<xml firmada/>"));
    }

    @Test
    void shouldValidateMissingXml() throws Exception {
        mockMvc.perform(post("/api/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldPropagateSigningError() throws Exception {
        when(sriXadesSigner.sign(anyString())).thenThrow(new SriXadesSigner.SigningException("error", new RuntimeException()));

        mockMvc.perform(post("/api/sign")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"xml\":\"<xml/>\"}"))
                .andExpect(status().isUnprocessableEntity());
    }
}
