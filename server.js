require('dotenv').config();

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const nodemailer = require('nodemailer');

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: console.log
});

const { User, Tipps, Survey, Question, SurveyResponse, Answer, DiaryEntry, Settings } = require('./database');

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const logFilePath = 'activity.log';

const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    issuedAt: Date.now(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });
};


const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const logActivity = (message) => {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
  console.log(logMessage);
};

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

    const resetToken = generateToken(user);
    const resetLink = `http://192.168.0.77:3000/reset-password.html?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
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


app.post('/reset-password', async (req, res) => {
  const { password, token } = req.body;

  if (!password || !token) {
    return res.status(400).json({ message: 'Password and token are required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
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

    const defaultSettings = {
      darkMode: false,
      noiseData: false,
      stepData: false,
    
    };
    await Settings.create({ userId: user.id, settings: defaultSettings });

    const token = generateToken(user);
    logActivity(`User registered: ${username}`);
    res.status(201).json({ token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send('Invalid credentials');
    }
    const token = generateToken(user);
    logActivity(`User logged in: ${username}`);
    res.json({ 
      token,
      demographic: user.demographic 
    });
  } catch (error) {
    res.status(500).send('Login failed');
  }
});

app.post('/authenticate', authenticateToken, (req, res) => {
  res.json({ valid: true });
});

app.get('/protected', authenticateToken, (req, res) => {
  res.send(`Hello ${req.user.username}, this is a protected route!`);
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({ attributes: ['id', 'username'] });
    res.json(users);
  } catch (error) {
    res.status(500).send('Could not fetch users');
    console.log("couldn't find users");
  }
});

app.get('/activity-log', (req, res) => {
  if (fs.existsSync(logFilePath)) {
    const logs = fs.readFileSync(logFilePath, 'utf8');
    res.send(logs);
  } else {
    res.send('No activity logged yet.');
  }
});

app.get('/surveys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Hole die User-ID aus dem Token

    const surveys = await Survey.findAll({
      include: [{
        model: Question,
        as: 'questions'
      }]
    });

    const completedSurveys = await SurveyResponse.findAll({
      where: { userId },
      attributes: ['surveyId']
    });

    const completedSurveyIds = new Set(completedSurveys.map(response => response.surveyId));

    const surveysWithCompletionInfo = surveys.map(survey => ({
      ...survey.toJSON(),
      completed: completedSurveyIds.has(survey.id) 
    }));

    res.json(surveysWithCompletionInfo);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({
      message: 'Failed to fetch surveys',
      error: error.message,
      stack: error.stack
    });
  }
});

app.post('/surveys', authenticateToken, async (req, res) => {
  const { title, description, questions } = req.body;

  if (!title || !questions || questions.length === 0) {
    return res.status(400).json({ message: 'Title and at least one question are required' });
  }

  const transaction = await sequelize.transaction();

  try {
    const survey = await Survey.create({ title, description }, { transaction });

    await Promise.all(
      questions.map(question =>
        Question.create({
          text: question.text,
          type: question.type,
          options: question.options || null,
          surveyId: survey.id
        }, { transaction })
      )
    );

    await transaction.commit();
    res.status(201).json(survey);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating survey:', error);
    res.status(500).json({ message: 'Failed to create survey' });
  }
});

app.get('/tipps', authenticateToken, async (req, res) => {
  try {
    const tipps = await Tipps.findAll();
    console.log('Abgerufene Tipps:', tipps);
    res.json(tipps);
  } catch (error) {
    console.error('Error fetching tipps:', error);
    console.error('Fehler beim Abrufen der Tipps:', error.message, error.stack);
    res.status(500).json({
      message: 'Failed to fetch surveys',
      error: error.message,
      stack: error.stack
    });
  }
});


app.post('/update-token', authenticateToken, async (req, res) => {

  const newToken = generateToken(req.user);
  res.status(200).json({ token: newToken });
});


app.post('/submit-survey', authenticateToken, async (req, res) => {
  try {
    const { surveyId, responses, noiseLevel, completed } = req.body;
    const userId = req.user.id;

    console.log('Empfangene Daten:', req.body); 

    if (!surveyId || !responses || responses.length === 0) {
      return res.status(400).json({ message: 'SurveyId, responses, and noiseLevel are required' });
    }

    const survey = await Survey.findByPk(surveyId);
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const transaction = await sequelize.transaction();

    try {
      // Überprüfen, ob bereits eine Antwort für den Benutzer und den Fragebogen existiert
      const existingResponse = await SurveyResponse.findOne({
        where: { userId, surveyId }
      });

      // Falls vorhanden, bestehende Antwort und zugehörige Antworten löschen
      if (existingResponse) {
        await Answer.destroy({ where: { surveyResponseId: existingResponse.id }, transaction });
        await existingResponse.destroy({ transaction });
      }

      // Neue Antwort erstellen
      const surveyResponse = await SurveyResponse.create(
        { userId, surveyId, noiseLevel, completed }, 
        { transaction }
      );

      // Antworten speichern
      await Promise.all(
        responses.map(response =>
          Answer.create({
            response: response.answer,
            questionId: response.questionId,
            surveyResponseId: surveyResponse.id
          }, { transaction })
        )
      );

      // Demographic-Flag für den Benutzer setzen, falls es sich um einen demografischen Fragebogen handelt
      if (survey.demographic) {
        const user = await User.findByPk(userId);
        if (user) {
          user.demographic = true;
          await user.save({ transaction });
        }
      }

      await transaction.commit();
      res.status(201).json({ message: 'Responses and noise data saved successfully' });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

  } catch (error) {
    console.error('Error saving survey responses:', error);
    res.status(500).json({ message: 'Error saving responses' });
  }
});



app.get('/user-surveys', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Finde alle Umfragen, die der Benutzer bereits beantwortet hat
    const surveyResponses = await SurveyResponse.findAll({
      where: { userId, completed: true }, // Nur erledigte Umfragen
      include: [
        {
          model: Survey,
          include: [
            {
              model: Question,
              as: 'questions', 
            }
          ]
        },
        {
          model: Answer,
        }
      ]
    });

    const result = surveyResponses.map(response => {
      const dataValues = response.dataValues;

      if (!dataValues.Survey) {
        console.error('Survey nicht definiert für die Antwort:', response);
        return null; 
      }

      const questions = dataValues.Survey.questions.map(question => {
        const answer = dataValues.Answers.find(answer => answer.questionId === question.id)?.response || null;

        return {
          questionId: question.id,
          questionText: question.text,
          questionType: question.type,
          answer: answer,
        };
      });

      return {
        surveyId: dataValues.Survey.id,
        surveyTitle: dataValues.Survey.title,
        surveyDescription: dataValues.Survey.description,
        completed: dataValues.completed,
        noiseLevel: dataValues.noiseLevel,
        questions: questions
      };
    }).filter(Boolean);

    console.log('Gefundene abgeschlossene Umfragen:', result);
    res.json(result);
  } catch (error) {
    console.error('Fehler beim Abrufen der Benutzersummary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/diary-entry', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { entryId, date, time, foodCategory, information, notes, stressLevel, activities, deleted } = req.body;

  if (!entryId || !date || !time) {
    return res.status(400).json({ message: 'Entry ID, date, and time are required' });
  }

  try {
    const existingEntry = await DiaryEntry.findOne({ where: { userId, entryId } });

    if (deleted) {
      if (existingEntry) {
        await existingEntry.destroy();
        return res.status(200).json({ message: 'Diary entry deleted successfully' });
      } else {
        return res.status(404).json({ message: 'Diary entry not found for deletion' });
      }
    } 

    if (existingEntry) {
      existingEntry.date = date;
      existingEntry.time = time;
      existingEntry.foodCategory = foodCategory;
      existingEntry.information = information;
      existingEntry.notes = notes;
      existingEntry.stressLevel = stressLevel;
      existingEntry.activities = activities;
      await existingEntry.save();
      res.status(200).json({ message: 'Diary entry updated successfully' });
    } else {
      await DiaryEntry.create({
        entryId,
        userId,
        date,
        time,
        foodCategory,
        information,
        notes,
        stressLevel,
        activities
      });
      res.status(201).json({ message: 'Diary entry created successfully' });
    }
  } catch (error) {
    console.error('Error saving diary entry:', error);
    res.status(500).json({ message: 'Failed to save diary entry' });
  }
});

app.get('/diary-entries', authenticateToken, async (req, res) => {
  const userId = req.user.id; 

  try {
   
    const diaryEntries = await DiaryEntry.findAll({
      where: { userId }, 
      order: [['date', 'DESC'], ['time', 'DESC']]
    });

    res.json(diaryEntries);
  } catch (error) {
    console.error('Fehler beim Abrufen der Tagebucheinträge:', error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Tagebucheinträge' });
  }
});

app.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Aktuelles Passwort und neues Passwort sind erforderlich' });
  }

  try {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'Could not find user!' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Current password is wrong!' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    logActivity(`User ${user.username} has changed their password`);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error while changing the password:', error);
    res.status(500).json({ message: 'Error while changing the password' });
  }
});

app.post('/save-settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { settings } = req.body;

  if (!settings) {
    return res.status(400).json({ message: 'Einstellungen sind erforderlich' });
  }

  try {
    let userSettings = await Settings.findOne({ where: { userId } });

    if (userSettings) {
      userSettings.settings = settings;
      await userSettings.save();
      res.status(200).json({ message: 'Einstellungen erfolgreich aktualisiert' });
    } else {
      await Settings.create({ userId, settings });
      res.status(201).json({ message: 'Einstellungen erfolgreich gespeichert' });
    }
  } catch (error) {
    console.error('Fehler beim Speichern der Einstellungen:', error);
    res.status(500).json({ message: 'Fehler beim Speichern der Einstellungen' });
  }
});

app.get('/get-settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const userSettings = await Settings.findOne({ where: { userId } });

    if (userSettings) {
      res.status(200).json(userSettings.settings);
    } else {
      res.status(404).json({ message: 'Keine Einstellungen gefunden' });
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Einstellungen:', error);
    res.status(500).json({ message: 'Fehler beim Abrufen der Einstellungen' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});


async function createDemographicSurvey() {
  const survey = await Survey.create({
    title: "Demografischer Fragebogen",
    description: "Bitte füllen Sie diesen Fragebogen aus.",
    demographic: true
  });

  const questions = [
    {
      text: "Wie alt sind Sie?",
      type: "single-choice",
      options: ["Unter 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65 oder älter"]
    },
    {
      text: "Welcher Geschlecht sind Sie?",
      type: "single-choice",
      options: ["Männlich", "Weiblich", "Divers"]
    },
    {
      text: "Familienstand",
      type: "single-choice",
      options: ["Single", "Verheiratet", "Geschieden", "Witwer/Witwe"]
    }
  ];

  for (const question of questions) {
    await Question.create({
      ...question,
      surveyId: survey.id 
    });
  }
}

createDemographicSurvey();
