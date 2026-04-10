const express = require('express');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Install this: npm install uuid

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(fileUpload());
// 1. Root route to confirm server is up
app.get('/', (req, res) => {
    res.send('Server Status: Online. Send POST requests to /ocr');
});
// Ensure a temp directory exists
const tempDir = path.join(process.cwd(), 'temp_ocr');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.post('/ocr', async (req, res) => {
    console.log('--- NEW REQUEST RECEIVED ---');
    let tempFilePath = null;

    try {
        let base64String;

        // Step 1: Extract Base64
        if (req.body && req.body.image) {
            base64String = req.body.image.replace(/^data:image\/\w+;base64,/, "");
        } else if (req.files && req.files.image) {
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Step 2: Save to a temporary file
        const fileName = `${uuidv4()}.png`;
        tempFilePath = path.join(tempDir, fileName);
        
        console.log(`Step 2: Saving image to temporary path: ${tempFilePath}`);
        fs.writeFileSync(tempFilePath, base64String, { encoding: 'base64' });

        // Step 3: Dynamic Import Scribe
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Step 4: Call extractText with the FILE PATH
        // Since the library likes URLs/Paths, we pass the local absolute path
        console.log('Step 4: Calling scribe.extractText() with file path...');
        const result = await scribe.extractText([tempFilePath], ['eng'], 'txt');

        console.log('Step 5: SUCCESS!');
        res.json({ text: result });

    } catch (err) {
        console.error('OCR ERROR:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        // Step 6: CLEANUP - Delete the file so you don't run out of disk space
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log('Step 6: Temporary file deleted.');
            } catch (cleanupErr) {
                console.error('Cleanup Error:', cleanupErr.message);
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));