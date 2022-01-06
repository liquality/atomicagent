function addCommonOptions(program) {
  program.option('-c, --config <path>', 'Config file path').on('option:config', (config) => {
    process.env.CONFIG_PATH = config
  })
}

module.exports = { addCommonOptions }
