"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Course.belongsTo(models.User, {
        foreignKey: "userId",
        onDelete: "CASCADE",
      });
      Course.hasMany(models.Chapter, {
        foreignKey: "courseId",
        onDelete: "CASCADE",
      });
      Course.belongsToMany(models.User, {
        through: models.Enrollment,
        foreignKey: "courseId",
      });
    }
  }
  Course.init(
    {
      name: DataTypes.STRING,
      userId: DataTypes.INTEGER,
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: "Course",
    }
  );
  return Course;
};
