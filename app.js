const express = require("express");
const csurf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const app = express();
const {
  User,
  Course,
  Chapter,
  Page,
  Enrollment,
  MarkComplete,
} = require("./models");

const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const path = require("path");
const { Op } = require("sequelize");

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
              return done(err);
            });
        })
        .catch((err) => {
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
  if (req.isAuthenticated()) {
    res.redirect("/home");
  }
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login", { csrfToken: req.csrfToken() });
});

app.get("/educatorSignup", (req, res) => {
  res.render("educator/educatorSignup", { csrfToken: req.csrfToken() });
});

app.get("/studentSignup", (req, res) => {
  res.render("student/studentSignup", { csrfToken: req.csrfToken() });
});

app.get("/signout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

app.get("/home", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect("/login");
  if (req.user.designation === "educator") {
    let myCourses = await Course.findAll({
      where: {
        userId: req.user.id,
      },
    });
    myCourses = myCourses.map((course) => ({
      courseId: course.id,
      description: course.dataValues.description,
      courseName: course.dataValues.name,
    }));
    let notMyCourses = await Course.findAll({
      where: {
        userId: {
          [Op.ne]: req.user.id,
        },
      },
    });
    notMyCourses = notMyCourses.map((course) => ({
      courseId: course.id,
      description: course.dataValues.description,
      courseName: course.dataValues.name,
    }));
    res.render("educator/educator", { myCourses, notMyCourses });
  } else {
    const enrolled = await Enrollment.findAll({
      where: {
        userId: req.user.id,
      },
      include: User,
    });
    const enrolledIdList = (
      await Enrollment.findAll({ where: { userId: req.user.id } })
    ).map((e) => e.courseId);
    const notEnrolled = await Course.findAll({
      where: {
        id: {
          [Op.notIn]: enrolledIdList,
        },
      },
      include: User,
    });
    res.render("student/student", {
      enrolled,
      notEnrolled,
      csrfToken: req.csrfToken(),
    });
  }
});

app.post("/user", async (req, res) => {
  const hashPwd = await bcrypt.hash(req.body.password, saltRounds);
  try {
    if (req.body.password === "") {
      throw new Error("password is empty");
    }
    console.log("Creating user: ", req.body);
    let user = await User.create({
      firstName: req.body.fname,
      lastName: req.body.lname,
      email: req.body.email,
      designation: req.body.designation,
      password: hashPwd,
    });
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
    res.redirect("/home");
  }
);

// Course routes
app.get("/newCourse", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
  if (req.user.designation === "educator") {
    res.render("newCourse", { csrfToken: req.csrfToken() });
  } else {
    res.redirect("/login");
  }
});

app.get("/course/:id", async (req, res) => {
  const course = await Course.findByPk(req.params.id, { include: User });
  const chapters = await Chapter.findAll({
    where: {
      courseId: course.id,
    },
  });
  if (req.user && req.user.designation === "educator") {
    return res.render("educator/viewEducatorCourse", {
      course,
      chapters,
      csrfToken: req.csrfToken(),
    });
  } else {
    const isEnrolled =
      (
        await Enrollment.findAll({
          where: { userId: req.user.id, courseId: Number(req.params.id) },
        })
      ).length > 0;
    return res.render("student/viewStudentCourse", {
      course,
      chapters,
      isEnrolled,
    });
  }
});

app.post("/course", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  if (req.user.designation === "educator") {
    const course = await Course.create({
      name: req.body.name,
      description: req.body.description,
      userId: req.user.id,
    });
    res.redirect("/home");
  } else {
    res.status(403).redirect("/");
  }
});

app.delete("/course", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const course = await Course.findByPk(req.body.id);
  if (course.dataValues.userId !== req.user.id) {
    res.redirect("/home");
  }
  await course.destroy();
  return res.redirect("/home");
});

//Chapter routes
app.get(
  "/newChapter",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.designation !== "educator") {
      return res.redirect("/home");
    }
    const courses = await Course.findAll({
      where: {
        userId: req.user.id,
      },
    });
    res.render("newChapter", { csrfToken: req.csrfToken(), courses });
  }
);

app.get(
  "/chapter/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const chapterId = req.params.id;
      const chapter = await Chapter.findOne({
        where: { id: chapterId },
        include: Course,
      });
      if (
        (await Enrollment.findOne({
          where: { userId: req.user.id, courseId: chapter.Course.id },
        })) &&
        (
          await Enrollment.findOne({
            where: { userId: req.user.id, courseId: chapter.Course.id },
          })
        ).length === 0 &&
        chapter.Course.userId !== req.user.id
      ) {
        return res.redirect("/home");
      }
      const pages = await Page.findAll({ where: { chapterId } });
      res.render("educator/viewEducatorChapter", {
        csrfToken: req.csrfToken(),
        chapter,
        pages,
      });
    } catch (error) {
      console.log("WADDA ERROR", error);
      res.json(error);
    }
  }
);

app.post("/chapter", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const { courseId, name } = req.body;
  const course = await Course.findByPk(courseId);
  if (course.userId !== req.user.id) {
    res.status(400).redirect("/home");
  }
  const chapter = await Chapter.create({
    courseId,
    name,
  });
  res.redirect("/course/" + courseId);
});

app.delete(
  "/chapter",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    try {
      const { chapterId } = req.body;
      const chapter = await Chapter.findOne({
        where: { id: chapterId },
        include: Course,
      });
      if (chapter.Course.userId !== req.user.id) {
        res.status(400).redirect("/home");
      }
      await chapter.destroy();
      res.redirect("/course/" + chapter.courseId);
    } catch (err) {
      console.log(err);
      res.json(err);
    }
  }
);

//Page routes
app.get(
  "/chapter/:chapId/newPage",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    if (req.user.designation !== "educator") {
      return res.redirect("/home");
    }
    res.render("newPage", {
      csrfToken: req.csrfToken(),
      chapterId: req.params.chapId,
    });
  }
);

app.get("/page/:id", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const chapterId = (await Page.findByPk(req.params.id)).chapterId;
  const chapter = await Chapter.findOne({
    where: { id: chapterId },
    include: { model: Course },
  });
  if (
    await Enrollment.findOne({where:{userId:req.user.id,courseId:chapter.Course.id}})&&
    (
      await Enrollment.findOne({
        where: { userId: req.user.id, courseId: chapter.Course.id },
      })
    ).length === 0 &&
    chapter.Course.userId !== req.user.id
  ) {
    return res.redirect("/home");
  }
  const thisPage = await Page.findByPk(req.params.id);
  const allPages = await Page.findAll({
    where: {
      chapterId,
    },
  });
  let pageId = Number(req.params.id);
  let nextPageId = -1;
  let prevPageId = -1;
  for (let i = 0; i < allPages.length; i++) {
    if (allPages[i].id === pageId) {
      if (i !== allPages.length - 1) {
        nextPageId = allPages[i + 1].id;
      }
      if (i !== 0) {
        prevPageId = allPages[i - 1].id;
      }
      break;
    }
  }
  if (req.user.designation === "educator") {
    return res.render("educator/viewEducatorPage", {
      thisPage,
      nextPageId,
      prevPageId,
    });
  } else {
    return res.render("student/viewStudentPage", {
      csrfToken: req.csrfToken(),
      thisPage,
      nextPageId,
      prevPageId,
      markedComplete:
        (
          await MarkComplete.findAll({
            where: {
              userId: req.user.id,
              pageId: req.params.id,
            },
          })
        ).length > 0,
    });
  }
});

app.post("/page", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  try {
    if (req.user.designation !== "educator") {
      return res.redirect("/home");
    }
    const { name, content, chapterId } = req.body;
    const page = await Page.create({
      name,
      content,
      chapterId,
    });
    res.redirect("/chapter/" + chapterId);
  } catch (error) {
    res.redirect("/");
  }
});

app.delete("/page", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  const { pageId } = req.body;
  const page = await Page.findOne({
    where: {
      id: pageId,
    },
    include: {
      model: Chapter,
      include: {
        model: Course,
        include: {
          model: User,
        },
      },
    },
  });
  if (page.Chapter.Course.User.id !== req.user.id) {
    return res.redirect("/");
  }
  await page.destroy();
  res.redirect("/chapter/" + page.Chapter.id);
});

app.post("/enroll", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  if (req.user.designation !== "student") {
    res.redirect("/");
  }
  const { courseId } = req.body;
  const userId = req.user.id;
  const enrollment = await Enrollment.create({
    courseId,
    userId,
  });
  res.redirect(`/home`);
});

app.post(
  "/markComplete",
  connectEnsureLogin.ensureLoggedIn(),
  async (req, res) => {
    const { pageId } = req.body;
    const userId = req.user.id;
    const page = await Page.findOne({
      where: { id: pageId },
      include: {
        model: Chapter,
        include: Course,
      },
    });
    if (
      req.user.designation !== "student" ||
      (
        await Enrollment.findOne({
          where: { userId: userId, courseId: page.Chapter.Course.id },
        })
      ).length === 0
    ) {
      return res.redirect("/home");
    }
    await MarkComplete.create({
      userId,
      pageId,
    });
    res.redirect(`/page/${pageId}`);
  }
);

app.get("/password", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  res.render("changePassword", { csrfToken: req.csrfToken() });
});

app.post("/password", connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
  try {
    if (req.body.newPassword.length < 5) {
      throw new Error("Password shorter than 5 characters");
    }
    const user = await User.findByPk(req.user.id);
    if (!(await bcrypt.compare(req.body.oldPassword, user.password))) {
      throw new Error("Wrong old password");
    }
    const newPwdHash = await bcrypt.hash(req.body.newPassword, 10);
    await User.update(
      { password: newPwdHash },
      {
        where: {
          id: req.user.id,
        },
      }
    );
    res.redirect("/signout");
  } catch (error) {
    req.flash(error);
    res.redirect("/password");
  }
});

module.exports = app;
