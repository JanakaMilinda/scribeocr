import express from 'express';
import fileUpload from 'express-fileupload';
import scribe from './scribe.js'; // Ensure the path is correct

const app = express();

app.use(fileUpload());

app.post('/ocr', async (req, res) => {
    try {
        if (!req.files || !req.files.image) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        // Processing
        const result = await scribe.extractText([req.files.image.data]);
        res.json({ text: result[0] }); 
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OCR Service running on port ${PORT}`));