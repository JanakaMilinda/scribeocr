const express = require('express');
const fileUpload = require('express-fileupload');
// Point to the local scribe.js file in your root
const scribe = require('./scribe.js'); 
const app = express();

app.use(fileUpload());

app.post('/ocr', async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).send('No file uploaded.');
        }

        // Processing the buffer directly
        const result = await scribe.extractText([req.files.image.data]);
        
        res.json({ text: result[0] }); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OCR Service running on port ${PORT}`));