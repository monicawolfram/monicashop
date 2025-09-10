const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const authRoutes = require("./routes/authRoutes");

const app = express();

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({ secret: "mySecret", resave: false, saveUninitialized: true }));
app.use(express.json());             // Parses JSON bodies
app.use(express.urlencoded({ extended: true })); // Parses form bodies


// Set EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.use("/", authRoutes);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
