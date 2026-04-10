const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(fileUpload());

app.post('/ocr', async (req, res) => {
    console.log('--- NEW REQUEST RECEIVED ---');
    try {
        let base64String;

        // Step 1: Extract Base64 and strip Data URL prefix if present
        if (req.body && req.body.image) {
            console.log('Step 1: Found image in req.body');
            // Remove prefix: "data:image/png;base64,"
            base64String = req.body.image.replace(/^data:image\/\w+;base64,/, "");
        } else if (req.files && req.files.image) {
            console.log('Step 1: Found image in req.files');
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Step 2: Convert to Uint8Array
        console.log(`Step 2: Converting Base64 (len: ${base64String.length}) to Uint8Array`);
        const buffer = Buffer.from(base64String, 'base64');
        const uint8Array = new Uint8Array(buffer);

        // Step 3: Dynamic Import Scribe
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Step 4: Call extractText with the binary data
        // We pass it as [uint8Array] because scribe expects an array of "files"
        // Step 4: Call extractText with a "File-like" object
        // Step 4: Wrap the buffer in a "Virtual File" object
        console.log('Step 4: Calling scribe.extractText() with virtual file object...');

        // We create an object that mimics the 'File' interface the library expects
        const virtualFile = {
            name: 'document.png', // This provides the extension for the .match() call
            data: uint8Array      // This is your actual binary data
        };

        // Pass the object inside an array [ ]
        const result = await scribe.extractText([virtualFile], ['eng'], 'txt');

        console.log('Step 5: SUCCESS!');
        res.json({ text: result });

    } catch (err) {
        console.error('OCR ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));