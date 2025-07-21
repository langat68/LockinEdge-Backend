declare module 'pdf-parse' {
  interface PDFResult {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }

  function pdf(dataBuffer: Buffer | Uint8Array): Promise<PDFResult>;

  export = pdf;
}
