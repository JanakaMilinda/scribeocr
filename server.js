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
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // Step 2: Clean and Format
        // Strip any existing data prefix just in case, then add a clean one
        const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, "");
        
        // We use .png as a generic placeholder so the library's .match(/\.png/) works
        const dataUrl = `data:image/png;base64,${cleanBase64}`;

        // Step 3: Dynamic Import
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        const fs = require('fs');
const path = require('path');

// Extract the base64 data (remove the prefix)
const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
const tempPath = path.join(__dirname, 'temp_image.png');

// Write to disk
fs.writeFileSync(tempPath, base64Data, 'base64');

// Pass the path, NOT the data string
const text = await scribe.extractText(tempPath);

// Cleanup
fs.unlinkSync(tempPath);
        
        console.log('Step 5: SUCCESS!');
        res.json({ text: text }); 

    } catch (err) {
        console.error('CRASH LOGGED:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));