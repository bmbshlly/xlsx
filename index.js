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
const columns = require('./config/model');
const cors = require('cors');

// middlewares
app.use(express.json());
app.use(cors());
app.use(function(req, res, next) {
	res.header('X-Frame-Options','*');
	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
	res.header('Access-Control-Allow-Headers','X-Requested-With, X-HTTP-Method-Override, Content-Type, enctype, Accept');
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
    const FocusAreas = [];
    const Beneficiaries = [];
    let query;
    if(filters['FocusAreas'])
        FocusAreas.push(...filters['FocusAreas']);
    if(filters['Beneficiaries'])
        Beneficiaries.push(...filters['Beneficiaries']);

    includeFilter = (array, str) => {
        if(!array.length)
            return true
        for(idx of array)
            if(str.toLowerCase().includes(idx.toLowerCase()))
                return true;
        return false;
    }

    delete filters['FocusAreas'];
    delete filters['Beneficiaries'];
    console.log(FocusAreas, Beneficiaries);
    const keys = Object.keys(filters);
    if(keys.length) {
        query = `SELECT * FROM excel WHERE "${keys[0]}" IN ('${filters[keys[0]].join('\',\'')}')`;
        for (let i = 1; i < keys.length; i++)
            query += ` AND "${keys[i]}" IN ('${filters[keys[i]].join('\',\'')}')`;
        query += ` LIMIT ${process.env.MAX_ROWS}`;
    }
    else {
        query = `SELECT * FROM excel LIMIT ${process.env.MAX_ROWS}`;
    }
    try{
        const { rows } = await pool.query(query);
        console.log(rows);
        const result = rows.filter(row  => includeFilter(Beneficiaries, row['Beneficiaries']) && includeFilter(FocusAreas, row['FocusAreas']));
        res.send(result);
    }
    catch{ (err) => console.log(err) }
});


// listen
app.listen(port, () => console.log(`listening on localhost:${port}`));
