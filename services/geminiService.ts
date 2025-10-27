

import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerationSettings } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

function splitText(text: string, maxChars: number): string[] {
    if (!text) return [];
    if (text.length <= maxChars) {
        return [text];
    }

    const chunks: string[] = [];
    let remainingText = text.trim();

    while (remainingText.length > 0) {
        if (remainingText.length <= maxChars) {
            chunks.push(remainingText);
            break;
        }

        let chunkEndIndex = maxChars;

        const lastPeriod = remainingText.lastIndexOf('.', chunkEndIndex);
        const lastQuestion = remainingText.lastIndexOf('?', chunkEndIndex);
        const lastExclamation = remainingText.lastIndexOf('!', chunkEndIndex);
        
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);

        if (lastSentenceEnd > -1 && lastSentenceEnd > 0) {
            chunkEndIndex = lastSentenceEnd + 1;
        } else {
            const lastSpace = remainingText.lastIndexOf(' ', chunkEndIndex);
            if (lastSpace > -1 && lastSpace > 0) {
                chunkEndIndex = lastSpace + 1;
            }
        }
        
        const chunk = remainingText.substring(0, chunkEndIndex);
        chunks.push(chunk.trim());
        remainingText = remainingText.substring(chunkEndIndex).trim();
    }
    
    return chunks.filter(c => c.length > 0);
}


export async function generateVoicePreview(voiceName: string, signal: AbortSignal): Promise<AudioBuffer> {
    const previewText = "Olá, esta é uma amostra da minha voz. Use-a para decidir se é a certa para o seu projeto.";
    try {
        const response = await generateContentWithRetry(previewText, voiceName, signal, 2); // Less retries for preview

        if (signal.aborted) throw new Error('AbortError');

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            return await decodeAudioData(
                decode(base64Audio),
                outputAudioContext,
                24000,
                1
            );
        } else {
            let errorMessage = "Nenhum dado de áudio recebido para a prévia da voz.";
            const finishReason = response.candidates?.[0]?.finishReason;
            if (response.promptFeedback?.blockReason) {
                errorMessage = `Prévia bloqueada: ${response.promptFeedback.blockReason}.`;
            } else if (finishReason && finishReason !== 'STOP') {
                errorMessage = `Prévia interrompida. Motivo: ${finishReason}.`;
            }
            console.error("API response without audio data for preview:", JSON.stringify(response, null, 2));
            throw new Error(errorMessage);
        }
    } catch (error: any) {
        console.error(`Erro ao gerar prévia para a voz ${voiceName}:`, error);
        if (signal.aborted) throw new Error('AbortError');
        
        // Enhanced error message for quota issues in preview
        if (isQuotaError(error)) {
            const retryDelay = parseRetryDelay(error);
            throw new Error(`Quota da API excedida. Aguarde ${Math.ceil(retryDelay/1000)}s antes de tentar novamente a prévia da voz.`);
        }
        
        throw error;
    }
}


// Helper function to parse retry delay from error
function parseRetryDelay(error: any): number {
    try {
        if (error?.message) {
            const retryMatch = error.message.match(/Please retry in (\d+\.?\d*)s/);
            if (retryMatch) {
                return Math.ceil(parseFloat(retryMatch[1]) * 1000); // Convert to milliseconds
            }
        }
        
        // Check for structured error details
        if (error?.details) {
            for (const detail of error.details) {
                if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
                    const seconds = parseInt(detail.retryDelay.replace('s', ''));
                    return seconds * 1000;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to parse retry delay:', e);
    }
    
    return 60000; // Default to 1 minute if can't parse
}

// Helper function to check if error is quota/rate limit related
function isQuotaError(error: any): boolean {
    if (error?.code === 429) return true;
    if (error?.status === 'RESOURCE_EXHAUSTED') return true;
    if (error?.message && error.message.includes('quota')) return true;
    if (error?.message && error.message.includes('rate limit')) return true;
    return false;
}

async function generateContentWithRetry(
    prompt: string, 
    voiceName: string, 
    signal: AbortSignal,
    maxRetries: number = 3
): Promise<any> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (signal.aborted) throw new Error('AbortError');
        
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voiceName },
                        },
                    },
                },
            });
            
            return response; // Success!
            
        } catch (error: any) {
            lastError = error;
            console.warn(`Attempt ${attempt + 1} failed:`, error);
            
            if (signal.aborted) throw new Error('AbortError');
            
            // If it's not a quota error, don't retry
            if (!isQuotaError(error)) {
                throw error;
            }
            
            // If this was the last attempt, throw the error
            if (attempt === maxRetries - 1) {
                throw error;
            }
            
            // Calculate delay for retry
            const retryDelay = parseRetryDelay(error);
            console.log(`Quota exceeded. Waiting ${retryDelay/1000}s before retry ${attempt + 2}/${maxRetries}...`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    
    throw lastError;
}

export async function* generateSpeechInChunks(
    text: string,
    settings: GenerationSettings,
    signal: AbortSignal
): AsyncGenerator<{ totalChunks?: number, progress?: number; chunk?: AudioBuffer; error?: string; warning?: string }> {
    const chunks = splitText(text, settings.chunkSize);
    const totalChunks = chunks.length;

    // First, yield the total number of chunks for the UI to set up its simulation
    yield { totalChunks };
    
    if (totalChunks === 0) {
        return;
    }

    const delay = 60000 / settings.reqPerMin;

    for (let i = 0; i < totalChunks; i++) {
        if (signal.aborted) throw new Error('AbortError');

        const chunkText = chunks[i];
        let prompt = chunkText;

        if (settings.styleDescription && settings.styleDescription.trim().length > 0) {
            let styleDesc = settings.styleDescription.trim();
            if (!styleDesc.endsWith(':')) {
                styleDesc += ':';
            }
            prompt = `${styleDesc} ${chunkText}`;
        }
        
        const result: { chunk?: AudioBuffer; error?: string; warning?: string } = {};

        try {
            const response = await generateContentWithRetry(prompt, settings.voice, signal);
            
            if (signal.aborted) throw new Error('AbortError');

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                result.chunk = await decodeAudioData(
                    decode(base64Audio),
                    outputAudioContext,
                    24000,
                    1
                );
            } else {
                let errorMessage = "Não foram recebidos dados de áudio da API.";
                const finishReason = response.candidates?.[0]?.finishReason;
                if (response.promptFeedback?.blockReason) {
                    errorMessage = `Geração bloqueada. Motivo: ${response.promptFeedback.blockReason}`;
                } else if (finishReason && finishReason !== 'STOP') {
                    errorMessage = `Geração interrompida. Motivo: ${finishReason}`;
                    if (finishReason === 'OTHER') {
                        errorMessage += ". Isso pode ser causado por um pedaço de texto muito grande. Tente reduzir o valor de 'Caracteres/Pedaço'.";
                    }
                }
                console.error(`API response without audio data for chunk ${i+1}:`, JSON.stringify(response, null, 2));
                result.error = errorMessage;
            }
        } catch (error: any) {
            console.error(`Error processing chunk ${i + 1}:`, error);
            if (signal.aborted) throw new Error('AbortError');
            
            // Enhanced error handling for quota issues
            if (isQuotaError(error)) {
                const retryDelay = parseRetryDelay(error);
                result.error = `Quota da API excedida. Aguarde ${Math.ceil(retryDelay/1000)}s antes de tentar novamente. Considere reduzir a taxa de requisições ou usar uma chave API com quota maior.`;
            } else {
                result.error = error.message;
            }
        }

        // Yield the result of the operation for this chunk
        yield result;

        if (i < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}