const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(fileUpload());

app.get('/', (req, res) => {
    res.send('OCR Server is active.');
});

app.post('/ocr', async (req, res) => {
    console.log('--- NEW REQUEST RECEIVED ---');
    try {
        let base64String;

        // Step 1: Extract Base64
        if (req.body && req.body.image) {
            console.log('Step 1: Found image in req.body');
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            console.log('Step 1: Found image in req.files');
            base64String = req.files.image.data.toString('base64');
        } else {
            console.log('Step 1 FAILED: No image found');
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Step 2: Convert to Uint8Array
        // Scribe needs this raw binary format to pass to its internal WASM/Tesseract engine
        console.log('Step 2: Converting Base64 to Uint8Array (Length: ' + base64String.length + ')');
        const buffer = Buffer.from(base64String, 'base64');
        const uint8Array = new Uint8Array(buffer);

        // Step 3: Dynamic Import
        console.log('Step 3: Importing scribe.js');
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Step 4: Call extractText with the raw Uint8Array
        // Step 4: Pass the local data you already prepared in Step 2
        console.log('Step 4: Calling scribe.extractText() with local buffer...');

        // Instead of the Salesforce URL, pass the uint8Array you created
        const result = await scribe.extractText(uint8Array); 

        console.log('Step 5: SUCCESS!');
        res.json({ text: result });

    } catch (err) {
        console.error('CRASH LOGGED:');
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));