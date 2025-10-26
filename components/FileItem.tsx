import React from 'react';
import type { AudioFile, GenerationSettings } from '../types';
import { FileStatus } from '../types';
import { VOICES, STYLES } from '../constants';
import { PlayIcon, StopCircleIcon, TrashIcon, XCircleIcon, SpinnerIcon, DownloadIcon } from './icons';

interface FileItemProps {
    file: AudioFile;
    onGenerate: (id: string) => void;
    onCancel: (id: string) => void;
    onUpdateSettings: (id: string, settings: Partial<GenerationSettings>) => void;
    onDelete: (id: string) => void;
    onPreviewVoice: (voice: string) => void;
    previewState: { voice: string; status: 'loading' | 'playing' } | null;
    onDownload: (id: string) => void;
}

const FileItem: React.FC<FileItemProps> = ({ file, onGenerate, onCancel, onUpdateSettings, onDelete, onPreviewVoice, previewState, onDownload }) => {

    const handleSettingsChange = (field: keyof GenerationSettings, value: string | number) => {
        onUpdateSettings(file.id, { [field]: value });
    };

    const handleStyleChange = (newStyleName: string) => {
        const selectedStyle = STYLES.find(s => s.name === newStyleName);
        if (selectedStyle) {
            onUpdateSettings(file.id, {
                style: selectedStyle.name,
                styleDescription: selectedStyle.description,
            });
        }
    };

    const getStatusInfo = () => {
        switch (file.status) {
            case FileStatus.PROCESSING:
                return { text: 'PROCESSANDO', color: 'text-blue-400' };
            case FileStatus.COMPLETED:
                return { text: 'CONCLUÍDO', color: 'text-green-400' };
            case FileStatus.ERROR:
                return { text: 'ERRO', color: 'text-red-400' };
            case FileStatus.CANCELED:
                return { text: 'CANCELADO', color: 'text-yellow-400' };
            default:
                return { text: 'PENDENTE', color: 'text-slate-500' };
        }
    };
    
    const statusInfo = getStatusInfo();
    const isProcessing = file.status === FileStatus.PROCESSING;
    // Only disable controls while actively processing.
    const isActionDisabled = isProcessing;

    const isThisPreviewLoading = previewState?.status === 'loading' && previewState.voice === file.settings.voice;
    const isThisPreviewPlaying = previewState?.status === 'playing' && previewState.voice === file.settings.voice;

    return (
        <div className="bg-slate-800/70 border border-slate-700 rounded-lg p-4 space-y-4 transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-start md:gap-4">
                {/* File Info */}
                <div className="flex-shrink-0 md:w-56 lg:w-72 mb-4 md:mb-0">
                    <p className="font-bold text-white truncate" title={file.file.name}>{file.file.name}</p>
                    <p className={`text-xs font-semibold ${statusInfo.color}`}>{statusInfo.text}</p>
                    <p className="text-xs text-slate-400 mt-1">Total de Palavras: {file.wordCount}</p>
                </div>

                {/* Controls */}
                <div className="flex-grow">
                    <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                        {/* Narrador */}
                        <div className="flex-shrink-0" style={{minWidth: '150px'}}>
                            <label className="text-xs text-slate-400 block mb-1">Narrador</label>
                            <div className="flex items-center gap-2">
                                <select
                                    disabled={isActionDisabled}
                                    value={file.settings.voice}
                                    onChange={(e) => handleSettingsChange('voice', e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                                >
                                    {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                </select>
                                <button 
                                    onClick={() => onPreviewVoice(file.settings.voice)} 
                                    disabled={isActionDisabled || previewState?.status === 'loading'}
                                    className="p-2 bg-slate-700 rounded-md text-white disabled:text-slate-500 disabled:cursor-not-allowed hover:bg-slate-600 transition-opacity"
                                    aria-label={`Ouvir prévia da voz ${file.settings.voice}`}
                                >
                                    {isThisPreviewPlaying ? <StopCircleIcon className="w-5 h-5" /> : 
                                     isThisPreviewLoading ? <SpinnerIcon className="w-5 h-5" /> : 
                                     <PlayIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        {/* Estilo */}
                        <div className="flex-grow min-w-[250px]">
                            <label className="text-xs text-slate-400 block mb-1">Estilo</label>
                            <div className="flex gap-2">
                                <select
                                    disabled={isActionDisabled}
                                    value={file.settings.style}
                                    onChange={(e) => handleStyleChange(e.target.value)}
                                    className="w-2/5 bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                                >
                                    {STYLES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                                <input
                                    disabled={isActionDisabled}
                                    type="text"
                                    placeholder="Descreva o estilo ou selecione um"
                                    value={file.settings.styleDescription}
                                    onChange={(e) => handleSettingsChange('styleDescription', e.target.value)}
                                    className="w-3/5 bg-slate-700 border border-slate-600 rounded-md p-2 text-sm placeholder-slate-500 disabled:opacity-50"
                                />
                            </div>
                        </div>
                         {/* Chunk Size */}
                        <div className="flex-shrink-0 w-28">
                            <label className="text-xs text-slate-400 block mb-1">Palavras/Pedaço</label>
                            <input
                                disabled={isActionDisabled}
                                type="number"
                                value={file.settings.chunkSize}
                                onChange={(e) => handleSettingsChange('chunkSize', parseInt(e.target.value, 10))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm disabled:opacity-50"
                            />
                        </div>
                        {/* Req/Min */}
                        <div className="flex-shrink-0 w-24">
                            <label className="text-xs text-slate-400 block mb-1">Req/Min</label>
                            <input
                                disabled={isActionDisabled}
                                type="number"
                                value={file.settings.reqPerMin}
                                onChange={(e) => handleSettingsChange('reqPerMin', parseInt(e.target.value, 10))}
                                className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Action Button & Delete */}
                <div className="flex flex-shrink-0 items-center justify-end gap-2 mt-4 md:mt-0 md:self-end">
                    {isProcessing ? (
                        <button onClick={() => onCancel(file.id)} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 w-full md:w-auto justify-center">
                            <XCircleIcon className="w-5 h-5"/> Cancelar
                        </button>
                    ) : (
                        <button onClick={() => onGenerate(file.id)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 w-full md:w-auto justify-center disabled:bg-slate-600 disabled:cursor-not-allowed">
                           <PlayIcon className="w-5 h-5"/> Gerar
                        </button>
                    )}
                     {file.fullAudio && (
                        <button onClick={() => onDownload(file.id)} className="text-slate-400 hover:text-white p-2 rounded-md transition-colors" title="Baixar áudio">
                            <DownloadIcon className="w-5 h-5"/>
                        </button>
                    )}
                     <button onClick={() => onDelete(file.id)} className="text-slate-500 hover:text-red-400 p-2 rounded-md transition-colors">
                        <TrashIcon className="w-5 h-5"/>
                    </button>
                </div>
            </div>

            {/* Progress Bar & Error */}
            {isProcessing && (
                 <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                         <div className="text-right w-full">
                            <span className="text-xs font-semibold inline-block text-blue-400">
                                {file.progress.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                    <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-slate-700">
                        <div style={{ width: `${file.progress}%` }} className="shadow-none rounded-full flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500 ease-out progress-bar-striped progress-bar-animated"></div>
                    </div>
                </div>
            )}
             {file.status === FileStatus.ERROR && file.error && (
                <p className="text-sm text-red-400 mt-2">Erro: {file.error}</p>
            )}
        </div>
    );
};

export default FileItem;