import {Command, flags} from '@oclif/command'
import execa = require('execa')
import fs = require('fs')
import Listr = require('listr')
import path = require('path')

class Enveigle extends Command {
  static description = 'Deceive Ansible to template Trellis .env files to local system'

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    env: flags.string({
      char: 'e',
      description: 'local environment name',
      default: 'development',
    }),
    cbpath: flags.string({
      char: 'c',
      description: 'callback path',
      default: 'lib/trellis/plugins/callback',
    }),
  }

  async run() {
    const {flags} = this.parse(Enveigle)

    const tasks = new Listr([
      {
        title: 'Copy enveigle.yml & callback',
        task: () => {
          const enveigle = path.join(__dirname, '../templates/enveigle.yml')
          const callback = path.join(__dirname, '../callback_plugins/no_hosts_matched.py')
          fs.copyFileSync(callback, (flags.cbpath + '/no_hosts_matcheded.py'))
          fs.copyFileSync(enveigle, 'enveigle.yml')
        }
      },
      {
        title: 'Template .env files to local system',
        task: (_, task) =>  execa('ansible-playbook', ['enveigle.yml', `-e env=${flags.env}`])
        .catch((result) => {
          if (result.code = 10) {
            throw new Error('Could not match supplied host pattern')
          } else {
            task.skip('Something went wrong. Try again!')
          }
        })
      },
      {
        title: 'Remove enveigle.yml',
        task: () => {
          fs.unlinkSync('enveigle.yml')
          fs.unlinkSync(flags.cbpath + '/no_hosts_matcheded.py')
        }
      },
    ])

    tasks.run().catch(err => {
      console.error('##########################################')
      console.error('Abort! Something went wrong')
      console.error('You have to delete enveigle.yml manually')
      console.error('Error message:')
      console.error(err)
    })
  }
}

export = Enveigle
