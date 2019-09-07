const { execSync } = require('child_process')

execSync('exec < /dev/tty && git cz --hook --colors', {
  stdio: 'inherit',
})
