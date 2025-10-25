
// This requires lamejs to be loaded, e.g., via CDN in index.html
declare const lamejs: any;

// Manual base64 decode function as per guidelines
export function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Custom PCM decoder as per guidelines
export async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


export async function concatenateAudioBuffers(buffers: AudioBuffer[]): Promise<AudioBuffer> {
    if (buffers.length === 0) {
        throw new Error("Buffer list is empty");
    }
    
    const firstBuffer = buffers[0];
    const { numberOfChannels, sampleRate } = firstBuffer;
    
    const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const result = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

    let offset = 0;
    for (const buffer of buffers) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            result.getChannelData(channel).set(buffer.getChannelData(channel), offset);
        }
        offset += buffer.length;
    }
    
    return result;
}


function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferOut = new ArrayBuffer(length);
    const view = new DataView(bufferOut);
    const channels = [];
    let i, sample;
    let offset = 0;
    const pos = 0;

    // write WAVE header
    writeString(view, offset, 'RIFF'); offset += 4;
    view.setUint32(offset, length - 8, true); offset += 4;
    writeString(view, offset, 'WAVE'); offset += 4;
    writeString(view, offset, 'fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, numOfChan, true); offset += 2;
    view.setUint32(offset, buffer.sampleRate, true); offset += 4;
    view.setUint32(offset, buffer.sampleRate * 2 * numOfChan, true); offset += 4;
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    view.setUint16(offset, 16, true); offset += 2;
    writeString(view, offset, 'data'); offset += 4;
    view.setUint32(offset, length - pos - 44, true); offset += 4;

    // write PCM samples
    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    let sampleIndex = 0;
    while (offset < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][sampleIndex]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        sampleIndex++;
    }

    return new Blob([view], { type: 'audio/wav' });
}

function samplesToInterleavedInt16(buffers: Float32Array[]): Int16Array {
    const numSamples = buffers[0].length;
    const numChannels = buffers.length;
    const interleaved = new Int16Array(numSamples * numChannels);

    let offset = 0;
    for (let i = 0; i < numSamples; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            let sample = buffers[channel][i];
            sample = Math.max(-1, Math.min(1, sample));
            interleaved[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
    }
    return interleaved;
}

export function audioBufferToMp3(buffer: AudioBuffer): Blob {
    if (typeof lamejs === 'undefined') {
        throw new Error('lamejs library is not loaded. Please include it in your HTML.');
    }

    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    const samples = samplesToInterleavedInt16(channels);
    
    const mp3encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, 128); // 128kbps
    const mp3Data = [];

    const sampleBlockSize = 1152;
    for (let i = 0; i < samples.length; i += sampleBlockSize * buffer.numberOfChannels) {
        const endIndex = i + (sampleBlockSize * buffer.numberOfChannels);
        const sampleChunk = samples.subarray(i, endIndex);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }
    
    return new Blob(mp3Data, { type: 'audio/mpeg' });
}
