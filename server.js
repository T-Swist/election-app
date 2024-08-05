const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const argon2 = require('argon2');

const app = express();
const port = 3000;
let gUserId = 1; // Global user ID variable

// Set up multer for file uploads using memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only images are allowed!'));
  }
});

// Database setup
const db = new sqlite3.Database('./elections.db');

db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS auth (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, user_name TEXT NOT NULL UNIQUE, password TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT NOT NULL, middle_name TEXT, last_name TEXT NOT NULL, dob DATE NOT NULL, photo BLOB NOT NULL, user_name TEXT NOT NULL, password TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS role (id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS parties (id INTEGER PRIMARY KEY AUTOINCREMENT, logo BLOB, party_name TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS positions (id INTEGER PRIMARY KEY AUTOINCREMENT, position TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS candidate (id INTEGER PRIMARY KEY AUTOINCREMENT, positions_id INTEGER, photo BLOB, party_id INTEGER)');
  db.run('CREATE TABLE IF NOT EXISTS votes (id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id INTEGER, votes INTEGER)');
});

// Middleware to parse URL-encoded bodies (as sent by HTML forms)
app.use(express.urlencoded({ extended: true }));

// Setting up static directory
app.use(express.static("public"));

// Setting up views engine
app.set('view engine', 'ejs');

// Define a route for the homepage
app.get('/', (req, res) => {
  res.render('login');
});

app.get('/voters-registration', (req, res) => {
  res.render("voters-registration");
});

// Handle voter registration form submission
app.post('/voters-registration', upload.single('user_image'), async (req, res) => {
  const { first_name, middle_name, last_name, dob, user_name, password } = req.body;
  const photo = req.file ? req.file.buffer : null;

  try {
    const hashedPassword = await argon2.hash(password);

    db.serialize(() => {
      const userQuery = 'INSERT INTO user (first_name, middle_name, last_name, dob, photo, user_name, password) VALUES (?, ?, ?, ?, ?, ?, ?)';
      db.run(userQuery, [first_name, middle_name, last_name, dob, photo, user_name, hashedPassword], function (err) {
        if (err) {
          console.error(err);
          return res.status(500).send("Error inserting data into the database.");
        }

        const authQuery = 'INSERT INTO auth (user_id, user_name, password) VALUES (?, ?, ?)';
        db.run(authQuery, [this.lastID, user_name, hashedPassword], function (err) {
          if (err) {
            console.error(err);
            return res.status(500).send("Error inserting data into the auth table.");
          }
          res.render("login");
        });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error.');
  }
});

// Render the login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle login form submission
app.post('/login', (req, res) => {
  const { user_name, password } = req.body;

  db.get("SELECT * FROM auth WHERE user_name = ?", [user_name], async (err, row) => {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Login failed.');
    }

    if (!row || !(await argon2.verify(row.password, password))) {
      return res.status(401).send('Invalid credentials.');
    }

    db.all('SELECT * FROM user WHERE user_name = ?', [user_name], (err, rows) => {
      if (err) {
        console.error(err.message);
        return res.status(500).send('Error fetching user data.');
      }
      res.render('dashboard', { data: rows });
    });
  });
});

// Render the dashboard page
app.get('/dashboard', (req, res) => {
  res.render('dashboard');
});

app.get('/parties-registration', (req, res) => {
  res.render('parties_registration');
});

app.get('/vote', (req, res) => {
  res.render('vote');
});

// Start the Express server
app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});

// Close the database connection when the Node.js process is terminated
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});