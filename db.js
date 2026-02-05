// db.js
// Sequelize setup for PostgreSQL (production) or SQLite (local)
const { Sequelize, DataTypes } = require('sequelize');

// Use PostgreSQL for production (Railway), SQLite for local development
let sequelize;

if (process.env.DATABASE_URL) {
  // Production: PostgreSQL (Railway auto-provides this)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // Local development: SQLite (no setup required!)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING },
});

const Scan = sequelize.define('Scan', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  imageUrl: { type: DataTypes.STRING },
  emotion: { type: DataTypes.STRING },
  confidence: { type: DataTypes.FLOAT },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const TextEntry = sequelize.define('TextEntry', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  text: { type: DataTypes.TEXT, allowNull: false },
  emotion: { type: DataTypes.STRING },
  confidence: { type: DataTypes.FLOAT },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const Advice = sequelize.define('Advice', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  scanId: { type: DataTypes.INTEGER },
  textEntryId: { type: DataTypes.INTEGER },
  advice: { type: DataTypes.TEXT, allowNull: false },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

User.hasMany(Scan, { foreignKey: 'userId' });
User.hasMany(TextEntry, { foreignKey: 'userId' });
User.hasMany(Advice, { foreignKey: 'userId' });
Scan.belongsTo(User, { foreignKey: 'userId' });
TextEntry.belongsTo(User, { foreignKey: 'userId' });
Advice.belongsTo(User, { foreignKey: 'userId' });
Advice.belongsTo(Scan, { foreignKey: 'scanId' });
Advice.belongsTo(TextEntry, { foreignKey: 'textEntryId' });

module.exports = { sequelize, User, Scan, TextEntry, Advice };
