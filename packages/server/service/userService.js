import { sequelize } from "../models/index.js";
import { ssh224 } from "../utils/index.js";
export async function getUsers() {
  const users = await sequelize.models.User.findAll();
  return users;
}
export async function addUser(username, password) {
  console.log(`${username},${password}`)
  const User = sequelize.models.User;
  await User.create({ username, password:ssh224(username, password) });
}
export async function getUserExpiration(username, password) {
  console.log(`${username},${password}`)
  const User = sequelize.models.User;
  return await User.findOne({ "where": { password: ssh224(username, password) } })
}
