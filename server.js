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

        // 1. Extract the Base64 string from Salesforce JSON or File Upload
        if (req.body && req.body.image) {
            base64String = req.body.image;
        } else if (req.files && req.files.image) {
            base64String = req.files.image.data.toString('base64');
        } else {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // 2. Format as a Data URL to satisfy Scribe's internal 'match' logic
        const dataUrl = `data:image/png;base64,${base64String}`;

        // 3. Dynamic import of the library
        const scribeModule = await import('./scribe.js');
        const scribe = scribeModule.default;

        // 4. Run extraction (passing the string inside an array)
        console.log('Processing OCR...');
        const result = await scribe.extractText([dataUrl]);
        
        res.json({ text: result[0] }); 

    } catch (err) {
        console.error('Detailed Server Error:', err); 
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));