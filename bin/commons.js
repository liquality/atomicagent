const program = require('commander')

module.exports.loadVariables = (config = {}) => {
  program
    .option('-p, --port <port>', 'Application port', config.defaultPort ? config.defaultPort : 3000)
    .option('-c, --config <path>', 'Config file path')

  program
    .parse(process.argv)

  process.env.PORT = program.port
  process.env.CONFIG_PATH = program.config
  process.env.PROCESS_TYPE = config.processType
}
