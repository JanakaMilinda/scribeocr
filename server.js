const express = require('express');
const fileUpload = require('express-fileupload');
// We do NOT require scribe at the top anymore

const app = express();
app.use(fileUpload());

app.get('/', (req, res) => {
    res.send('OCR Server is active and waiting for requests.');
});

app.post('/ocr', async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        // DYNAMIC IMPORT: This bypasses the ERR_REQUIRE_ASYNC_MODULE error
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Process the image
        const result = await scribe.extractText([req.files.image.data]);
        
        res.json({ text: result[0] }); 
    } catch (err) {
        console.error('OCR Error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));