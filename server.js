const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const VALID_API_KEY = "12345678"; // MUST match Salesforce Named Credential password
const tempDir = path.join(process.cwd(), 'temp_ocr');

// Ensure isolated temp directory exists for Ephemeral Storage
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(fileUpload());

app.get('/', (req, res) => {
    res.status(200).send({
        status: "Online",
        message: "ScribeOCR Service is running. Use POST /ocr with valid API Key.",
        timestamp: new Date().toISOString()
    });
});
// app.get('/', (req, res) => {
//     const html = `
//     <!DOCTYPE html>
//     <html>
//     <head>
//         <title>OCR Server Status</title>
//         <style>
//             body { font-family: sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: auto; background: #f4f4f9; }
//             .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
//             h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
//             .status { font-weight: bold; color: green; }
//             .timestamp { color: #666; font-size: 0.9em; }
//             pre { background: #eee; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; border: 1px solid #ccc; }
//         </style>
//     </head>
//     <body>
//         <div class="container">
//             <h1>OCR Server Dashboard</h1>
//             <p>Server Status: <span class="status">Online</span></p>
//             <p class="timestamp">Last Updated: ${lastUpdateTimestamp}</p>
//             <hr>
//             <h3>Extracted Text:</h3>
//             <pre>${lastExtractedText}</pre>
//             <p><small>Send POST requests to <code>/ocr</code> to update this content.</small></p>
//         </div>
//         <script>
//             // Optional: Refresh the page every 30 seconds to see updates
//             setTimeout(() => { location.reload(); }, 30000);
//         </script>
//     </body>
//     </html>
//     `;
//     res.send(html);
// });

app.post('/ocr', async (req, res) => {
    const clientKey = req.header('X-API-KEY');
    if (!clientKey || clientKey !== VALID_API_KEY) {
        console.warn(`[SECURITY] Unauthorized access attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Access Denied' });
    }

    console.log('--- NEW OCR REQUEST RECEIVED ---');
    let tempFilePath = null;

    try {
        let base64String;
        let fileExtension = req.body.ext || 'png';

        // Extraction Logic
        if (req.body && req.body.file) {
            const matches = req.body.file.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                base64String = matches[2];
                if (!req.body.ext) {
                    fileExtension = matches[1].includes('pdf') ? 'pdf' : 'png';
                }
            } else {
                base64String = req.body.file;
                if (!req.body.ext && base64String.startsWith('JVBERi')) {
                    fileExtension = 'pdf';
                }
            }
        } else if (req.files && req.files.file) {
            base64String = req.files.file.data.toString('base64');
            fileExtension = path.extname(req.files.file.name).replace('.', '').toLowerCase() || 'png';
        } else {
            return res.status(400).json({ error: 'No file data provided.' });
        }

        // Save temp file
        const fileName = `${uuidv4()}.${fileExtension}`;
        tempFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempFilePath, base64String, { encoding: 'base64' });

        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Always await init with pdf:true so MuPDF is ready before importFiles
        await scribe.init({ ocr: true, font: true, pdf: true });

        await scribe.importFiles([tempFilePath]);

        const { inputData } = scribe;
        if (!inputData.xmlMode[0] && !inputData.imageMode && !inputData.pdfMode) {
            throw new Error('No relevant files to process.');
        }

        const isNativePDF = inputData.pdfMode && inputData.pdfType === 'text';
        const isXmlOnly  = inputData.xmlMode[0] && !inputData.imageMode && !inputData.pdfMode;

        if (!isNativePDF && !isXmlOnly) {
            await scribe.recognize({ langs: ['eng'] });
        }

        const result = await scribe.exportData('txt');

        // Clear state between requests so page data doesn't bleed into next call
        await scribe.clear();

        res.json({ text: result });

    } catch (err) {
        console.error('OCR ENGINE ERROR:', err.message);
        res.status(500).json({ error: 'Processing failed: ' + err.message });
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log('File purged from ephemeral storage.');
            } catch (cleanupErr) {
                console.error('Cleanup Warning:', cleanupErr.message);
            }
        }
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`ScribeOCR Server listening on port ${PORT}`);
    console.log(`Security: X-API-KEY validation enabled.`);
});