//import
require('dotenv').config()
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const upload = require('./config/multer.config.js');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const excelToJson = require('convert-excel-to-json');

// app config
const app = express();
const port = process.env.PORT || 9000;
const DATABASE_URL = process.env.DATABASE_URL;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


// middlewares
app.use(cors());
app.use(express.json());


// api routes
app.get('/', (req, res) => { res.send('Hello World!'); });

app.post('/api/file/upload', upload.single('excel'), (req, res) => {
    try{
        const filePath = path.resolve() + "/uploads/" + req.file.filename;
        const workbook = excelToJson({ sourceFile: filePath });        
        console.log(workbook);
        res.send('done');
    }
    catch{}
});

app.post('/setUserPreferences', (req, res) => {
    const username = req.body.username;
    const preferences = JSON.stringify(req.body.preferences);
    pool.query(`UPDATE register SET preference = '${preferences}' WHERE username = '${username}'`, (err, res) => {
        if (err) { console.log(err.stack); }
    });
    res.send("preference set");
});


// listen
app.listen(port, () => console.log(`listening on localhost:${port}`));