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
          return execa('which', ['ansible-playbook']).catch(() => {
            const message = `Command ansible-playbook not found.
Solution: Install ansible.
See: https://docs.ansible.com/ansible/latest/installation_guide/index.html
`
            throw new Error(message)
          })
        },
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
              ANSIBLE_RETRY_FILES_ENABLED: 'false',
            },
            }
          ).catch(err => {
            if (err.exitCode === 10) {
              const message =
                'Could not match supplied host pattern. Try the `--env` flag!'
              task.skip(message)
              ctx.err = new Error(message)
            }

            ctx.ansibleErr = err
            task.skip('Something went wrong. Try again!')
          })
        },
      },
      {
        title: 'Cleanup temporary files',
        task: () => temporaries.forEach(temporary => fs.unlinkSync(temporary.dest))
      },
      {
        title: 'Re-throw ansible error',
        enabled: ctx => ctx.ansibleErr,
        task: ctx => {
          const ansibleErr: execa.ExecaError<string> = ctx.ansibleErr
          throw new Error(ansibleErr.stdout)
        },
      },
      {
        title: 'Re-throw error',
        enabled: ctx => ctx.err,
        task: ctx => {
          throw ctx.err
        }
      },
    ])

    tasks.run().catch(err => {
      this.log('')
      this.error('####################################', {exit: false})
      this.error('Abort! Something went wrong', {exit: false})
      this.error(err.message, {exit: false})
      this.log('')
      this.exit(1)
    })
  }
}

export = Enveigle
