const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: console.log
});

// Definiere die bestehenden Modelle
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Survey = sequelize.define('Survey', {
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

const Question = sequelize.define('Question', {
  text: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('multiple-choice', 'text', 'single-choice'),
    allowNull: false
  },
  options: {
    type: DataTypes.JSONB,  // Für Auswahlmöglichkeiten (nur relevant für multiple-choice Fragen)
    allowNull: true
  }
});

// Definiere die neue Tabelle SurveyResponse
const SurveyResponse = sequelize.define('SurveyResponse', {
  response: {
    type: DataTypes.JSONB, // Speichert die Antworten als JSON
    allowNull: false
  }
});

// Definiere die Beziehungen
Survey.hasMany(Question, { as: 'questions' });
Question.belongsTo(Survey);

User.hasMany(SurveyResponse); // Ein User kann viele Antworten haben
SurveyResponse.belongsTo(User);

Survey.hasMany(SurveyResponse); // Eine Umfrage kann viele Antworten haben
SurveyResponse.belongsTo(Survey);

// Synchronisiere die Datenbank
sequelize.sync()
  .then(() => {
    console.log('Database & tables created!');
  })
  .catch((error) => {
    console.error('Error syncing the database:', error);
  });

module.exports = {
  User,
  Survey,
  Question,
  SurveyResponse
};
