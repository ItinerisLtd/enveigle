import {Command, flags} from '@oclif/command'
import * as execa from 'execa'
import * as fs from 'fs'
import * as Listr from 'listr'
import * as path from 'path'

class Enveigle extends Command {
  static description = 'Deceive Ansible to template Trellis .env files to local Bedrock'

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    env: flags.string({
      char: 'e',
      description: 'local environment name',
      env: 'ENVEIGLE_ENV',
      default: 'development',
    }),
    callback_dir: flags.string({
      char: 'c',
      description: 'ansible callback directory',
      env: 'ENVEIGLE_CALLBACK_DIR',
      default: 'lib/trellis/plugins/callback',
    }),
  }

  async run() {
    const {flags} = this.parse(Enveigle)

    const temporaryPlaybook = {
      name: 'playbook',
      src: path.join(__dirname, '../templates/enveigle.yml'),
      dest: 'enveigle.yml',
    }
    const temporaries = [
      temporaryPlaybook,
      {
        name: 'no_hosts_matched_callback',
        src: path.join(__dirname, '../templates/no_hosts_matched.py'),
        dest: flags.callback_dir + '/no_hosts_matcheded.py',
      },
    ]

    const tasks = new Listr([
      {
        title: 'Check ansible installed',
        task: () => {
          return execa('which', ['ansible-playbook'])
            .catch(() => {
              const message = `
Command ansible-playbook not found. Please install ansible.
See: https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html
`
              throw new Error(message)
          })
        }
      },
      {
        title: 'Copy temporary files',
        task: () => temporaries.forEach(temporary => fs.copyFileSync(temporary.src, temporary.dest))
      },
      {
        title: 'Template .env files to local system',
        task: (ctx, task) => {
          task.title = `$ ansible-playbook ${temporaryPlaybook.dest} -e env=${flags.env}`

          return execa('ansible-playbook', [temporaryPlaybook.dest, `-e env=${flags.env}`], {
            env: {
              ANSIBLE_RETRY_FILES_ENABLED: "false",
            },
          })
            .catch(err => {
              if (err.code === 10) {
                task.skip('Could not match supplied host pattern. Try the `--env` flag!')
                return
              }

              ctx.ansibleErr = err
              task.skip('Something went wrong. Try again!')
            }
          )
        }
      },
      {
        title: 'Cleanup temporary files',
        task: () => temporaries.forEach(temporary => fs.unlinkSync(temporary.dest))
      },
      {
        title: 'Re-throw ansible error',
        enabled: ctx => ctx.ansibleErr,
        task: ctx => {
          throw ctx.ansibleErr
        }
      }
    ])

    tasks.run().catch(err => {
      console.error('')
      console.error('##########################################')
      console.error('Abort! Something went wrong')
      console.error('Error message:')
      console.error(err)
    })
  }
}

export = Enveigle
