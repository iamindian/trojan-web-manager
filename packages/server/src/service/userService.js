
import { ssh224 } from "../utils/index.js";
import { QueryTypes } from "sequelize"
import BigNumber from "bignumber.js"
import moment from "moment";
let sequelize = null;
export async function init(sequelizeInstance) {
  sequelize = sequelizeInstance;
}
export async function getUsers(offset, limit, where) {
  const users = await sequelize.models.User.findAll({ offset, limit, where });
  const total = await sequelize.models.User.count();
  return { users, total };
}
export async function addUser(username, password) {
  const User = sequelize.models.User;
  return await User.create({ username, password: ssh224(username, password), delta: 1, quota: -1, start: Date.now(), download:0, upload:0 });
}
export async function getUserExpiration(username) {
  return await sequelize.query("select DATEDIFF(DATE_ADD(start, INTERVAL delta MONTH), now()) as expiration from users where username = :username", {
    replacements: { username },
    type: QueryTypes.SELECT,
    raw: true,
  })
}
export async function extendExpiration(username, password, quantity) {
  try {
    let user = await sequelize.models.User.findOne({
      where: {
        username, password: ssh224(username, password)
      }
    })
    if (!user)
      return {};
    if (moment(user.start).add(user.delta, 'month') >= moment()) {
      user.delta = new BigNumber(user.delta).plus(quantity);
      user.quota = -1;
    } else {
      user.delta = new BigNumber(quantity);
      user.start = moment();
      user.quota = -1;
    }
    user = await user.save();
    return user;
  } catch (e) {
    console.error(e)
  }
}
export async function extendExpirationById(id, quantity) {
  try {
    const user = await sequelize.models.User.findOne({
      where: {
        id
      }
    })
    if (!user)
      return {};
    if (moment(user.start).add(user.delta, 'month') >= moment()) {
      user.delta = new BigNumber(user.delta).plus(quantity);
      user.quota = -1;
    } else {
      user.delta = new BigNumber(quantity);
      user.start = moment();
      user.quota = -1;
    }
    await user.save();
    return user;
  } catch (e) {
    console.error(e)
    throw e;
  }
}
