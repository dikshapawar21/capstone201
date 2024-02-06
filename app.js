const express = require("express");
const csurf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const app = express();
const { User } = require("./models");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const path = require("path");

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then((user) => {
          if (user === null)
            return done(null, false, { message: "User does not exist" });
          bcrypt
            .compare(password, user.password)
            .then((result) => {
              if (result) return done(null, user);
              else done(null, false, { message: "Invalid password" });
            })
            .catch((err) => {
              console.log(err);
              return done(err);
            });
        })
        .catch((err) => {
          console.log(err);
          done(err);
        });
    }
  )
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(cookieParser("somepasswordverysecure"));
app.use(flash());
app.use(
  session({
    secret: "somethingsomethingsomething",
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);
app.use(csurf("123456789iamasecret987654321look", ["POST", "PUT", "DELETE"]));
app.use(function (request, response, next) {
  response.locals.messages = request.flash();
  next();
});

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((err) => {
      done(err, null);
    });
});

app.use(passport.initialize());
app.use(passport.session());

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

app.get("/home", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  if (req.user.designation === "educator") {
    res.render("educator");
  } else {
    res.render("student");
  }
});

app.post("/user", async (req, res) => {
  const hashPwd = await bcrypt.hash(req.body.password, saltRounds);
  try {
    if (req.body.password === "") {
      throw new Error("Validation notEmpty on password failed");
    }
    console.log("Creating user: ", req.body);
    let user = await User.create({
      firstName: req.body.fname,
      lastName: req.body.lname,
      email: req.body.email,
      designation: req.body.designation,
      password: hashPwd,
    });
    console.log("User created:", user.dataValues);
    req.login(user, (err) => {
      if (err) {
        console.log(err);
      }
      res.status(301).redirect("/home");
    });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: error });
  }
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  async (req, res) => {
    console.log(req.body);
    res.redirect("/home");
  }
);

module.exports = app;
