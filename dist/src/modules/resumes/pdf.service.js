import PDFDocument from "pdfkit";
export async function generatePdf(resume) {
    return new Promise((resolve) => {
        const doc = new PDFDocument();
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        // Header
        doc.fontSize(18).text(`Resume of ${resume.userId}`, { underline: true });
        doc.moveDown();
        // Summary
        if (resume.analysis?.summary) {
            doc.fontSize(14).text(`Summary:`);
            doc.fontSize(12).text(resume.analysis.summary);
            doc.moveDown();
        }
        // Skills
        if (resume.analysis?.skills?.length) {
            doc.fontSize(14).text(`Skills:`);
            resume.analysis.skills.forEach((skill) => {
                doc.fontSize(12).text(`- ${skill}`);
            });
            doc.moveDown();
        }
        // Experience
        if (resume.analysis?.experience !== undefined) {
            doc.fontSize(14).text(`Experience:`);
            doc.fontSize(12).text(`${resume.analysis.experience} years`);
            doc.moveDown();
        }
        // Education
        if (resume.analysis?.education?.length) {
            doc.fontSize(14).text(`Education:`);
            resume.analysis.education.forEach((edu) => {
                doc.fontSize(12).text(`- ${edu.degree} at ${edu.institution} (${edu.year})`);
            });
            doc.moveDown();
        }
        // Strengths
        if (resume.analysis?.strengths?.length) {
            doc.fontSize(14).text(`Strengths:`);
            resume.analysis.strengths.forEach((strength) => {
                doc.fontSize(12).text(`- ${strength}`);
            });
            doc.moveDown();
        }
        // Areas for Improvement
        if (resume.analysis?.improvements?.length) {
            doc.fontSize(14).text(`Areas for Improvement:`);
            resume.analysis.improvements.forEach((improvement) => {
                doc.fontSize(12).text(`- ${improvement}`);
            });
            doc.moveDown();
        }
        doc.end();
    });
}
