export interface Voice {
    name: string;
    label: string;
}

export enum FileStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    ERROR = 'ERROR',
    CANCELED = 'CANCELED',
}

export interface GenerationSettings {
    voice: string;
    style: string;
    styleDescription: string;
    tone: string;
    chunkSize: number;
    reqPerMin: number;
}

export interface AudioFile {
    id: string;
    file: File;
    text: string;
    wordCount: number;
    status: FileStatus;
    progress: number;
    settings: GenerationSettings;
    audioChunks?: AudioBuffer[];
    fullAudio?: AudioBuffer;
    error?: string;
}