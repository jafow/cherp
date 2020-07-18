/** logger
 * run with DEBUG or INFO logs by setting an enviroment variable of LOG_LEVEL=50, 40, 30 respectively
 */
const noop = function () {}
if (process.env.LOG_LEVEL === undefined) process.env.LOG_LEVEL = 40
const LOGGER = {
  debug: (msg) => parseInt(process.env.LOG_LEVEL, 10) >= 50 ? console.dir(msg) : noop(),
  info: (msg) => parseInt(process.env.LOG_LEVEL, 10) >= 40 ? console.log(msg) : noop(),
  warn: (msg) => parseInt(process.env.LOG_LEVEL, 10) >= 30 ? console.warn(msg) : noop(),
  error: (msg, err) => {
    console.error(`${msg}; name: ${err.name}, status: ${err.status}, msg: ${err.message}`)
  }
}

module.exports = LOGGER
