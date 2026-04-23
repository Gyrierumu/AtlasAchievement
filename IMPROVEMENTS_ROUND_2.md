# Melhorias aplicadas — Round 2

## Segurança e robustez de upload
- Validação de imagem agora confere a assinatura real do arquivo (magic bytes), e não apenas MIME/extensão enviada pelo navegador.
- Uploads que não forem JPG, PNG, WEBP ou GIF reais são apagados imediatamente do disco.
- A extensão final do arquivo salvo é normalizada com base no tipo detectado.

## Entrega de arquivos estáticos
- `/uploads` agora responde com `X-Content-Type-Options: nosniff`.
- Em produção, uploads recebem cache agressivo (`Cache-Control: public, max-age=2592000, immutable`) porque os nomes são únicos.
