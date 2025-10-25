
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerationSettings } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

function splitText(text: string, maxWords: number): string[] {
    if (!text) return [];

    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) {
        return [text];
    }

    const chunks: string[] = [];
    let currentChunkStartIndex = 0;

    while (currentChunkStartIndex < words.length) {
        let potentialEndIndex = Math.min(currentChunkStartIndex + maxWords, words.length);
        
        if (potentialEndIndex === words.length) {
            chunks.push(words.slice(currentChunkStartIndex).join(' '));
            break;
        }

        let splitIndex = -1;
        for (let i = potentialEndIndex - 1; i >= currentChunkStartIndex; i--) {
            const word = words[i];
            if (/[.?!,]$/.test(word)) {
                splitIndex = i + 1;
                break;
            }
        }
        
        if (splitIndex === -1) {
            splitIndex = potentialEndIndex;
        }

        chunks.push(words.slice(currentChunkStartIndex, splitIndex).join(' '));
        currentChunkStartIndex = splitIndex;
    }

    return chunks.filter(c => c.trim().length > 0);
}

export async function generateVoicePreview(voiceName: string, signal: AbortSignal): Promise<AudioBuffer> {
    const previewText = "Olá, esta é uma amostra da minha voz. Use-a para decidir se é a certa para o seu projeto.";
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: previewText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });

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
    } catch (error) {
        console.error(`Erro ao gerar prévia para a voz ${voiceName}:`, error);
        if (signal.aborted) throw new Error('AbortError');
        throw error;
    }
}


export async function* generateSpeechInChunks(
    text: string,
    settings: GenerationSettings,
    signal: AbortSignal
): AsyncGenerator<{ progress: number; chunk?: AudioBuffer; error?: string }> {
    const chunks = splitText(text, settings.chunkSize);
    const totalChunks = chunks.length;
    if (totalChunks === 0) {
        return;
    }
    const delay = 60000 / settings.reqPerMin;

    for (let i = 0; i < totalChunks; i++) {
        if (signal.aborted) throw new Error('AbortError');

        const chunkText = chunks[i];
        const prompt = `${settings.styleDescription || 'Say:'} ${settings.tone || ''} ${chunkText}`;
        const progress = ((i + 1) / totalChunks) * 100;
        
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: settings.voice },
                        },
                    },
                },
            });
            
            if (signal.aborted) throw new Error('AbortError');

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    outputAudioContext,
                    24000,
                    1
                );
                yield { progress, chunk: audioBuffer };
            } else {
                 let errorMessage = "Não foram recebidos dados de áudio da API.";
                const finishReason = response.candidates?.[0]?.finishReason;
                if (response.promptFeedback?.blockReason) {
                    errorMessage = `Geração bloqueada. Motivo: ${response.promptFeedback.blockReason}`;
                } else if (finishReason && finishReason !== 'STOP') {
                    errorMessage = `Geração interrompida. Motivo: ${finishReason}`;
                }
                console.error(`API response without audio data for chunk ${i+1}:`, JSON.stringify(response, null, 2));
                yield { progress, error: errorMessage };
            }
        } catch (error: any) {
             console.error(`Error processing chunk ${i + 1}:`, error);
             if (signal.aborted) throw new Error('AbortError');
             yield { progress, error: error.message };
        }

        if (i < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
