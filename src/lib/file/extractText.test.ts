import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pdfjs-dist', () => ({
	GlobalWorkerOptions: { workerSrc: '' },
	getDocument: vi.fn(),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
	default: '/mocked-worker.mjs',
}));

import { extractTextFromFile, UnsupportedFileTypeError } from './extractText';
import { getDocument } from 'pdfjs-dist';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';

describe('extractTextFromFile', () => {
	beforeEach(() => {
		vi.mocked(getDocument).mockReset();
	});

	describe('txt extraction', () => {
		it('returns file text content', async () => {
			const file = new File(['hello world'], 'test.txt', {
				type: 'text/plain',
			});
			expect(await extractTextFromFile(file)).toBe('hello world');
		});

		it('detects txt by extension without mime type', async () => {
			const file = new File(['plain text'], 'notes.txt', { type: '' });
			expect(await extractTextFromFile(file)).toBe('plain text');
		});
	});

	describe('pdf extraction', () => {
		it('extracts text from all pages joined by newlines', async () => {
			const mockDoc = {
				numPages: 2,
				getPage: vi.fn((n: number) =>
					Promise.resolve({
						getTextContent: () =>
							Promise.resolve({
								items: [{ str: `page${n}` }],
							}),
					}),
				),
			};
			const mockLoadingTask = {
				promise: Promise.resolve(mockDoc),
				destroy: vi.fn().mockResolvedValue(undefined),
			};
			vi.mocked(getDocument).mockReturnValue(
				mockLoadingTask as unknown as PDFDocumentLoadingTask,
			);

			const file = new File([new ArrayBuffer(8)], 'test.pdf', {
				type: 'application/pdf',
			});
			const result = await extractTextFromFile(file);

			expect(result).toBe('page1\npage2');
			expect(mockLoadingTask.destroy).toHaveBeenCalledTimes(1);
		});

		it('returns empty string for PDF with no text layer', async () => {
			const mockDoc = {
				numPages: 1,
				getPage: vi.fn(() =>
					Promise.resolve({
						getTextContent: () => Promise.resolve({ items: [] }),
					}),
				),
			};
			vi.mocked(getDocument).mockReturnValue({
				promise: Promise.resolve(mockDoc),
				destroy: vi.fn().mockResolvedValue(undefined),
			} as unknown as PDFDocumentLoadingTask);

			const file = new File([new ArrayBuffer(8)], 'scanned.pdf', {
				type: 'application/pdf',
			});
			expect(await extractTextFromFile(file)).toBe('');
		});

		it('skips TextMarkedContent items without str property', async () => {
			const mockDoc = {
				numPages: 1,
				getPage: vi.fn(() =>
					Promise.resolve({
						getTextContent: () =>
							Promise.resolve({
								items: [
									{ str: 'real text' },
									{ type: 'markedContent' },
								],
							}),
					}),
				),
			};
			vi.mocked(getDocument).mockReturnValue({
				promise: Promise.resolve(mockDoc),
				destroy: vi.fn().mockResolvedValue(undefined),
			} as unknown as PDFDocumentLoadingTask);

			const file = new File([new ArrayBuffer(8)], 'test.pdf', {
				type: 'application/pdf',
			});
			expect(await extractTextFromFile(file)).toBe('real text');
		});
	});

	describe('unsupported types', () => {
		it('throws UnsupportedFileTypeError for .docx', async () => {
			const file = new File(['data'], 'doc.docx', {
				type: 'application/octet-stream',
			});
			await expect(extractTextFromFile(file)).rejects.toThrow(
				UnsupportedFileTypeError,
			);
		});

		it('throws UnsupportedFileTypeError for .png', async () => {
			const file = new File(['img'], 'pic.png', { type: 'image/png' });
			await expect(extractTextFromFile(file)).rejects.toThrow(
				UnsupportedFileTypeError,
			);
		});
	});
});
