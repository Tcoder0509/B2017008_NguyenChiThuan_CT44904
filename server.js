if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Importing Libraies that we installed using npm
const express = require("express");
const app = express();
const bcrypt = require("bcrypt"); // Importing bcrypt package
const passport = require("passport");
const initializePassport = require("./passport-config");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");
const mongoose = require("mongoose");

initializePassport(
  passport,
  (email) => users.find((user) => user.email === email),
  (id) => users.find((user) => user.id === id)
);

const users = [];

app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

app.post(
  "/login",
  checkNotAuthenticated,
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

// Cấu hình chức năng đăng ký
app.post("/register", checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
      id: Date.now().toString(),
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });
    console.log(users);
    res.redirect("/login");
  } catch (e) {
    console.log(e);
    res.redirect("/register");
  }
});

// ========================= Kết nối Database ==================
mongoose.connect("mongodb://localhost:27017/quanlyphim", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Lỗi kết nối MongoDB"));
db.once("open", () => {
  console.log("Đã kết nối thành công đến MongoDB");
});

// ========================== Tạo schema cho dữ liệu "films" ========================
const filmSchema = new mongoose.Schema({
  name: String,
  description: String,
  ngaychieu: Date,
  thoiluong: String,
  image: String,
  slug: String,
  videoID: String,
});

const Film = mongoose.model("Film", filmSchema);

// Routes
app.get("/", checkAuthenticated, (req, res) => {
  res.render("index.ejs", { name: req.user.name });
});

app.get("/login", checkNotAuthenticated, (req, res) => {
  res.render("login.ejs");
});

app.get("/register", checkNotAuthenticated, (req, res) => {
  res.render("register.ejs");
});

app.get("/home", checkAuthenticated, (req, res) => {
  res.render("home.ejs");
});

// End Routes

// ======================= Routes để lấy dữ liệu từ films =====================
app.get("/search", checkAuthenticated, async (req, res) => {
  try {
    const query = req.query.q; // Lấy từ khóa tìm kiếm từ tham số URL
    const films = await Film.find({ name: { $regex: new RegExp(query, "i") } });

    res.render("film.ejs", { films });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/films", async (req, res) => {
  try {
    const films = await Film.find({});
    res.json(films);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/film", checkAuthenticated, async (req, res) => {
  try {
    const films = await Film.find({});
    res.render("film.ejs", { films });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/film/create", checkAuthenticated, (req, res) => {
  res.render("themfilm.ejs");
});

app.post("/film/create", async (req, res) => {
  try {
    const { name, description, ngaychieu, thoiluong, image, slug, videoID } =
      req.body;
    // Thực hiện lưu dữ liệu vào MongoDB
    const newFilm = new Film({
      name,
      description,
      ngaychieu,
      thoiluong,
      image,
      slug,
      videoID,
    });

    await newFilm.save();

    // Chuyển hướng về trang danh sách phim sau khi thêm
    res.redirect("/film");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/film/:slug", async (req, res) => {
  try {
    const requestedSlug = req.params.slug;
    const film = await Film.findOne({ slug: requestedSlug });

    if (!film) {
      return res.status(404).send("Không tìm thấy phim");
    }

    // Truyền dữ liệu của phim vào template
    res.render("ndfilm.ejs", { film });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Route để xóa phim
app.get("/film/delete/:slug", checkAuthenticated, async (req, res) => {
  try {
    const requestedSlug = req.params.slug;
    // Xóa phim từ database
    await Film.findOneAndDelete({ slug: requestedSlug });
    // Chuyển hướng về trang danh sách phim sau khi xóa
    res.redirect("/film");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Route để hiển thị form sửa phim
app.get("/film/update/:slug", checkAuthenticated, async (req, res) => {
  try {
    const requestedSlug = req.params.slug;
    const film = await Film.findOne({ slug: requestedSlug });

    if (!film) {
      return res.status(404).send("Không tìm thấy phim");
    }

    // Hiển thị form sửa với thông tin của phim
    res.render("updatefilm.ejs", { film });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Route để xử lý form sửa phim
app.post("/film/update/:slug", async (req, res) => {
  try {
    const requestedSlug = req.params.slug;
    const { name, description, ngaychieu, thoiluong, image, videoID } =
      req.body;

    // Cập nhật thông tin của phim trong database
    await Film.findOneAndUpdate(
      { slug: requestedSlug },
      { name, description, ngaychieu, thoiluong, image, videoID }
    );

    // Chuyển hướng về trang danh sách phim sau khi cập nhật
    res.redirect("/film");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ======================= Routes để lấy dữ liệu từ films =====================

app.delete("/logout", (req, res) => {
  req.logout(req.user, (err) => {
    if (err) return next(err);
    res.redirect("/");
  });
});

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }
  next();
}

app.listen(3008);
