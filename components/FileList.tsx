
import React from 'react';
import type { AudioFile, GenerationSettings } from '../types';
import FileItem from './FileItem';

interface FileListProps {
    files: AudioFile[];
    onGenerate: (id: string) => void;
    onCancel: (id: string) => void;
    onUpdateSettings: (id: string, settings: Partial<GenerationSettings>) => void;
    onDelete: (id: string) => void;
    onPreviewVoice: (voice: string) => void;
    previewState: { voice: string; status: 'loading' | 'playing' } | null;
    onDownload: (id: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onGenerate, onCancel, onUpdateSettings, onDelete, onPreviewVoice, previewState, onDownload }) => {
    if (files.length === 0) {
        return (
            <div className="text-center py-16 text-slate-500">
                <p>Nenhum arquivo adicionado.</p>
                <p className="mt-1">Clique em "Adicionar Arquivos" para começar.</p>
            </div>
        );
    }

    return (
        <div className="mt-6 space-y-4">
            {files.map(file => (
                <FileItem
                    key={file.id}
                    file={file}
                    onGenerate={onGenerate}
                    onCancel={onCancel}
                    onUpdateSettings={onUpdateSettings}
                    onDelete={onDelete}
                    onPreviewVoice={onPreviewVoice}
                    previewState={previewState}
                    onDownload={onDownload}
                />
            ))}
        </div>
    );
};

export default FileList;
