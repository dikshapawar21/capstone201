const express = require("express");
const csurf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser("cookie-parser-secret"));
app.use(session({ secret: "keyboard cat" }));
app.use(csurf("123456789iamasecret987654321look"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login", { csrfToken: req.csrfToken() });
});

app.get("/educatorSignup", (req, res) => {
  res.render("educatorSignup", { csrfToken: req.csrfToken() });
});

app.get("/studentSignup", (req, res) => {
  res.render("studentSignup", { csrfToken: req.csrfToken() });
});

module.exports = app;
