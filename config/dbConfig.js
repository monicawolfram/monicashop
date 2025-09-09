// config/dbConfig.js
const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",         // your MySQL username
  password: "",         // your MySQL password
  database: "monica_db" // your DB name
});

module.exports = db;



