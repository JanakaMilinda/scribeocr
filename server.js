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
        let imageData;

        // 3. Logic to handle both Salesforce (Base64) and standard File Uploads
        if (req.body && req.body.image) {
            // Salesforce sends the image as a Base64 string in the "image" field
            imageData = Buffer.from(req.body.image, 'base64');
            console.log('Received image from Salesforce (Base64)');
        } 
        else if (req.files && req.files.image) {
            // Standard multipart/form-data upload
            imageData = req.files.image.data;
            console.log('Received image from File Upload');
        } 
        else {
            return res.status(400).json({ error: 'No image data provided. Ensure the field name is "image".' });
        }

        // Dynamic import for Scribe
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // Process the Buffer
        const result = await scribe.extractText([imageData]);
        
        res.json({ text: result[0] }); 
    } catch (err) {
        console.error('OCR Error:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));