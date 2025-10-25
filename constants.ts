
import type { Voice } from './types';

// The list of voices is derived directly from the API's error message to ensure compatibility.
// They are sorted alphabetically for better user experience in dropdowns.
const supportedVoiceNames: string[] = [
    'achernar',
    'achird',
    'algenib',
    'algieba',
    'alnilam',
    'aoede',
    'autonoe',
    'callirrhoe',
    'charon',
    'despina',
    'enceladus',
    'erinome',
    'fenrir',
    'gacrux',
    'iapetus',
    'kore',
    'laomedeia',
    'leda',
    'orus',
    'puck',
    'pulcherrima',
    'rasalgethi',
    'sadachbia',
    'sadaltager',
    'schedar',
    'sulafat',
    'umbriel',
    'vindemiatrix',
    'zephyr',
    'zubenelgenubi',
].sort();

export const VOICES: Voice[] = supportedVoiceNames.map((name, index) => ({
    name: name,
    label: `${index + 1}. ${name.charAt(0).toUpperCase() + name.slice(1)}`
}));


export const STYLES = [
    { name: 'Personalizado', description: '' },
    { name: 'Narrativo', description: 'Say in a narrative, storytelling voice:' },
    { name: 'Comercial', description: 'Say in an upbeat, persuasive, and commercial tone:' },
    { name: 'Informativo', description: 'Say in a clear, neutral, and informative tone:' }
];
