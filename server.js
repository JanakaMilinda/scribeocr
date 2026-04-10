const express = require('express');
const fileUpload = require('express-fileupload');

const app = express();

// 1. Add JSON parsing middleware (Salesforce sends JSON)
// Set a 10MB limit to handle high-resolution image strings
app.use(express.json({ limit: '10mb' }));

// 2. Keep fileUpload for testing with standard HTML forms
app.use(fileUpload());

app.get('/', (req, res) => {
    res.send('OCR Server is active and waiting for requests.');
});

app.post('/ocr', async (req, res) => {
    try {
        let base64String;

        // 1. Get the raw Base64 string
        if (req.body && req.body.image) {
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // 2. Convert Base64 to a Uint8Array (Standard for Scribe/WASM)
        const buffer = Buffer.from(base64String, 'base64');
        const uint8Array = new Uint8Array(buffer);

        // 3. Create a "Virtual File" object
        // This gives Scribe the data AND the extension without a long 'filename'
        const virtualFile = {
            data: uint8Array,
            name: 'upload.png' 
        };

        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        console.log('Running OCR on Virtual File...');
        
        // 4. Pass the virtual file object in the array
        const result = await scribe.extractText([virtualFile]);
        
        res.json({ text: result[0] }); 

    } catch (err) {
        console.error('Detailed Server Error:', err); 
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));