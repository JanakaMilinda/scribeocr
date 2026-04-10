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

        // 1. Get the base64 string
        if (req.body && req.body.image) {
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image found' });
        }

        // 2. Convert to Buffer
        const buffer = Buffer.from(base64String, 'base64');

        // 3. Dynamic Import Scribe
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        console.log('Step 4: Running OCR on provided data...');
        
        // Pass an object that mimics a File object. 
        // This bypasses the 'toString' crash in imageUtils.js
        const result = await scribe.extractText([{
            data: new Uint8Array(buffer),
            name: 'input.png',
            type: 'image/png'
        }]);
        
        // 5. Check the result structure
        let finalOutput = '';
        if (Array.isArray(result) && result.length > 0) {
            // Join if it's an array of lines/words, or just take the first index
            finalOutput = typeof result[0] === 'string' ? result[0] : JSON.stringify(result[0]);
        }

        console.log('Step 5: SUCCESS! Returning text.');
        res.json({ text: finalOutput }); 

    } catch (err) {
        console.error('OCR ERROR:', err.message);
        console.error('STACK:', err.stack);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));