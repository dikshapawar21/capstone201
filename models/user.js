"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      User.hasMany(models.Course, {
        foreignKey: "userId",
        onDelete: "CASCADE",
      });
      User.belongsToMany(models.Course, {
        through: models.Enrollment,
        foreignKey: "userId",
      });
      User.belongsToMany(models.Page, {
        through: models.MarkComplete,
        foreignKey: "userId",
      });
    }
    static delete() {
      this.destroy();
    }
  }
  User.init(
    {
      firstName: DataTypes.STRING,
      lastName: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      designation: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "User",
    }
  );
  return User;
};
