//import
const express = require('express');
const path = require('path');
const xlsx = require('xlsx');
const fs = require('fs');
const excelToRow = require('./processor');

// app config
require('dotenv').config()
const app = express();
const port = process.env.PORT || 9000;
const pool = require('./config/database');
const upload = require('./config/multer.config');
const columns = require('./config/model');

// middlewares
app.use(express.json());
app.use(function (req, res, next) {
    res.header('X-Frame-Options', '*');
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, enctype, Accept');
    next();
});

// api routes
app.get('/', (req, res) => { res.send('Hello folks, Goodera here!'); });

// GET /distinctCountry -> returns all distinct countries
app.get('/distinctCountry', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT DISTINCT "Country" FROM excel`);
        const result = rows.map((value) => value.Country);
        res.send(result);
    } catch {
        (err) => {
            res.send('failed');
            console.log(err)
        }
    }
});

// GET /rows -> returns MAX_ROW(300) entry
app.get('/rows', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM excel LIMIT ${process.env.MAX_ROWS}`);
        res.send(rows);
    } catch {
        (err) => {
            res.send('failed');
            console.log(err)
        }
    }
});

// POST /addFilters -> add array of filters for Beneficiaries, FocusAreas
app.post('/addFilters', async (req, res) => {
    try {
        const filters = req.body;
        let query = '';
        
        if(filters['Beneficiaries'] && filters['Beneficiaries'].length)
            query += `UPDATE filter SET values = '["${filters['Beneficiaries'].join('","')}"]' where feature = 'Beneficiaries';`;
        if(filters['FocusAreas'] && filters['FocusAreas'].length)
            query += `UPDATE filter SET values = '["${filters['FocusAreas'].join('","')}"]' where feature = 'FocusAreas';`;

        query ? await pool.query(query): res.send('no values');
        res.send('updated');
    } catch {
        (err) => {
            res.send('failed');
            console.log(err)
        }
    }
});

// GET /getFilters for Beneficiaries, FocusAreas
app.get('/getFilters', async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM filter`);
        result = [];
        for (let row of rows) {
            let obj = {};
            obj[row['feature']] = row['values'];
            result.push(obj);
        }
        res.send(result);
    } catch {
        (err) => {
            res.send('failed');
            console.log(err)
        }
    }
});

// POST /api/file/upload -> upload file and rows are insert/update in database
app.post('/api/file/upload', upload.single('excel'), async (req, res) => {
    try {
        const filePath = path.resolve() + "/uploads/" + req.file.filename;
        const rows = excelToRow(filePath);
        console.log(rows.length);
        const promises = [];
        for (row of rows) {
            let insert_row = Object.values(row);
            if (insert_row.length <= columns.length)
                insert_row.push(...Array(columns.length - insert_row.length).fill(null));
            else { continue; }
            for (let idx = 0; idx < insert_row.length; idx++) {
                if (typeof (insert_row[idx]) == 'string') {
                    let str = insert_row[idx];
                    let progress = 0;
                    while (str.indexOf(`'`, progress) >= 0) {
                        progress = str.indexOf(`'`, progress) + 1;
                        str = [str.slice(0, progress), `'`, str.slice(progress)].join('');
                        progress += 1;
                    }
                    insert_row[idx] = str;
                }
            }
            let query = `
            INSERT INTO excel ("${columns.join('\",\"')}") VALUES ('${insert_row.join('\',\'')}')
            ON CONFLICT ("Country","NonProfitName") DO UPDATE
            SET ("${columns.join('\",\"')}") = ('${insert_row.join('\',\'')}');
            `;
            promises.push(pool.query(query)
                .then()
                .catch(e => console.error(e.stack)));
        }
        Promise.all(promises).then(() => {
            fs.unlinkSync(filePath);
            res.send('finish');
        });
    } catch {
        (err) => {
            res.send('failed');
            fs.unlinkSync(filePath);
            console.log(err);
        }
    }
});

// POST /filters -> send filters and receive data accordingly
app.post('/filters', async (req, res) => {
    try {
        const filters = req.body;
        const FocusAreas = [];
        const Beneficiaries = [];
        let query;
        if (filters['FocusAreas'])
            FocusAreas.push(...filters['FocusAreas']);
        if (filters['Beneficiaries'])
            Beneficiaries.push(...filters['Beneficiaries']);

        includeFilter = (array, str) => {
            if (!array.length)
                return true
            for (idx of array)
                if (str.toLowerCase().includes(idx.toLowerCase()))
                    return true;
            return false;
        }

        delete filters['FocusAreas'];
        delete filters['Beneficiaries'];
        const keys = Object.keys(filters);
        if (keys.length) {
            query = `SELECT * FROM excel WHERE "${keys[0]}" IN ('${filters[keys[0]].join('\',\'')}')`;
            for (let i = 1; i < keys.length; i++)
                query += ` AND "${keys[i]}" IN ('${filters[keys[i]].join('\',\'')}')`;
        } else {
            query = `SELECT * FROM excel`;
        }
        const { rows } = await pool.query(query);
        const result = rows.filter(row => includeFilter(Beneficiaries, row['Beneficiaries']) && includeFilter(FocusAreas, row['FocusAreas']));
        res.send(result);
    } catch {
        (err) => {
            res.send('failed');
            console.log(err)
        }
    }
});

// remove all stored uploaded excel
fs.readdir(path.resolve() + "/uploads/", (err, files) => {
    if (err) throw err;
    for (const file of files) {
        if (file != '.gitkeep')
            fs.unlink(path.join(path.resolve() + "/uploads/", file), err => {
                if (err) throw err;
            });
    }
});

// listen
app.listen(port, () => console.log(`listening on localhost:${port}`));
