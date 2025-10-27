# Melhorias no Sistema de Geração de Áudio

## Problema Identificado
O erro que você recebeu indica que a **quota da API do Gemini foi excedida**:

```
"You exceeded your current quota, please check your plan and billing details"
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
Limit: 15 requests per day
```

## Melhorias Implementadas

### 1. **Sistema de Retry Automático**
- **Retry inteligente**: Detecta automaticamente erros de quota (código 429, status RESOURCE_EXHAUSTED)
- **Backoff adaptativo**: Usa o tempo de retry sugerido pela API (extraído da mensagem de erro)
- **Máximo de tentativas**: 3 tentativas para geração normal, 2 para preview de voz
- **Fallback**: Se não conseguir extrair o tempo de retry, usa 60 segundos como padrão

### 2. **Detecção Aprimorada de Erros de Quota**
A função `isQuotaError()` identifica erros de quota por:
- Código de erro 429 (Too Many Requests)
- Status RESOURCE_EXHAUSTED
- Mensagens contendo "quota" ou "rate limit"

### 3. **Parsing Inteligente do Tempo de Retry**
A função `parseRetryDelay()` extrai o tempo de espera de:
- Mensagens de texto: "Please retry in 15.075365654s"
- Detalhes estruturados da API: `RetryInfo.retryDelay`

### 4. **Mensagens de Erro Mais Informativas**
- Exibe tempo de espera necessário
- Sugere ações para resolver o problema
- Diferencia entre erros de quota e outros tipos de erro

## Como Usar

### Configurações Recomendadas para Evitar Quota
1. **Reduza a taxa de requisições**: Configure para 5-10 req/min instead of 60
2. **Aumente o tamanho dos chunks**: Use 6000-8000 caracteres por chunk
3. **Processe arquivos menores**: Divida textos grandes em múltiplos arquivos

### Limites da API Gratuita
- **15 requisições por dia** para o modelo TTS
- **Reset diário**: As quotas são resetadas a cada 24 horas
- **Upgrade necessário**: Para uso intensivo, considere um plano pago

## Exemplos de Uso

### Antes (sem retry)
```typescript
// Falhava imediatamente com erro de quota
const response = await ai.models.generateContent(...);
```

### Depois (com retry automático)
```typescript
// Tenta até 3 vezes com delay apropriado
const response = await generateContentWithRetry(prompt, voice, signal, 3);
```

## Próximos Passos Recomendados

1. **Monitore o uso**: Acesse https://ai.dev/usage?tab=rate-limit
2. **Configure limites conservadores**: Comece com 5 req/min
3. **Considere upgrade**: Para projetos comerciais, use uma conta paga
4. **Teste em horários diferentes**: A quota pode resetar em horários específicos

## Limitações Atuais
- O plano gratuito tem apenas **15 requisições/dia**
- Para textos longos, isso é muito limitante
- É necessário um plano pago para uso produtivo

O sistema agora é mais robusto e tentará automaticamente contornar problemas temporários de quota, mas para uso intensivo será necessário uma chave API com quota maior.