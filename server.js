const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { User } = require('./database');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const logFilePath = 'activity.log';

// Funktion zum Erstellen eines JWT
const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, 'secret-key', { expiresIn: '2m' });
};

// Middleware zum Überprüfen des JWTs
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Aktivität protokollieren
const logActivity = (message) => {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  console.log(logMessage);
};

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUserByUsername = await User.findOne({ where: { username } });
    if (existingUserByUsername) {
      return res.status(400).json({ message: 'Username is already taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });
    const token = generateToken(user); // Token generieren

    logActivity(`User registered: ${username}`);
    res.status(201).json({ token }); // Token zurückgeben
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' }); // Return JSON response
  }
});


// Login eines Benutzers
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }
    const token = generateToken(user);
    logActivity(`User logged in: ${username}`);
    res.json({ token });
  } catch (error) {
    res.status(500).send('Login failed');
  }
});

// Authentication eines Benutzers
app.post('/authenticate', authenticateToken, (req, res) => {
  // Wenn der Middleware authenticateToken keinen Fehler geworfen hat,
  // dann ist der Token gültig
  res.json({ valid: true });
});

// Geschützter Endpunkt
app.get('/protected', authenticateToken, (req, res) => {
  res.send(`Hello ${req.user.username}, this is a protected route!`);
});

// Endpunkt zum Abrufen aller Benutzer
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username'] });
    res.json(users);
  } catch (error) {
    res.status(500).send('Could not fetch users');
    console.log("couldn't find users")
  }
});

// Endpunkt zum Abrufen des Aktivitätsprotokolls
app.get('/activity-log', (req, res) => {
  if (fs.existsSync(logFilePath)) {
    const logs = fs.readFileSync(logFilePath, 'utf8');
    res.send(logs);
  } else {
    res.send('No activity logged yet.');
  }
});

// Route für Root-Pfad
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
