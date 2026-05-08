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

// --- ROUTES ---

/**
 * Root Route - Secure Status Check
 * Removed extracted text display to ensure Data Privacy.
 */
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

/**
 * OCR Processing Route
 * Implements Ingress API Key validation and Zero-Persistence cleanup.
 */
app.post('/ocr', async (req, res) => {
    // 1. API Key Validation (Security Layer)
    const clientKey = req.header('X-API-KEY');
    if (!clientKey || clientKey !== VALID_API_KEY) {
        console.warn(`[SECURITY] Unauthorized access attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Access Denied' });
    }

    console.log('--- NEW OCR REQUEST RECEIVED ---', req);
    let tempFilePath = null;

    try {
        let base64String;
        let fileExtension = 'png'; // Default fallback

        // 2. Extraction & Extension Detection
        if (req.body && req.body.file) {
            // Handle Data URIs (e.g., data:application/pdf;base64,...)
            const matches = req.body.file.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                const mimeType = matches[1];
                base64String = matches[2];
                fileExtension = mimeType.includes('pdf') ? 'pdf' : 'png';
            } else {
                base64String = req.body.file;
            }
        } else if (req.files && req.files.file) {
            // Handle Multipart Form-Data (Postman style)
            base64String = req.files.file.data.toString('base64');
            fileExtension = path.extname(req.files.file.name).replace('.', '').toLowerCase() || 'png';
        } else {
            return res.status(400).json({ error: 'No file data provided in field "file".' });
        }

        // 3. Save to Ephemeral Volume
        const fileName = `${uuidv4()}.${fileExtension}`;
        tempFilePath = path.join(tempDir, fileName);
        
        console.log(`Step 2: Saving ${fileExtension.toUpperCase()} to temporary path.`);
        fs.writeFileSync(tempFilePath, base64String, { encoding: 'base64' });

        // 4. Secure Local Import & Execution
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        console.log(`Step 4: Orchestrating Scribe.js Engine...`);
        const result = await scribe.extractText([tempFilePath], ['eng'], 'txt');

        // 5. Successful Response
        console.log('Step 5: SUCCESS - Returning extracted text.');
        res.json({ text: result });

    } catch (err) {
        console.error('OCR ENGINE ERROR:', err.message);
        res.status(500).json({ error: 'Processing failed: ' + err.message });
    } finally {
        // 6. Primary Cleanup (Immediate fs.unlink)
        // Ensures Zero-Data Persistence even if the process fails mid-way.
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log('Step 6: Primary Cleanup verified. File purged.');
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