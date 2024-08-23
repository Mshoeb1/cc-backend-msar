const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(bodyParser.json());

app.use(cors());

const dbPath = path.join(__dirname, "ccData.db");

let loginDb = null;

// Initializing Db Server
const initializeDBAndServer = async () => {
  try {
    loginDb = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log("file open");
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// creating data base
const db = new sqlite3.Database(
  "./ccData.db",
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Connected to the in-memory SQlite database.");
  }
);

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS mentors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT, availability TEXT, areas_of_expertise TEXT,is_premium TEXT);",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Mentors table created");
      }
    }
  );

  db.run(
    "CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, password TEXT, availability TEXT, area_of_interest TEXT);",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Students table created");
      }
    }
  );

  db.run(
    "CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER, mentor_id INTEGER, student_name TEXT, mentor_name TEXT,time_slot TEXT);",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Bookings table created");
      }
    }
  );
});

// Accessing user's details from database

app.post("/login", async (req, res) => {
  const { email, password, tag } = req.body;
  let selectUser;
  if (tag.toLowerCase() === "student") {
    if (!email || !password) {
      return res.json("Missing Fields required");
    }
    selectUser = `SELECT * FROM students WHERE email='${email}';`;
  } else {
    if (!email || !password) {
      return res.json("Missing Fields required");
    }
    selectUser = `SELECT * FROM mentors WHERE email='${email}';`;
  }
  const userData = await loginDb.get(selectUser);
  const isPasswordMatched = await bcrypt.compare(password, userData.password);
  if (userData && isPasswordMatched) {
    const payload = {
      email: email,
    };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
    res.status(200);
    res.json({
      id: userData.id,
      jwt_token: jwtToken,
    });
    console.log("login successfull");
  } else {
    res.status(401);
    res.send("Invalid Username and Password");
  }
});

// Modeling users & mentor details database

app.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    areaOfExperties,
    isPremium,
    availability,
    tag,
  } = req.body;

  let row;
  let hashedPassword;

  if (tag.toLowerCase() === "student") {
    if (!name || !email || !password || !areaOfExperties || !availability) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    hashedPassword = await bcrypt.hash(password, 10);
    row = db.run(
      `INSERT INTO students (name, email, password, availability, area_of_interest) VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, availability, areaOfExperties],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(400).json({ error: "Email already exists" });
          }
          return res.status(500).json({ error: err.message });
        }
      }
    );
  } else {
    if (!name || !email || !password || !areaOfExperties || !availability) {
      console.log("hi");
      return res.status(400).json({ error: "Missing required fields" });
    }
    hashedPassword = await bcrypt.hash(password, 10);
    row = db.run(
      `INSERT INTO mentors (name, email, password, availability, areas_of_expertise, is_premium) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, availability, areaOfExperties, isPremium],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(400).json({ error: "Email already exists" });
          }
          return res.status(500).json({ error: err.message });
        }
      }
    );
  }
  if (row) {
    const payload = {
      name: name,
    };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN", {
      expiresIn: "30d",
    });
    res.json({
      jwt_tokent: jwtToken,
    });
  } else {
    res.status(400);
    res.send("User Registration Error");
  }
});
// fetching all mentors

app.get("/mentors", async (req, res) => {
  db.all("SELECT * FROM mentors", (err, rows) => {
    if (err) {
      console.error(err.message);
    } else {
      // Convert the rows to an array of objects
      const mentorsArray = rows.map((row) => {
        return {
          id: row.id,
          name: row.name,
          availability: row.availability,
          areasOfExpertise: row.areas_of_expertise,
          isPremium: row.is_premium,
        };
      });

      // Return the data as an array of objects
      console.log(mentorsArray);
      res.json(mentorsArray);
    }
  });
});

// creating bookings

app.post("/bookings", async (req, res) => {
  const { studentId, mentorId, mentorName, jwtToken, timeSlot } = req.body;
  let mentorDetails;
  let studentDetails;
  const selectStudent = await db.get(
    `SELECT * FROM students WHERE id=${studentId};`,
    (err, rows) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Data fetched from the database:");
        studentDetails = { name: rows.name };
        console.log(studentDetails);
      }
    }
  );
  const selectMentor = await db.get(
    `SELECT * FROM mentors WHERE id=${mentorId};`,
    (err, rows) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Data fetched from the database:");
        mentorDetails = { name: rows.name };
        console.log(mentorDetails);
      }
    }
  );

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    const row = await db.run(
      `INSERT INTO bookings (student_id, mentor_id, student_name, mentor_name, time_slot) VALUES (?, ?, ?, ?, ?)`,
      [studentId, mentorId, "", mentorName, timeSlot],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT") {
            return res.status(400).json({ error: "Email already exists" });
          }
          return res.status(500).json({ error: err.message });
        } else {
          console.log("Data loaded to bookings table");
        }
      }
    );
  }
});

// Fetch Bookings

app.get("/bookings/:id", async (req, res) => {
  const id = req.params.id;
  db.all(
    `SELECT * FROM bookings WHERE student_id=${id} OR mentor_id=${id}`,
    (err, rows) => {
      if (err) {
        console.error(err.message);
      } else {
        // Convert the rows to an array of objects
        const bookingsArray = rows.map((row) => {
          return {
            id: row.id,
            studentName: row.student_name,
            mentorName: row.mentor_name,
            timeSlot: row.time_slot,
          };
        });

        // Return the data as an array of objects
        console.log(bookingsArray);
        res.json(bookingsArray);
      }
    }
  );
});

const PORT = process.env.PORT || 4000;
console.log(PORT);
app.listen(PORT, console.log("Server is running on 4000 port!"));
