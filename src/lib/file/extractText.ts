export class UnsupportedFileTypeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedFileTypeError';
	}
}

function getExtension(name: string): string {
	const parts = name.toLowerCase().split('.');
	return parts.length > 1 ? parts[parts.length - 1] : '';
}

export async function extractTextFromFile(file: File): Promise<string> {
	const ext = getExtension(file.name);

	if (ext === 'txt' || file.type === 'text/plain') {
		return file.text();
	}

	if (ext === 'pdf' || file.type === 'application/pdf') {
		return extractPdfText(file);
	}

	throw new UnsupportedFileTypeError(`Unsupported file type: ${file.name}`);
}

async function extractPdfText(file: File): Promise<string> {
	const pdfjsLib = await import('pdfjs-dist');
	const workerUrl = (
		await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
	).default;
	pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

	const arrayBuffer = await file.arrayBuffer();
	const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
	const pdf = await loadingTask.promise;

	const textParts: string[] = [];
	for (let i = 1; i <= pdf.numPages; i++) {
		const page = await pdf.getPage(i);
		const content = await page.getTextContent();
		const pageText = content.items
			.map((item) => ('str' in item ? item.str : ''))
			.join(' ');
		textParts.push(pageText);
	}

	await loadingTask.destroy();
	return textParts.join('\n').trim();
}
