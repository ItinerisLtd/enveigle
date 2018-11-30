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
  }

  async run() {
    const {flags} = this.parse(Enveigle)

    const tasks = new Listr([
      {
        title: 'Copy enveigle.yml',
        task: () => {
          const source = path.join(__dirname, '../templates/enveigle.yml')
          fs.copyFileSync(source, 'enveigle.yml')
        }
      },
      {
        title: 'Template .env files to local system',
        task: (_, task) => {
          task.output = `$ ansible-playbook enveigle.yml -e env=${flags.env}`
          return execa('ansible-playbook', ['enveigle.yml', `-e env=${flags.env}`])
        }
      },
      {
        title: 'Remove enveigle.yml',
        task: () => fs.unlinkSync('enveigle.yml')
      },
    ])

    tasks.run().catch(err => {
      console.error(err)
      console.error('##########################################')
      console.error('Abort! Something went wrong')
      console.error('You have to delete enveigle.yml manually')
    })
  }
}

export = Enveigle
