
import React from 'react';
// Fix: Removed unused 'XIcon' import which is not exported from './icons'.
import { CheckboxIcon, DownloadIcon, FilePlusIcon, FlaskConicalIcon, PlayIcon, TrashIcon } from './icons';

interface ControlsProps {
    onAddFiles: () => void;
    onHumanizeAll: () => void;
    onGenerateAll: () => void;
    onDownloadAll: () => void;
    onClearAll: () => void;
    autoDownload: boolean;
    onAutoDownloadChange: (checked: boolean) => void;
    downloadFormat: 'wav' | 'mp3';
    onDownloadFormatChange: (format: 'wav' | 'mp3') => void;
}

const Controls: React.FC<ControlsProps> = ({
    onAddFiles,
    onHumanizeAll,
    onGenerateAll,
    onDownloadAll,
    onClearAll,
    autoDownload,
    onAutoDownloadChange,
    downloadFormat,
    onDownloadFormatChange
}) => {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
                <h2 className="text-lg font-semibold text-white">Processamento em Lote</h2>
                <p className="text-sm text-slate-400">Envie arquivos .docx e configure a geração de áudio.</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {/* Settings */}
                <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-md">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={autoDownload}
                            onChange={(e) => onAutoDownloadChange(e.target.checked)}
                            className="hidden"
                        />
                        <div className={`w-5 h-5 rounded border-2 ${autoDownload ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-600'} flex items-center justify-center`}>
                            {autoDownload && <CheckboxIcon className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-slate-200 text-sm">Download Auto</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <label htmlFor="download-format" className="text-slate-300 text-sm">Formato</label>
                        <select
                            id="download-format"
                            value={downloadFormat}
                            onChange={(e) => onDownloadFormatChange(e.target.value as 'wav' | 'mp3')}
                            className="bg-slate-700 border border-slate-600 rounded-md py-1 px-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
                        >
                            <option value="wav">WAV</option>
                            <option value="mp3">MP3</option>
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={onAddFiles} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
                        <FilePlusIcon className="w-5 h-5" /> Adicionar
                    </button>
                    <button onClick={onHumanizeAll} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-3 rounded-md flex items-center gap-2 transition-colors" title="Humanizar Todos">
                        <FlaskConicalIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onGenerateAll} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
                        <PlayIcon className="w-5 h-5" /> Gerar Todos
                    </button>
                    <button onClick={onDownloadAll} className="bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 px-3 rounded-md flex items-center gap-2 transition-colors" title="Baixar Todos">
                       <DownloadIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onClearAll} className="bg-red-900/50 hover:bg-red-900/80 text-red-300 py-2 px-3 rounded-md flex items-center gap-2 transition-colors" title="Limpar Todos">
                        <TrashIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Controls;
