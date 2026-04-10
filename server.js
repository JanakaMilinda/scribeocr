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

        if (req.body && req.body.image) {
            console.log('Step 1: Found image in req.body');
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            console.log('Step 1: Found image in req.files');
            base64String = req.files.image.data.toString('base64');
        } else {
            console.log('Step 1 FAILED: No image found in body or files');
            return res.status(400).json({ error: 'No image data provided.' });
        }

        console.log('Step 2: Converting Base64 to Uint8Array (Length: ' + base64String.length + ')');
        const buffer = Buffer.from(base64String, 'base64');
        const uint8Array = new Uint8Array(buffer);

        console.log('Step 3: Creating Virtual File Object');
        const virtualFile = {
            data: uint8Array,
            name: 'upload.png',
            type: 'image/png' // Added explicit type to help imageUtils.js
        };

        console.log('Step 4: Importing scribe.js');
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        console.log('Step 5: Calling scribe.extractText()...');
        
        // Final attempt at the most "standard" format for this library
        const result = await scribe.extractText([virtualFile]);
        
        console.log('Step 6: SUCCESS! Text extracted.');
        res.json({ text: result[0] }); 

    } catch (err) {
        console.error('CRASH AT STEP ' + (err.stack.includes('server.js') ? 'SERVER' : 'LIBRARY') + ':');
        console.error('Error Message:', err.message);
        console.error('Full Stack Trace:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));