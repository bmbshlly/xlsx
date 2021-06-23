const xlsx = require('xlsx');

const excelToRow = (filePath) => {
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
    return jsonPagesArray[0].content;
}

module.exports = excelToRow;