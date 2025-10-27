

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioFile, GenerationSettings } from './types';
import { FileStatus } from './types';
import { readDocx } from './utils/fileUtils';
import { generateSpeechInChunks, generateVoicePreview } from './services/geminiService';
import { concatenateAudioBuffers, audioBufferToWav, audioBufferToMp3 } from './utils/audioUtils';
import { VOICES } from './constants';
import Header from './components/Header';
import Controls from './components/Controls';
import FileList from './components/FileList';


const App: React.FC = () => {
    const [files, setFiles] = useState<AudioFile[]>([]);
    const [autoDownload, setAutoDownload] = useState(true);
    const [downloadFormat, setDownloadFormat] = useState<'wav' | 'mp3'>('wav');
    const [previewState, setPreviewState] = useState<{ voice: string; status: 'loading' | 'playing' } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortControllers = useRef<Map<string, AbortController>>(new Map());
    const previewAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const previewAbortControllerRef = useRef<AbortController | null>(null);

    const handleAddFiles = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles) return;

        const newAudioFiles: AudioFile[] = await Promise.all(
            Array.from(selectedFiles).map(async (file: File, index) => {
                const { text, wordCount } = await readDocx(file);
                return {
                    id: `${Date.now()}-${index}`,
                    file,
                    text,
                    wordCount,
                    status: FileStatus.PENDING,
                    progress: 0,
                    settings: {
                        voice: VOICES[0].name,
                        style: 'Personalizado',
                        styleDescription: '',
                        tone: '',
                        chunkSize: 4500, // Changed to characters, default 4500
                        reqPerMin: 60,
                    },
                };
            })
        );
        setFiles(prev => [...prev, ...newAudioFiles]);
        if(event.target) event.target.value = ''; // Reset file input
    }, []);
    
    const updateFile = useCallback((id: string, updates: Partial<AudioFile>) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    }, []);

    const updateFileSettings = useCallback((id: string, settingsUpdate: Partial<GenerationSettings>) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, settings: { ...f.settings, ...settingsUpdate } } : f));
    }, []);
    

    const handlePreviewVoice = useCallback(async (voice: string) => {
        if (previewAudioSourceRef.current) {
            previewAudioSourceRef.current.stop();
            previewAudioSourceRef.current = null;
        }
        if (previewAbortControllerRef.current) {
            previewAbortControllerRef.current.abort();
            previewAbortControllerRef.current = null;
        }

        if (previewState?.voice === voice && previewState.status === 'playing') {
            setPreviewState(null);
            return;
        }

        const controller = new AbortController();
        previewAbortControllerRef.current = controller;

        try {
            setPreviewState({ voice, status: 'loading' });
            
            const audioBuffer = await generateVoicePreview(voice, controller.signal);
            
            if (controller.signal.aborted) return;

            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = () => {
                if (previewAudioSourceRef.current === source) {
                    setPreviewState(null);
                    previewAudioSourceRef.current = null;
                }
            };
            source.start();
            previewAudioSourceRef.current = source;
            setPreviewState({ voice, status: 'playing' });

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                 console.error("Failed to play voice preview:", error);
                 alert(`Falha ao gerar prévia para a voz: ${voice}.`);
            }
            setPreviewState(null);
        } finally {
             if (previewAbortControllerRef.current === controller) {
                previewAbortControllerRef.current = null;
             }
        }
    }, [previewState]);

    const handleGenerate = useCallback(async (id: string) => {
        const fileToProcess = files.find(f => f.id === id);
        if (!fileToProcess || fileToProcess.status === FileStatus.PROCESSING) return;

        const controller = new AbortController();
        abortControllers.current.set(id, controller);
        updateFile(id, { status: FileStatus.PROCESSING, progress: 0, error: undefined, fullAudio: undefined });
        
        try {
            const audioChunks: AudioBuffer[] = [];
            const generationErrors: string[] = [];

            const generator = generateSpeechInChunks(
                fileToProcess.text,
                fileToProcess.settings,
                controller.signal
            );
            
            // First yield gives us the setup information to start the simulation
            const firstResult = await generator.next();
            if (firstResult.done || typeof firstResult.value.totalChunks !== 'number') {
                updateFile(id, { status: FileStatus.COMPLETED, progress: 100 });
                return; 
            }
            
            const { totalChunks } = firstResult.value;
            if (totalChunks === 0) {
                 updateFile(id, { status: FileStatus.COMPLETED, progress: 100 });
                 return;
            }
            
            let processedChunks = 0;
            // Process the rest of the generator
            for await (const update of generator) {
                if (controller.signal.aborted) break;

                processedChunks++;
                // Calculate progress based on chunks completed. This is more accurate.
                const progress = (processedChunks / totalChunks) * 100;
                // We'll cap at 99 and set to 100 only on final completion.
                updateFile(id, { progress: Math.min(99, progress) });

                if (update.chunk) audioChunks.push(update.chunk);
                if (update.error) generationErrors.push(update.error);
            }
            
            if (controller.signal.aborted) return;
            
            if (audioChunks.length === 0) {
                const errorMessage = generationErrors.length > 0 ? generationErrors.join(', ') : 'Nenhum áudio foi gerado.';
                throw new Error(errorMessage);
            }

            const fullAudio = await concatenateAudioBuffers(audioChunks);
            let finalState: Partial<AudioFile> = { progress: 100, fullAudio };

            if (generationErrors.length > 0) {
                finalState.status = FileStatus.ERROR;
                finalState.error = `Concluído com ${generationErrors.length} erro(s). O áudio pode estar incompleto. Ex: ${generationErrors[0]}`;
            } else {
                finalState.status = FileStatus.COMPLETED;
                 if (autoDownload) {
                    let audioBlob: Blob;
                    let fileExtension: string;
                    if (downloadFormat === 'mp3') {
                        audioBlob = audioBufferToMp3(fullAudio);
                        fileExtension = 'mp3';
                    } else {
                        audioBlob = audioBufferToWav(fullAudio);
                        fileExtension = 'wav';
                    }
                    const url = URL.createObjectURL(audioBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${fileToProcess.file.name.replace(/\.[^/.]+$/, "")}.${fileExtension}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            }
            updateFile(id, finalState);
        } catch (error: any) {
            if (error.name !== 'AbortError' && error.message !== 'AbortError') {
                console.error('Generation failed:', error);
                updateFile(id, { status: FileStatus.ERROR, error: error.message });
            }
        } finally {
            abortControllers.current.delete(id);
        }
    }, [files, updateFile, autoDownload, downloadFormat]);

    const handleCancel = useCallback((id: string) => {
        abortControllers.current.get(id)?.abort();
        updateFile(id, { status: FileStatus.CANCELED, progress: 0 });
    }, [updateFile]);

    const handleHumanizeAll = useCallback(() => {
        setFiles(prev => prev.map(f => ({
            ...f,
            settings: {
                ...f.settings,
                styleDescription: 'Say in a warm, engaging, and friendly tone:',
            }
        })));
    }, []);

    const handleGenerateAll = useCallback(() => {
        files.forEach(file => {
            if (file.status === FileStatus.PENDING || file.status === FileStatus.ERROR || file.status === FileStatus.CANCELED) {
                handleGenerate(file.id);
            }
        });
    }, [files, handleGenerate]);
    
    const handleDownload = useCallback((id: string) => {
        const file = files.find(f => f.id === id);
        if (file?.fullAudio) {
            let audioBlob: Blob;
            let fileExtension: string;

            if (downloadFormat === 'mp3') {
                audioBlob = audioBufferToMp3(file.fullAudio);
                fileExtension = 'mp3';
            } else { // 'wav'
                audioBlob = audioBufferToWav(file.fullAudio);
                fileExtension = 'wav';
            }
            
            const url = URL.createObjectURL(audioBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${file.file.name.replace(/\.[^/.]+$/, "")}.${fileExtension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }, [files, downloadFormat]);


    const handleDownloadAll = useCallback(() => {
        files.forEach(file => {
            if (file.fullAudio && (file.status === FileStatus.COMPLETED || file.status === FileStatus.ERROR)) {
                handleDownload(file.id);
            }
        });
    }, [files, handleDownload]);

    const handleClearAll = useCallback(() => {
        files.forEach(file => handleCancel(file.id));
        setFiles([]);
    }, [files, handleCancel]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 font-sans p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Header />
                <main className="mt-8">
                    <Controls
                        onAddFiles={handleAddFiles}
                        onHumanizeAll={handleHumanizeAll}
                        onGenerateAll={handleGenerateAll}
                        onDownloadAll={handleDownloadAll}
                        onClearAll={handleClearAll}
                        autoDownload={autoDownload}
                        onAutoDownloadChange={setAutoDownload}
                        downloadFormat={downloadFormat}
                        onDownloadFormatChange={setDownloadFormat}
                    />
                    <FileList
                        files={files}
                        onGenerate={handleGenerate}
                        onCancel={handleCancel}
                        onUpdateSettings={updateFileSettings}
                        onDelete={(id) => setFiles(files.filter(f => f.id !== id))}
                        onPreviewVoice={handlePreviewVoice}
                        previewState={previewState}
                        onDownload={handleDownload}
                    />
                </main>
                <footer className="text-center mt-12 text-slate-500 text-sm">
                    <p>© 2025 DarkLine Voice Studio. Todos os direitos reservados.</p>
                </footer>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".docx"
                    multiple
                    className="hidden"
                />
            </div>
        </div>
    );
};

export default App;