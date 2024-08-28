require('dotenv').config(); 

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { User } = require('./database');
const { Survey } = require('./database');
const { Question } = require('./database');  // Stell sicher, dass dies vorhanden ist


const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));


const logFilePath = 'activity.log';

// Funktion zum Erstellen eines JWT
const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
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

// E-Mail-Transporter einrichten
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Endpunkt zum Zurücksetzen des Passworts
app.post('/reset-password-request', async (req, res) => {
  const { email } = req.body;
  logActivity('Received password request');

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'Email not found' });
    }

    const resetToken = jwt.sign({ id: user.id, email: user.email }, 'secret-key', { expiresIn: '1h' });
    const resetLink = `http://192.168.0.77:3000/reset-password.html?token=${resetToken}`;


    const mailOptions = {
      from: 'manageyourstressapp@gmail.com', // Ersetze durch deine E-Mail
      to: user.email,
      subject: 'Password Reset',
      text: `Click the following link to reset your password: ${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ message: 'Error sending email' });
      }
      logActivity(`Password reset email sent to: ${email}`);
      res.status(200).json({ message: 'Password reset email sent' });
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to send password reset email' });
  }
});

// Endpunkt zum Setzen des neuen Passworts
app.post('/reset-password', async (req, res) => {
  const { password, token } = req.body;

  if (!password || !token) {
    return res.status(400).json({ message: 'Password and token are required' });
  }

  try {
    const decoded = jwt.verify(token, 'secret-key');
    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    logActivity(`User ${user.username} has reset their password`);
    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  console.log('Request Body:', req.body);

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingUserByUsername = await User.findOne({ where: { username } });
    const existingUserByEmail = await User.findOne({ where: { email } });
    if (existingUserByUsername) {
      return res.status(401).json({ message: 'Username is already taken' });
    } else if (existingUserByEmail) {
      return res.status(402).json({ message: 'Email is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });
    const token = generateToken(user);

    logActivity(`User registered: ${username}`);
    res.status(201).json({ token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
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
    console.log("couldn't find users");
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

app.get('/surveys', authenticateToken, async (req, res) => {
  try {
    const surveys = await Survey.findAll({
      include: [{
        model: Question,
        as: 'questions'
      }]
    });
    res.json(surveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ 
      message: 'Failed to fetch surveys', 
      error: error.message,
      stack: error.stack // Für detailliertere Fehleranalyse
    });
  }
});




app.post('/surveys', authenticateToken, async (req, res) => {
  const { title, description, questions } = req.body;

  if (!title || !questions) {
    return res.status(400).json({ message: 'Title and questions are required' });
  }

  try {
    const survey = await Survey.create({ title, description });
    await Promise.all(questions.map(question =>
      Question.create({
        ...question,
        surveyId: survey.id
      })
    ));
    res.status(201).json(survey);
  } catch (error) {
    console.error('Error creating survey:', error);
    res.status(500).json({ message: 'Failed to create survey' });
  }
});


app.post('/submit-survey', async (req, res) => {
  try {
    const { userId, surveyId, responses } = req.body;

    // Validierungen
    if (!userId || !surveyId || !responses) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Überprüfe, ob die Umfrage existiert
    const survey = await Survey.findByPk(surveyId);
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    // Speichern der Antworten
    const surveyResponse = await SurveyResponse.create({
      userId,
      surveyId,
      response: responses // Hier wird das Array von Antworten gespeichert
    });

    res.status(201).json({ message: 'Responses saved successfully', surveyResponse });
  } catch (error) {
    console.error('Error saving survey responses:', error);
    res.status(500).json({ message: 'Error saving responses' });
  }
});



app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
