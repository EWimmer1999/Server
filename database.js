const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite',
  logging: console.log
});


const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
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


const Tipps = sequelize.define('Tipps', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  flavour: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});


const Survey = sequelize.define('Survey', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
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
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  text: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('multiple-choice', 'text', 'single-choice'),
    allowNull: false
  },
  options: {
    type: DataTypes.JSON,
    allowNull: true
  }
});

const SurveyResponse = sequelize.define('SurveyResponse', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  surveyId: {
    type: DataTypes.INTEGER,
    references: {
      model: Survey,
      key: 'id'
    },
    allowNull: false
  },
  noiseLevel: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  completed: { 
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

const Answer = sequelize.define('Answer', { 
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  surveyResponseId: {
    type: DataTypes.INTEGER,
    references: {
      model: SurveyResponse,
      key: 'id'
    },
    allowNull: false
  },
  questionId: {
    type: DataTypes.INTEGER,
    references: {
      model: Question,
      key: 'id'
    },
    allowNull: false
  },
  response: {
    type: DataTypes.TEXT, 
    allowNull: false
  }
});

const DiaryEntry = sequelize.define('DiaryEntry', {
  entryId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  time: {
    type: DataTypes.STRING,
    allowNull: false
  },
  foodCategory: {
    type: DataTypes.STRING,
    allowNull: true
  },
  information: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  notes: {
    type: DataTypes.STRING,
    allowNull: true
  },
  stressLevel: {
    type: DataTypes.STRING,
    allowNull: true
  },
  activities: {
    type: DataTypes.JSON,
    allowNull: true
  }
});


User.hasMany(DiaryEntry, { foreignKey: 'userId' });
DiaryEntry.belongsTo(User, { foreignKey: 'userId' });

Survey.hasMany(Question, { as: 'questions', foreignKey: 'surveyId' });
Question.belongsTo(Survey, { foreignKey: 'surveyId' });

Survey.hasMany(SurveyResponse, { foreignKey: 'surveyId' });
SurveyResponse.belongsTo(Survey, { foreignKey: 'surveyId' });

User.hasMany(SurveyResponse, { foreignKey: 'userId' });
SurveyResponse.belongsTo(User, { foreignKey: 'userId' });

SurveyResponse.hasMany(Answer, { foreignKey: 'surveyResponseId' });
Answer.belongsTo(SurveyResponse, { foreignKey: 'surveyResponseId' });

Question.hasMany(Answer, { foreignKey: 'questionId' });
Answer.belongsTo(Question, { foreignKey: 'questionId' });

sequelize.sync()
  .then(() => {
    console.log('Database & tables created!');
  })
  .catch((error) => {
    console.error('Error syncing the database:', error);
  });

module.exports = {
  User, Tipps, Survey, Question, SurveyResponse, Answer, DiaryEntry
};
