const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const app = express();
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
        let result; // ← declared here so both branches can assign it

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

        const fileName = `${uuidv4()}.${fileExtension}`;
        tempFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempFilePath, base64String, { encoding: 'base64' });

        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        if (fileExtension === 'pdf') {
            console.log('Initializing PDF Engine...');
            await scribe.init({ ocr: true, font: true, pdf: true });
            await scribe.importFiles([tempFilePath]); // ← use tempFilePath, not hardcoded string
            await scribe.recognize({ langs: ['eng'] });
            result = await scribe.exportData('txt');
            await scribe.clear();
        } else {
            console.log(`Extracting text from ${fileExtension.toUpperCase()}...`);
            result = await scribe.extractText([tempFilePath], ['eng'], 'txt');
        }

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