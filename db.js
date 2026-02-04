// db.js
// Sequelize setup for PostgreSQL
const { Sequelize, DataTypes } = require('sequelize');

// Handle DATABASE_URL for both local and production
const dbUrl = process.env.DATABASE_URL || 'postgres://godabeguser:godabegpass@localhost:5432/godabeg';

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
});

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
