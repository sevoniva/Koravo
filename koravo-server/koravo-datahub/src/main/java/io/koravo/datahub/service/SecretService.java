package io.koravo.datahub.service;

public interface SecretService {
    String encrypt(String plainText);

    String decrypt(String cipherText);
}
