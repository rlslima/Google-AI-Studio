// This requires mammoth.js to be loaded, e.g., via CDN in index.html
declare const mammoth: any;

export async function readDocx(file: File): Promise<{ text: string; wordCount: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                if (!event.target?.result) {
                    throw new Error("Failed to read file.");
                }
                const arrayBuffer = event.target.result as ArrayBuffer;
                const result = await mammoth.extractRawText({ arrayBuffer });
                const text = result.value;
                const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
                resolve({ text, wordCount });
            } catch (error) {
                console.error("Error processing DOCX file:", error);
                reject("Could not read text from DOCX file.");
            }
        };
        reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject("Error reading file.");
        };
        reader.readAsArrayBuffer(file);
    });
}