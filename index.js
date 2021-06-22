//import
const express = require('express');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');

// app config
require('dotenv').config()
const app = express();
const port = process.env.PORT || 9000;
const pool = require('./config/database');
const upload = require('./config/multer.config');
//const cors = require('cors');
const columns = require('./config/model');

// middlewares
const corsOpts = {
    origin: '*',
    methods: ['*'],
    allowedHeaders: [
      'Content-Type',
      'enctype'
    ],
  };

//app.use(cors(corsOpts));
app.use(express.json());
app.use(function(req, res, next) {
	res.header('X-Frame-Options','*');
	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
	res.header('Access-Control-Allow-Headers','X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept');
	next();
});


// api routes
app.get('/', (req, res) => { res.send('Hello World!'); });

app.get('/rows', async(req, res) => { 
    try{
        const { rows } = await pool.query(`SELECT * FROM excel LIMIT ${process.env.MAX_ROWS}`);
        res.send(rows);
    }
    catch{ (err) => console.log(err) }
});

app.post('/api/file/upload', upload.single('excel'), async(req, res) => {
    try{
        const filePath = path.resolve() + "/uploads/" + req.file.filename;
        const workbook = xlsx.readFile(filePath);
        const sheet_name_list = workbook.SheetNames;
        const jsonPagesArray = [];
        sheet_name_list.forEach((sheet) => {
        const jsonPage = {
            name: sheet,
            content: JSON.parse(JSON.stringify(xlsx.utils.sheet_to_json(workbook.Sheets[sheet],{defval:""})))
        };
        jsonPagesArray.push(jsonPage);
        });
        const rows = jsonPagesArray[0].content;
        const promises = [];
        for (row of rows) {
            let insert_row = Object.values(row);
            if (insert_row.length != columns.length)
                insert_row.push([...Array(columns.length-insert_row.length).fill(null)]) 
            let query = `
            INSERT INTO excel ("${columns.join('\",\"')}") VALUES ('${insert_row.join('\',\'')}')
            ON CONFLICT ("Country","NonProfitName") DO UPDATE
            SET ("${columns.join('\",\"')}") = ('${insert_row.join('\',\'')}');
            `;
            promises.push(pool.query(query), (err, res) => {
                if (err) { console.log(err.stack); }
            });
        }
        Promise.all(promises).then(() => {
            fs.unlinkSync(filePath);
            res.send('done')
        });
    }
    catch{ (err) => console.log(err) }
});

app.post('/filters', async(req, res) => {
    const filters = req.body;
    const keys = Object.keys(filters);
    let query = `SELECT * FROM excel WHERE`;
    query += ` "${keys[0]}" IN ('${filters[keys[0]].join('\',\'')}')`;
    for (let i = 1; i < keys.length; i++) {
        query += ` AND "${keys[i]}" IN ('${filters[keys[i]].join('\',\'')}')`;
    }
    query += ` LIMIT ${process.env.MAX_ROWS}`;
    try{
        const { rows } = await pool.query(query);
        res.send(rows);
    }
    catch{ (err) => console.log(err) }
});


// listen
app.listen(port, () => console.log(`listening on localhost:${port}`));
